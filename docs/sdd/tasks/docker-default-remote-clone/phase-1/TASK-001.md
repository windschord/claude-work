# TASK-001: DockerAdapterにGit操作メソッドを追加

## 説明

- 対象ファイル: `src/services/adapters/docker-adapter.ts`
- Docker内でGit操作（clone, pull, getBranches, getDefaultBranch）を実行するメソッドを追加
- 既存のSSH設定マウント実装を活用
- テストファイル: `src/services/adapters/__tests__/docker-adapter-git.test.ts`

## 技術的文脈

- **既存実装**: DockerAdapterクラス（BasePTYAdapterを継承）
- **SSH設定**: 既に`~/.ssh`を読み取り専用でマウント済み（89-92行目）
- **Dockerイメージ**: `config.imageName` + ':' + `config.imageTag`
- **参照すべき設計**: @../../design/docker-default-remote-clone/components/docker-adapter-git.md

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | - Git操作をDocker内で実行<br>- SSH認証を使用<br>- fast-forward onlyでpull<br>- GIT_TERMINAL_PROMPT=0設定 |
| 不明/要確認の情報 | なし（設計書で全て明示済み） |

## 実装手順（TDD）

### 1. テスト作成

```bash
# テストファイルを作成
cat > src/services/adapters/__tests__/docker-adapter-git.test.ts << 'EOF'
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerAdapter } from '../docker-adapter';
import * as childProcess from 'child_process';

describe('DockerAdapter Git Operations', () => {
  let adapter: DockerAdapter;

  beforeEach(() => {
    adapter = new DockerAdapter({
      environmentId: 'test-env',
      imageName: 'node',
      imageTag: '20-alpine',
      authDirPath: '/tmp/test-auth',
    });
  });

  describe('gitClone', () => {
    it('should clone a repository successfully', async () => {
      // テストケース実装
      const result = await adapter.gitClone({
        url: 'git@github.com:test/repo.git',
        targetPath: '/tmp/test-repo',
        environmentId: 'test-env',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('/tmp/test-repo');
    });

    it('should handle clone failure', async () => {
      // エラーケースのテスト
    });
  });

  describe('gitPull', () => {
    it('should pull successfully with updates', async () => {
      // テストケース実装
    });

    it('should handle fast-forward failure', async () => {
      // エラーケースのテスト
    });
  });

  describe('gitGetBranches', () => {
    it('should return local and remote branches', async () => {
      // テストケース実装
    });
  });

  describe('gitGetDefaultBranch', () => {
    it('should return default branch name', async () => {
      // テストケース実装
    });
  });
});
EOF
```

### 2. テスト実行（失敗確認）

```bash
npm test -- docker-adapter-git.test.ts
# すべてのテストが失敗することを確認
```

### 3. テストコミット

```bash
git add src/services/adapters/__tests__/docker-adapter-git.test.ts
git commit -m "test: Add tests for DockerAdapter Git operations

- Add gitClone tests
- Add gitPull tests
- Add gitGetBranches tests
- Add gitGetDefaultBranch tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 4. 実装

`src/services/adapters/docker-adapter.ts`に以下のメソッドを追加：

```typescript
// インターフェース定義を追加
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

// DockerAdapterクラスにメソッドを追加

/**
 * Docker内でリモートリポジトリをクローン
 */
async gitClone(options: GitCloneOptions): Promise<GitCloneResult> {
  const { url, targetPath, environmentId } = options;

  try {
    const args = [
      'run', '--rm',
      '-v', `${targetPath}:/workspace/target`,
      '-v', `${os.homedir()}/.ssh:/home/node/.ssh:ro`,
    ];

    if (process.env.SSH_AUTH_SOCK) {
      args.push('-v', `${process.env.SSH_AUTH_SOCK}:/ssh-agent`);
      args.push('-e', 'SSH_AUTH_SOCK=/ssh-agent');
    }

    args.push('-e', 'GIT_TERMINAL_PROMPT=0');
    args.push(this.config.imageName + ':' + this.config.imageTag);
    args.push('git', 'clone', url, '/workspace/target');

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

/**
 * Docker内でリポジトリを更新（fast-forward only）
 */
async gitPull(repoPath: string): Promise<GitPullResult> {
  try {
    const args = [
      'run', '--rm',
      '-v', `${repoPath}:/workspace/repo`,
      '-v', `${os.homedir()}/.ssh:/home/node/.ssh:ro`,
    ];

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

/**
 * Docker内でブランチ一覧を取得
 */
async gitGetBranches(repoPath: string): Promise<Branch[]> {
  try {
    const localResult = await this.executeGitCommand(repoPath, ['branch']);
    const localBranches = this.parseLocalBranches(localResult.stdout);

    const remoteResult = await this.executeGitCommand(repoPath, ['branch', '-r']);
    const remoteBranches = this.parseRemoteBranches(remoteResult.stdout);

    const defaultBranch = await this.gitGetDefaultBranch(repoPath);

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

/**
 * Docker内でデフォルトブランチを取得
 */
async gitGetDefaultBranch(repoPath: string): Promise<string> {
  try {
    const result = await this.executeGitCommand(repoPath, [
      'symbolic-ref',
      'refs/remotes/origin/HEAD',
    ]);

    const match = result.stdout.trim().match(/refs\/remotes\/origin\/(.+)/);
    return match ? match[1] : 'main';
  } catch (error) {
    logger.warn('Could not determine default branch, using main', { repoPath });
    return 'main';
  }
}

/**
 * Git操作用のヘルパーメソッド
 */
private async executeGitCommand(
  repoPath: string,
  gitArgs: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  const args = [
    'run', '--rm',
    '-v', `${repoPath}:/workspace/repo`,
    '-v', `${os.homedir()}/.ssh:/home/node/.ssh:ro`,
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

### 5. テスト実行（通過確認）

```bash
npm test -- docker-adapter-git.test.ts
# すべてのテストが通過することを確認
```

### 6. 実装コミット

```bash
git add src/services/adapters/docker-adapter.ts
git commit -m "feat: Add Git operations to DockerAdapter

- Add gitClone method for Docker-based cloning
- Add gitPull method with fast-forward only
- Add gitGetBranches method for listing branches
- Add gitGetDefaultBranch method
- Add helper methods for Docker command execution

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/services/adapters/docker-adapter.ts`に以下のメソッドが追加されている:
  - `gitClone(options: GitCloneOptions): Promise<GitCloneResult>`
  - `gitPull(repoPath: string): Promise<GitPullResult>`
  - `gitGetBranches(repoPath: string): Promise<Branch[]>`
  - `gitGetDefaultBranch(repoPath: string): Promise<string>`
- [ ] テストファイル`src/services/adapters/__tests__/docker-adapter-git.test.ts`が存在する
- [ ] テストカバレッジが80%以上
- [ ] `npm test`で全テスト通過
- [ ] ESLintエラーがゼロ
- [ ] TypeScriptの型エラーがゼロ
- [ ] SSH設定が読み取り専用でマウントされている
- [ ] GIT_TERMINAL_PROMPT=0が設定されている

## 依存関係

- なし（既存のDockerAdapterクラスを拡張）

## 推定工数

60分（AIエージェント作業時間）

## ステータス

`DONE`

## 備考

- 既存のSSH設定マウント実装（89-103行目）を活用
- Docker内でGit CLI を直接実行
- エラーハンドリングは詳細なメッセージを返す
