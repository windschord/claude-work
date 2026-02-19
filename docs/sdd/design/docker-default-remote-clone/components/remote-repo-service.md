# コンポーネント設計: RemoteRepoService

## 概要

リモートリポジトリ操作を抽象化し、DockerAdapter経由でのクローン、更新、ブランチ取得を提供する。

## 責務

- リモートURLの検証
- リポジトリ名の抽出
- DockerAdapter経由でのクローン実行
- DockerAdapter経由でのpull実行
- DockerAdapter経由でのブランチ取得

## インターフェース

```typescript
// src/services/remote-repo-service.ts

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
  // EnvironmentServiceを通じて環境情報を取得し、AdapterFactory.getAdapter()で静的にアダプターを取得する
  constructor(private environmentService = new EnvironmentService()) {}

  /**
   * リモートURLの検証
   */
  validateRemoteUrl(url: string): { valid: boolean; error?: string } {
    // SSH URL: git@github.com:user/repo.git
    const sshPattern = /^git@[\w.-]+:[\w-]+\/[\w.-]+\.git$/;
    // HTTPS URL: https://github.com/user/repo.git
    const httpsPattern = /^https:\/\/[\w.-]+\/[\w-]+\/[\w.-]+\.git$/;

    if (sshPattern.test(url) || httpsPattern.test(url)) {
      return { valid: true };
    }

    return {
      valid: false,
      error: '有効なGitリポジトリURL（git@... または https://...）を入力してください',
    };
  }

  /**
   * リポジトリ名をURLから抽出
   */
  extractRepoName(url: string): string {
    // git@github.com:user/repo.git -> repo
    // https://github.com/user/repo.git -> repo
    const match = url.match(/\/([^/]+)\.git$/);
    return match ? match[1] : 'repo';
  }

  /**
   * リモートリポジトリをクローン
   */
  async clone(options: CloneOptions): Promise<CloneResult> {
    const { url, name, environmentId } = options;

    // URL検証
    const validation = this.validateRemoteUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // プロジェクト名決定
    const projectName = name || this.extractRepoName(url);

    // クローン先ディレクトリ
    const baseDir = path.join(process.cwd(), 'data', 'repos');
    const projectPath = path.join(baseDir, projectName);

    // ディレクトリの存在確認
    if (fs.existsSync(projectPath)) {
      return {
        success: false,
        error: `ディレクトリ ${projectName} は既に存在します`,
      };
    }

    // ディレクトリ作成
    fs.mkdirSync(projectPath, { recursive: true });

    try {
      // DockerAdapter取得（AdapterFactory.getAdapter()静的メソッドを使用）
      const environment = await this.environmentService.findById(environmentId);
      const { AdapterFactory } = await import('./adapter-factory');
      const adapter = AdapterFactory.getAdapter(environment) as DockerAdapter;

      // クローン実行
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
        // 失敗時はディレクトリを削除
        fs.rmSync(projectPath, { recursive: true, force: true });
        return { success: false, error: result.error };
      }
    } catch (error) {
      // エラー時はディレクトリを削除
      fs.rmSync(projectPath, { recursive: true, force: true });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * リポジトリを更新
   */
  async pull(projectPath: string, environmentId: string): Promise<PullResult> {
    try {
      const environment = await this.environmentService.findById(environmentId);
      const { AdapterFactory } = await import('./adapter-factory');
      const adapter = AdapterFactory.getAdapter(environment) as DockerAdapter;
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

  /**
   * ブランチ一覧を取得
   */
  async getBranches(projectPath: string, environmentId: string): Promise<Branch[]> {
    try {
      const environment = await this.environmentService.findById(environmentId);
      const { AdapterFactory } = await import('./adapter-factory');
      const adapter = AdapterFactory.getAdapter(environment) as DockerAdapter;
      return await adapter.gitGetBranches(projectPath);
    } catch (error) {
      logger.error('Failed to get branches', { projectPath, error });
      return [];
    }
  }
}
```

## 実装詳細

### URL検証ロジック

```typescript
validateRemoteUrl(url: string): { valid: boolean; error?: string } {
  // SSH URL: git@github.com:user/repo.git
  const sshPattern = /^git@[\w.-]+:[\w-]+\/[\w.-]+\.git$/;
  // HTTPS URL: https://github.com/user/repo.git
  const httpsPattern = /^https:\/\/[\w.-]+\/[\w-]+\/[\w.-]+\.git$/;

  if (sshPattern.test(url) || httpsPattern.test(url)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: '有効なGitリポジトリURL（git@... または https://...）を入力してください',
  };
}
```

### リポジトリ名抽出ロジック

```typescript
extractRepoName(url: string): string {
  // git@github.com:user/repo.git -> repo
  // https://github.com/user/repo.git -> repo
  const match = url.match(/\/([^/]+)\.git$/);
  return match ? match[1] : 'repo';
}
```

## エラーハンドリング

| エラー種別 | 原因 | 対応 |
|-----------|------|------|
| 無効なURL | URL形式が不正 | 検証エラーメッセージを返す |
| ディレクトリ存在 | クローン先が既に存在 | エラーメッセージを返す |
| クローン失敗 | DockerAdapterでのクローンエラー | ディレクトリを削除してエラーを返す |

## セキュリティ考慮事項

1. **URL検証**: 正規表現による厳格な検証
2. **パストラバーサル防止**: `data/repos/`配下のみ許可
3. **ディレクトリクリーンアップ**: 失敗時は作成したディレクトリを削除

## テスト要件

### ユニットテスト

- `validateRemoteUrl()`: 有効/無効なURL
- `extractRepoName()`: SSH/HTTPS URL
- `clone()`: 成功、失敗、既存ディレクトリ
- `pull()`: 成功、失敗
- `getBranches()`: 正常取得

## 依存関係

- AdapterFactory
- DockerAdapter（Git操作拡張版）
- fs（Node.js標準ライブラリ）
- path（Node.js標準ライブラリ）

## 備考

- DockerAdapterの抽象化層として機能
- API層から直接呼び出される
- エラーハンドリングとリソース管理を担当
