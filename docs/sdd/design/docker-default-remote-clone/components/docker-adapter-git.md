# コンポーネント設計: DockerAdapter Git操作拡張

## 概要

DockerAdapterにGit操作メソッドを追加し、Docker内でリモートリポジトリのクローン、更新、ブランチ取得を可能にする。

## 責務

- Docker内でのGit clone実行
- Docker内でのGit pull実行（fast-forward only）
- Docker内でのブランチ一覧取得
- Docker内でのデフォルトブランチ取得
- SSH認証の設定（既存実装を活用）

## インターフェース

```typescript
// src/services/adapters/docker-adapter.ts

export interface GitCloneOptions {
  url: string;
  targetPath: string;
  environmentId: string;
}

export interface GitCloneResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface GitPullResult {
  success: boolean;
  updated: boolean;
  message: string;
  error?: string;
}

export interface Branch {
  name: string;
  isDefault: boolean;
  isRemote: boolean;
}

export class DockerAdapter extends BasePTYAdapter {
  // 既存メソッド...

  /**
   * Docker内でリモートリポジトリをクローン
   *
   * @param options - クローンオプション
   * @returns クローン結果
   */
  async gitClone(options: GitCloneOptions): Promise<GitCloneResult>;

  /**
   * Docker内でリポジトリを更新（fast-forward only）
   *
   * @param repoPath - リポジトリパス
   * @returns 更新結果
   */
  async gitPull(repoPath: string): Promise<GitPullResult>;

  /**
   * Docker内でブランチ一覧を取得
   *
   * @param repoPath - リポジトリパス
   * @returns ブランチ一覧
   */
  async gitGetBranches(repoPath: string): Promise<Branch[]>;

  /**
   * Docker内でデフォルトブランチを取得
   *
   * @param repoPath - リポジトリパス
   * @returns デフォルトブランチ名
   */
  async gitGetDefaultBranch(repoPath: string): Promise<string>;
}
```

## 実装詳細

### gitClone()

