# 設計: npx GitHub リポジトリ対応

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 情報の明確性チェック

### ユーザーから明示された情報

- [x] 技術スタック: Node.js, npm/npx, TypeScript
- [x] ビルドシステム: npm scripts (`npm run build`)
- [x] テストフレームワーク: Playwright (E2E), Vitest (Unit)
- [x] CLI実装: `src/bin/cli.ts` → `dist/src/bin/cli.js`

### 不明/要確認の情報

なし（すべての情報が明示されている）

---

## アーキテクチャ概要

```text
npx github:user/claude-work 実行フロー:

┌─────────────────────────────────────────────────────────────┐
│  npx github:windschord/claude-work                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. GitHubからリポジトリをclone                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. npm install 実行                                         │
│     └─ prepare スクリプト発火                                │
│        1. npx prisma generate (Prismaクライアント生成)       │
│        2. DATABASE_URL設定 + npm run build                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. package.json の bin 指定に従い CLI 起動                  │
│     └─ dist/src/bin/cli.js                                  │
└─────────────────────────────────────────────────────────────┘
```

## コンポーネント

### コンポーネント1: package.json (prepare スクリプト)

**目的**: GitHubからのインストール時に自動ビルドを実行する

**責務**:
- `npm install` 実行後にPrismaクライアント生成とビルドを自動実行
- CI環境（`npm ci`）でも動作

**変更内容**:
```json
{
  "scripts": {
    "prepare": "npx prisma generate && DATABASE_URL=file:./data/build.db npm run build"
  }
}
```

**明示された情報**:
- prepareスクリプトはnpm install後に自動実行される
- `npx prisma generate` でPrismaクライアントをスキーマから生成
- `DATABASE_URL` をビルド時に設定（Next.jsビルドで環境変数が必要なため）
- `npm run build` で Next.js と TypeScript サーバーの両方をビルド

### コンポーネント2: E2Eテスト (npx動作検証)

**目的**: npxでの動作が設計通りかを検証する

**責務**:
- `npm pack` でtarballを作成
- 一時ディレクトリでtarballからインストール
- CLIコマンドの動作を検証

**テスト対象コマンド**:
- `claude-work help` - ヘルプ表示
- `claude-work start` - サーバー起動
- `claude-work stop` - サーバー停止
- `claude-work status` - 状態確認

**明示された情報**:
- Playwrightを使用したE2Eテスト
- 一時ディレクトリで独立実行

## データフロー

### シーケンス: npx実行からCLI起動まで

```text
User                 npx                  npm                 CLI
  │                   │                    │                   │
  │ npx github:...    │                    │                   │
  │──────────────────>│                    │                   │
  │                   │ git clone          │                   │
  │                   │───────────────────>│                   │
  │                   │                    │                   │
  │                   │ npm install        │                   │
  │                   │───────────────────>│                   │
  │                   │                    │                   │
  │                   │                    │ prepare script    │
  │                   │                    │ 1. prisma generate│
  │                   │                    │ 2. npm run build  │
  │                   │                    │──────────────────>│
  │                   │                    │                   │
  │                   │                    │ build complete    │
  │                   │                    │<──────────────────│
  │                   │                    │                   │
  │                   │ run bin/cli.js     │                   │
  │                   │───────────────────────────────────────>│
  │                   │                    │                   │
  │ CLI output        │                    │                   │
  │<───────────────────────────────────────────────────────────│
```

## 技術的決定事項

### 決定1: prepareスクリプトの使用

**検討した選択肢**:
1. `prepare` スクリプト
   - メリット: npm install時に自動実行、標準的な方法
   - デメリット: 開発中のnpm installでもビルドが走る
2. `prepack` スクリプト
   - メリット: npm pack/publish時のみ実行
   - デメリット: GitHubからのnpxでは実行されない
3. `postinstall` スクリプト
   - メリット: インストール後に実行
   - デメリット: npm公式は依存パッケージのpostinstallを非推奨

**決定**: `prepare` スクリプト

**根拠**:
- GitHubからのnpx実行時にビルドが必要
- npm標準のライフサイクルスクリプトで最も適切
- CI環境（`npm ci`）でも自動実行される

### 決定2: E2Eテストでのnpm pack使用

**検討した選択肢**:
1. `npm pack` + ローカルインストール
   - メリット: 実際のnpx動作に最も近い、GitHubへのpush不要
   - デメリット: テスト実行に時間がかかる
2. `npm link`
   - メリット: セットアップが簡単
   - デメリット: シンボリックリンクなのでnpx動作と異なる
3. 実際のGitHubリポジトリからnpx実行
   - メリット: 完全に本番と同じ
   - デメリット: pushが必要、テストが外部依存

**決定**: `npm pack` + ローカルインストール

**根拠**:
- ローカルで完結し、CI環境でも実行可能
- 実際のnpx動作（tarballからのインストール）を再現
- 外部依存なしで繰り返しテスト可能

## ファイル変更一覧

| ファイル                | 変更内容                         |
| ----------------------- | -------------------------------- |
| `package.json`          | `prepare` スクリプト追加         |
| `e2e/npx-cli.spec.ts`   | npx動作検証E2Eテスト新規作成     |

## テスト戦略

### E2Eテスト構成

```text
e2e/npx-cli.spec.ts
├── describe.serial: npx CLI installation test
│   ├── beforeAll: npm pack → 一時ディレクトリにインストール
│   ├── test: claude-work CLI is installed
│   ├── test: claude-work help shows usage
│   ├── test: claude-work --help shows usage
│   ├── test: claude-work -h shows usage
│   ├── test: claude-work status shows pm2 status
│   ├── test: unknown command exits with error
│   └── afterAll: 一時ディレクトリ削除
```

**注意**: start/stopコマンドのテストはバックグラウンドプロセス管理の複雑さから、このE2Eテストスイートでは除外。

### テスト環境

- 一時ディレクトリ: `os.tmpdir()/claude-work-e2e-{random}`
- タイムアウト: 各テスト300秒（ビルド時間を考慮）
- クリーンアップ: afterAllで確実に削除
