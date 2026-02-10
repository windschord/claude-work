# 設計書: Docker環境ターミナル入力不能の修正

## 概要

DockerAdapterのライフサイクル管理を改善し、PTY終了時にDockerコンテナが
確実に停止されるようにする。

## 修正対象

- `src/services/adapters/docker-adapter.ts`
- `src/services/adapters/__tests__/docker-adapter.test.ts`

## 設計

### 修正1: コンテナ停止用プライベートメソッドの追加

```typescript
/**
 * Dockerコンテナを強制停止する（バックグラウンド実行）
 * ptyProcess.kill()だけではdocker CLIが終了するだけでコンテナは停止しないため、
 * docker stop コマンドで明示的にコンテナを停止する。
 */
private stopContainer(containerName: string): void {
  const execFileAsync = promisify(execFile);
  execFileAsync('docker', ['stop', '-t', '3', containerName], { timeout: 10000 })
    .catch(() => {
      // stopが失敗した場合はkillを試みる
      return execFileAsync('docker', ['kill', containerName], { timeout: 5000 });
    })
    .catch(() => {
      // killも失敗した場合は無視（既にコンテナが停止している可能性）
    });
}
```

- `docker stop -t 3` で3秒の猶予後にコンテナを停止
- 失敗時は `docker kill` でフォールバック
- Promiseはawaitせずバックグラウンド実行（NFR-001対応）
- コマンドタイムアウトを設定して無限待ちを防止

### 修正2: destroySession()にコンテナ停止を追加

```typescript
destroySession(sessionId: string): void {
  const session = this.sessions.get(sessionId);
  if (session) {
    const containerId = session.containerId;
    // ... 既存処理 ...
    session.ptyProcess.kill();
    this.sessions.delete(sessionId);

    // Dockerコンテナを明示的に停止（shellModeではコンテナを止めない）
    if (!session.shellMode) {
      this.stopContainer(containerId);
    }
  }
}
```

- shellMode（docker exec）セッションの場合はコンテナを停止しない
  （親セッションのコンテナを停止してしまうため）
- 通常セッション（docker run）の場合のみコンテナを停止

### 修正3: onExitハンドラーにコンテナ停止を追加

```typescript
ptyProcess.onExit(async ({ exitCode, signal }) => {
  // ... 既存処理 ...
  const session = this.sessions.get(sessionId);
  const containerId = session?.containerId;
  this.sessions.delete(sessionId);

  // PTY終了時にコンテナがまだ実行中なら停止
  if (containerId && !shellMode) {
    this.stopContainer(containerId);
  }
});
```

- `containerId`を`sessions.delete()`前に取得
- shellModeではコンテナを停止しない

### 修正4: restartSession()を非同期化してコンテナ停止を待機

```typescript
restartSession(sessionId: string, workingDir?: string): void {
  const session = this.sessions.get(sessionId);
  if (session) {
    const { workingDir: wd, containerId } = session;
    this.destroySession(sessionId);

    // コンテナ停止を待ってから新コンテナを作成（最大5秒待機）
    const execFileAsync = promisify(execFile);
    execFileAsync('docker', ['wait', containerId], { timeout: 5000 })
      .catch(() => { /* タイムアウトまたはエラー: 無視して続行 */ })
      .then(() => {
        this.createSession(sessionId, wd).catch(() => {});
      });
  }
}
```

- `docker wait`でコンテナの完全停止を待機
- タイムアウト5秒で応答性を維持
- 待機失敗時も新コンテナ作成を試行

### 修正5: write()に警告ログを追加

```typescript
write(sessionId: string, data: string): void {
  const session = this.sessions.get(sessionId);
  if (!session) {
    logger.warn('DockerAdapter: write() called but session not found', { sessionId });
    return;
  }
  session.ptyProcess.write(data);
}
```

- セッション不在時に警告ログを出力
- 過度なログ出力を避けるため`warn`レベル

## 影響範囲

| コンポーネント | 影響 |
|---------------|------|
| DockerAdapter | 直接変更 |
| HostAdapter | 変更なし |
| claude-ws.ts | 変更なし |
| terminal-ws.ts | 変更なし |

## リスク

| リスク | 緩和策 |
|-------|-------|
| `docker stop`のタイムアウトでrestartが遅延 | 3秒の短いタイムアウトを設定 |
| shellModeセッション判定の誤り | `shellMode`フラグで明示的に判別 |
| コンテナが既に停止済みの場合 | catch節でエラーを無視 |