```typescript
async gitClone(options: GitCloneOptions): Promise<GitCloneResult> {
  const { url, targetPath, environmentId } = options;

  try {
    // Docker実行コマンド構築
    const args = [
      'run', '--rm',
      '-v', `${targetPath}:/workspace/target`,
      '-v', `${os.homedir()}/.ssh:/root/.ssh:ro`,
    ];

    // SSH Agent転送
    if (process.env.SSH_AUTH_SOCK) {
      args.push('-v', `${process.env.SSH_AUTH_SOCK}:/ssh-agent`);
      args.push('-e', 'SSH_AUTH_SOCK=/ssh-agent');
    }

    // 環境変数
    args.push('-e', 'GIT_TERMINAL_PROMPT=0');

    // イメージとコマンド
    args.push(this.config.imageName + ':' + this.config.imageTag);
    args.push('git', 'clone', url, '/workspace/target');

    // 実行
    const result = await this.executeDockerCommand(args);

    if (result.code === 0) {
      return { success: true, path: targetPath };
    } else {
      return { success: false, error: result.stderr };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

### gitPull()

```typescript
async gitPull(repoPath: string): Promise<GitPullResult> {
  try {
    const args = [
      'run', '--rm',
      '-v', `${repoPath}:/workspace/repo`,
      '-v', `${os.homedir()}/.ssh:/root/.ssh:ro`,
    ];

    // SSH Agent転送
    if (process.env.SSH_AUTH_SOCK) {
      args.push('-v', `${process.env.SSH_AUTH_SOCK}:/ssh-agent`);
      args.push('-e', 'SSH_AUTH_SOCK=/ssh-agent');
    }

    args.push('-e', 'GIT_TERMINAL_PROMPT=0');
    args.push('-w', '/workspace/repo');
    args.push(this.config.imageName + ':' + this.config.imageTag);
    args.push('git', 'pull', '--ff-only');

    const result = await this.executeDockerCommand(args);

    if (result.code === 0) {
      const updated = !result.stdout.includes('Already up to date');
      return {
        success: true,
        updated,
        message: result.stdout.trim(),
      };
    } else {
      return {
        success: false,
        updated: false,
        message: '',
        error: result.stderr,
      };
    }
  } catch (error) {
    return {
      success: false,
      updated: false,
      message: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

### gitGetBranches()

```typescript
async gitGetBranches(repoPath: string): Promise<Branch[]> {
  try {
    // ローカルブランチ取得
    const localResult = await this.executeGitCommand(repoPath, ['branch']);
    const localBranches = this.parseLocalBranches(localResult.stdout);

    // リモート追跡ブランチ取得
    const remoteResult = await this.executeGitCommand(repoPath, ['branch', '-r']);
    const remoteBranches = this.parseRemoteBranches(remoteResult.stdout);

    // デフォルトブランチ取得
    const defaultBranch = await this.gitGetDefaultBranch(repoPath);

    // マージ
    const branches: Branch[] = [
      ...localBranches.map(name => ({
        name,
        isDefault: name === defaultBranch,
        isRemote: false,
      })),
      ...remoteBranches.map(name => ({
        name,
        isDefault: false,
        isRemote: true,
      })),
    ];

    return branches;
  } catch (error) {
    logger.error('Failed to get branches', { repoPath, error });
    return [];
  }
}

private parseLocalBranches(output: string): string[] {
  return output
    .split('\n')
    .map(line => line.trim().replace(/^\* /, ''))
    .filter(line => line.length > 0);
}

private parseRemoteBranches(output: string): string[] {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.includes('HEAD ->'));
}
```

### gitGetDefaultBranch()

```typescript
async gitGetDefaultBranch(repoPath: string): Promise<string> {
  try {
    const result = await this.executeGitCommand(repoPath, [
      'symbolic-ref',
      'refs/remotes/origin/HEAD',
    ]);

    // "refs/remotes/origin/main" -> "main"
    const match = result.stdout.trim().match(/refs\/remotes\/origin\/(.+)/);
    return match ? match[1] : 'main';
  } catch (error) {
    // symbolic-refが失敗した場合はmainをデフォルトとする
    logger.warn('Could not determine default branch, using main', { repoPath });
    return 'main';
  }
}
```

### executeGitCommand() (ヘルパー)

```typescript
private async executeGitCommand(
  repoPath: string,
  gitArgs: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  const args = [
    'run', '--rm',
    '-v', `${repoPath}:/workspace/repo`,
    '-v', `${os.homedir()}/.ssh:/root/.ssh:ro`,
  ];

  if (process.env.SSH_AUTH_SOCK) {
    args.push('-v', `${process.env.SSH_AUTH_SOCK}:/ssh-agent`);
    args.push('-e', 'SSH_AUTH_SOCK=/ssh-agent');
  }

  args.push('-e', 'GIT_TERMINAL_PROMPT=0');
  args.push('-w', '/workspace/repo');
  args.push(this.config.imageName + ':' + this.config.imageTag);
  args.push('git', ...gitArgs);

  return this.executeDockerCommand(args);
}

private async executeDockerCommand(
  args: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = childProcess.spawn('docker', args);
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });

    proc.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: error.message });
    });
  });
}
```

## エラーハンドリング

| エラー種別 | 原因 | 対応 |
|-----------|------|------|
| 認証エラー | SSH鍵が設定されていない | エラーメッセージに「SSH設定を確認してください」と表示 |
| ネットワークエラー | ネットワーク接続失敗 | エラーメッセージに「ネットワーク接続を確認してください」と表示 |
| パス不正 | 無効なリポジトリパス | エラーメッセージに「無効なパス」と表示 |
| Fast-forward失敗 | ローカル変更がある | エラーメッセージに「ローカルに未コミットの変更があります」と表示 |

## セキュリティ考慮事項

1. **SSH鍵の保護**: 読み取り専用でマウント（`:ro`）
2. **コマンドインジェクション防止**: URLやパスを配列形式でspawnに渡す
3. **環境変数の制御**: GIT_TERMINAL_PROMPT=0で不要なプロンプト防止
4. **Docker実行権限**: 最小限の権限で実行

## テスト要件

### ユニットテスト

- `gitClone()`: 成功、認証エラー、ネットワークエラー
- `gitPull()`: 成功、fast-forward失敗、競合
- `gitGetBranches()`: ローカル・リモートブランチの取得
- `gitGetDefaultBranch()`: デフォルトブランチの正確な取得

### 統合テスト

- publicリポジトリのクローン
- privateリポジトリのクローン（SSH）
- ブランチ一覧の正確性

## パフォーマンス要件

- クローン: タイムアウトなし（大規模リポジトリ対応）
- Pull: 通常のCLI実行と同等の速度
- ブランチ取得: 5秒以内

## 依存関係

- Docker Engine
- SSH設定（`~/.ssh`）
- 既存のDockerAdapterクラス
- child_process（Node.js標準ライブラリ）

## 備考

- 既存のSSH設定マウント実装を活用
- Docker内でGitコマンドを直接実行
- ホストのGitServiceとは独立して動作
