# DeveloperSettingsPage

## 概要

**目的**: 開発ツール設定のWeb UIを提供

**責務**:
- グローバルGit設定フォームの表示・編集
- プロジェクト別Git設定フォームの表示・編集・削除
- SSH鍵の登録フォーム
- SSH鍵一覧の表示・削除
- フォームバリデーション
- 成功/エラーメッセージの表示

## コンポーネント構成

### ページ構成
- `/settings/developer` - メインページ
- タブUI: グローバル設定 / プロジェクト別設定

### サブコンポーネント
- **DeveloperSettingsForm**: Git設定フォーム
- **SshKeyManager**: SSH鍵管理UI
- **SshKeyUploadForm**: SSH鍵アップロードフォーム
- **SshKeyList**: SSH鍵一覧テーブル

## 状態管理

### Zustand Store
```typescript
interface DeveloperSettingsStore {
  globalSettings: DeveloperSettings | null;
  projectSettings: Record<string, DeveloperSettings>;
  sshKeys: SshKeyPublic[];
  loading: boolean;
  error: string | null;

  fetchGlobalSettings: () => Promise<void>;
  updateGlobalSettings: (data: UpdateSettingsInput) => Promise<void>;
  fetchProjectSettings: (projectId: string) => Promise<void>;
  updateProjectSettings: (projectId: string, data: UpdateSettingsInput) => Promise<void>;
  deleteProjectSettings: (projectId: string) => Promise<void>;
  fetchSshKeys: () => Promise<void>;
  registerSshKey: (data: RegisterKeyInput) => Promise<void>;
  deleteSshKey: (id: string) => Promise<void>;
}
```

## フォームバリデーション

### Git設定
- `git_username`: 1-100文字
- `git_email`: メールアドレス形式（RFC 5322準拠）

### SSH鍵
- `name`: 1-100文字、ユニーク
- `private_key`: 有効なOpenSSH形式
- `public_key`: 任意（秘密鍵から自動生成可能）

## UI/UX

- Tailwind CSS スタイリング
- Headless UI の Tab コンポーネント
- レスポンシブデザイン（モバイル/タブレット/デスクトップ）
- ローディングインジケーター
- 成功/エラーメッセージ（トースト通知）

## 依存関係

- **React**: UIライブラリ
- **Zustand**: 状態管理
- **Headless UI**: UIコンポーネント
- **Tailwind CSS**: スタイリング
- **API Routes**: `/api/developer-settings/*`, `/api/ssh-keys`

## 関連要件

- [US-005](../../requirements/dev-tool-settings/stories/US-005.md): 設定画面 UI の提供
- [NFR-USA-001](../../requirements/dev-tool-settings/nfr/usability.md): 明確なエラーメッセージ
- [NFR-USA-003](../../requirements/dev-tool-settings/nfr/usability.md): レスポンシブデザイン
