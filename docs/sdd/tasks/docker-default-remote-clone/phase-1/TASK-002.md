# TASK-002: RemoteRepoServiceの実装

## 説明

- 対象ファイル: `src/services/remote-repo-service.ts`（新規作成）
- リモートリポジトリ操作を抽象化し、DockerAdapter経由でのclone、pull、getBranchesを提供
- URL検証、リポジトリ名抽出、エラーハンドリングを担当
- テストファイル: `src/services/__tests__/remote-repo-service.test.ts`

## 技術的文脈

- **依存**: DockerAdapter（TASK-001）、AdapterFactory
- **参照すべき設計**: @../../design/docker-default-remote-clone/components/remote-repo-service.md
- **既存実装**: GitServiceを参考（URL検証、パストラバーサル対策）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | - URL検証（SSH/HTTPS形式）<br>- リポジトリ名抽出<br>- DockerAdapter経由で操作<br>- clone先は`data/repos/` |
| 不明/要確認の情報 | なし（設計書で全て明示済み） |

## 実装手順（TDD）

### 1. テスト作成

```typescript
// src/services/__tests__/remote-repo-service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoteRepoService } from '../remote-repo-service';

describe('RemoteRepoService', () => {
  let service: RemoteRepoService;
  let mockAdapterFactory: any;

  beforeEach(() => {
    mockAdapterFactory = {
      getAdapter: vi.fn(),
    };
    service = new RemoteRepoService(mockAdapterFactory);
  });

  describe('validateRemoteUrl', () => {
    it('should validate SSH URL', () => {
      const result = service.validateRemoteUrl('git@github.com:user/repo.git');
      expect(result.valid).toBe(true);
    });

    it('should validate HTTPS URL', () => {
      const result = service.validateRemoteUrl('https://github.com/user/repo.git');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid URL', () => {
      const result = service.validateRemoteUrl('invalid-url');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('extractRepoName', () => {
    it('should extract repo name from SSH URL', () => {
      const name = service.extractRepoName('git@github.com:user/my-repo.git');
      expect(name).toBe('my-repo');
    });

    it('should extract repo name from HTTPS URL', () => {
      const name = service.extractRepoName('https://github.com/user/my-repo.git');
      expect(name).toBe('my-repo');
    });
  });

  describe('clone', () => {
    it('should clone successfully', async () => {
      // モック設定
      const mockAdapter = {
        gitClone: vi.fn().mockResolvedValue({
          success: true,
          path: '/path/to/repo',
        }),
      };
      mockAdapterFactory.getAdapter.mockResolvedValue(mockAdapter);

      const result = await service.clone({
        url: 'git@github.com:user/repo.git',
        environmentId: 'env-1',
      });

      expect(result.success).toBe(true);
      expect(result.projectName).toBe('repo');
    });

    it('should handle invalid URL', async () => {
      const result = await service.clone({
        url: 'invalid-url',
        environmentId: 'env-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('pull', () => {
    it('should pull successfully', async () => {
      const mockAdapter = {
        gitPull: vi.fn().mockResolvedValue({
          success: true,
          updated: true,
          message: 'Updated',
        }),
      };
      mockAdapterFactory.getAdapter.mockResolvedValue(mockAdapter);

      const result = await service.pull('/path/to/repo', 'env-1');

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });
  });

  describe('getBranches', () => {
    it('should get branches successfully', async () => {
      const mockBranches = [
        { name: 'main', isDefault: true, isRemote: false },
        { name: 'develop', isDefault: false, isRemote: false },
      ];
      const mockAdapter = {
        gitGetBranches: vi.fn().mockResolvedValue(mockBranches),
      };
      mockAdapterFactory.getAdapter.mockResolvedValue(mockAdapter);

      const result = await service.getBranches('/path/to/repo', 'env-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('main');
    });
  });
});
```

### 2. テスト実行（失敗確認）

```bash
npm test -- remote-repo-service.test.ts
```

### 3. テストコミット

