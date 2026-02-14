# DockerAdapter設計

## 概要

Docker環境でのPTY起動とgit操作を担当するAdapter実装。

## 責務

1. Dockerコンテナ内でPTYプロセスを起動
2. working directoryを適切に設定
3. PTY入出力をWebSocket経由で転送
4. PTYプロセスのライフサイクル管理

## インターフェース

```typescript
interface EnvironmentAdapter {
  spawnPTY(options: PTYSpawnOptions): Promise<PTYProcess>;
  killPTY(ptyId: string): Promise<void>;
  resizePTY(ptyId: string, cols: number, rows: number): Promise<void>;
}

interface PTYSpawnOptions {
  sessionId: string;
  worktreePath: string;  // Docker: /repo/.worktrees/session-XXX
  environmentId: string;
  initialPrompt?: string;
  claudeCodeOptions?: ClaudeCodeOptions;
  customEnvVars?: CustomEnvVars;
}
```

## 実装戦略

### PTY起動

```typescript
async spawnPTY(options: PTYSpawnOptions): Promise<PTYProcess> {
  const { sessionId, worktreePath, environmentId } = options;

  // 1. セッション情報取得
  const session = await getSessionFromDB(sessionId);
  const project = await getProjectFromDB(session.project_id);

  // 2. Dockerコマンド構築
  const volumeName = `claude-repo-${project.id}`;
  const dockerArgs = [
    'run',
    '-dit',  // detached, interactive, tty
    '--name', `claude-session-${sessionId}`,
    '-v', `${volumeName}:/repo`,
    '-w', worktreePath,  // working directory: /repo/.worktrees/session-XXX
    'alpine/git',
    '/bin/sh'
  ];

  // 3. Dockerコンテナ起動
  const container = await execDockerCommand(dockerArgs);

  // 4. PTYプロセスオブジェクト作成
  return {
    pid: container.pid,
    write: (data) => container.stdin.write(data),
    resize: (cols, rows) => execDockerCommand(['exec', ...]),
    kill: () => execDockerCommand(['stop', container.id]),
    onData: container.stdout.on('data', ...),
    onExit: container.on('exit', ...),
  };
}
```

### エラーハンドリング

1. **コンテナ起動失敗**
   - エラーログ記録
   - セッションステータスを`error`に更新
   - ユーザーに適切なエラーメッセージを返す

2. **worktreeディレクトリ不在**
   - コンテナ起動前にディレクトリ存在確認
   - 不在の場合はworktree再作成を試行
   - 再作成失敗時はエラーを返す

3. **コンテナ異常終了**
   - 終了シグナルを記録
   - WebSocket接続をクリーンアップ
   - セッションステータスを更新

## 依存関係

- `child_process.spawn` - Dockerコマンド実行
- `DockerGitService` - worktree操作
- `ConnectionManager` - WebSocket管理
- `logger` - ログ出力

## テスト戦略

1. **ユニットテスト**
   - Dockerコマンド構築ロジック
   - エラーハンドリング
   - PTYプロセス管理

2. **統合テスト**
   - 実際のDockerコンテナでPTY起動
   - WebSocket通信
   - worktreeディレクトリアクセス

## 技術的課題と解決策

### 課題1: Dockerコンテナのライフサイクル管理

**解決策**: コンテナに `claude-session-${sessionId}` という一意な名前を付け、セッション削除時に確実にクリーンアップする。

### 課題2: PTY入出力のストリーミング

**解決策**: `docker exec -it` を使ってPTYストリームをホスト側に転送し、WebSocket経由でクライアントに送信する。

### 課題3: working directory設定

**解決策**: `docker run -w` オプションでworking directoryを `/repo/.worktrees/session-XXX` に設定する。