```bash
git add src/services/__tests__/remote-repo-service.test.ts
git commit -m "test: Add tests for RemoteRepoService

- Add URL validation tests
- Add repo name extraction tests
- Add clone tests
- Add pull tests
- Add getBranches tests

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 4. 実装

`src/services/remote-repo-service.ts`を作成：

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/lib/logger';
import type { AdapterFactory } from './adapter-factory';

export interface CloneOptions {
  url: string;
  name?: string;
  environmentId: string;
}

export interface CloneResult {
  success: boolean;
  projectPath?: string;
  projectName?: string;
  error?: string;
}

export interface PullResult {
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

export class RemoteRepoService {
  constructor(private adapterFactory: AdapterFactory) {}

  validateRemoteUrl(url: string): { valid: boolean; error?: string } {
    const sshPattern = /^git@[\w.-]+:[\w-]+\/[\w.-]+\.git$/;
    const httpsPattern = /^https:\/\/[\w.-]+\/[\w-]+\/[\w.-]+\.git$/;

    if (sshPattern.test(url) || httpsPattern.test(url)) {
      return { valid: true };
    }

    return {
      valid: false,
      error: '有効なGitリポジトリURL（git@... または https://...）を入力してください',
    };
  }

  extractRepoName(url: string): string {
    const match = url.match(/\/([^/]+)\.git$/);
    return match ? match[1] : 'repo';
  }

  async clone(options: CloneOptions): Promise<CloneResult> {
    const { url, name, environmentId } = options;

    const validation = this.validateRemoteUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const projectName = name || this.extractRepoName(url);
    const baseDir = path.join(process.cwd(), 'data', 'repos');
    const projectPath = path.join(baseDir, projectName);

    if (fs.existsSync(projectPath)) {
      return {
        success: false,
        error: `ディレクトリ ${projectName} は既に存在します`,
      };
    }

    fs.mkdirSync(projectPath, { recursive: true });

    try {
      const adapter = await this.adapterFactory.getAdapter(environmentId);
      const result = await adapter.gitClone({
        url,
        targetPath: projectPath,
        environmentId,
      });

      if (result.success) {
        return {
          success: true,
          projectPath,
          projectName,
        };
      } else {
        fs.rmSync(projectPath, { recursive: true, force: true });
        return { success: false, error: result.error };
      }
    } catch (error) {
      fs.rmSync(projectPath, { recursive: true, force: true });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async pull(projectPath: string, environmentId: string): Promise<PullResult> {
    try {
      const adapter = await this.adapterFactory.getAdapter(environmentId);
      return await adapter.gitPull(projectPath);
    } catch (error) {
      return {
        success: false,
        updated: false,
        message: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getBranches(projectPath: string, environmentId: string): Promise<Branch[]> {
    try {
      const adapter = await this.adapterFactory.getAdapter(environmentId);
      return await adapter.gitGetBranches(projectPath);
    } catch (error) {
      logger.error('Failed to get branches', { projectPath, error });
      return [];
    }
  }
}
```

### 5. テスト実行（通過確認）

```bash
npm test -- remote-repo-service.test.ts
```

### 6. 実装コミット

```bash
git add src/services/remote-repo-service.ts
git commit -m "feat: Implement RemoteRepoService

- Add URL validation for SSH and HTTPS
- Add repo name extraction from URL
- Add clone method with DockerAdapter integration
- Add pull method
- Add getBranches method
- Add error handling and cleanup

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/services/remote-repo-service.ts`が存在する
- [ ] `validateRemoteUrl()`がSSH/HTTPS URLを検証する
- [ ] `extractRepoName()`がURLからリポジトリ名を抽出する
- [ ] `clone()`がDockerAdapter経由でクローンする
- [ ] `pull()`がDockerAdapter経由でpullする
- [ ] `getBranches()`がDockerAdapter経由でブランチを取得する
- [ ] テストカバレッジが80%以上
- [ ] `npm test`で全テスト通過
- [ ] ESLintエラーがゼロ
- [ ] TypeScriptの型エラーがゼロ

## 依存関係

- TASK-001（DockerAdapter Git操作）

## 推定工数

40分（AIエージェント作業時間）

## ステータス

`TODO`

## 備考

- AdapterFactoryを使用してDockerAdapterを取得
- エラー時はディレクトリをクリーンアップ
- ログは`logger`を使用
