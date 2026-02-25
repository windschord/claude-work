# 設計: npx 実行時の依存バージョン不整合修正

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 情報の明確性チェック

### ユーザーから明示された情報

- [x] 問題: `npx prisma` がグローバル Prisma 7.x を使用
- [x] 解決策: node_modules 内のバイナリを直接使用

### 不明/要確認の情報

なし

---

## アーキテクチャ概要

```text
修正前:
┌─────────────────────────────────────────────────────────────┐
│  npx prisma generate                                         │
│       ↓                                                      │
│  グローバル Prisma (7.x) を使用 → エラー                     │
└─────────────────────────────────────────────────────────────┘

修正後:
┌─────────────────────────────────────────────────────────────┐
│  node_modules/.bin/prisma generate                           │
│       ↓                                                      │
│  ローカル Prisma (5.22.0) を使用 → 成功                      │
└─────────────────────────────────────────────────────────────┘
```

## コンポーネント

### コンポーネント1: package.json (prepare スクリプト)

**目的**: ビルド時に正しい Prisma バージョンを使用

**変更内容**:
```json
{
  "scripts": {
    "prepare": "prisma generate && DATABASE_URL=file:./data/build.db npm run build"
  }
}
```

**理由**:
- `npx prisma` → `prisma` に変更
- npm scripts 内では node_modules/.bin が PATH に含まれるため、ローカルの prisma が使用される

### コンポーネント2: src/bin/cli.ts

**目的**: CLI 実行時に正しいバイナリを使用

**変更箇所**:

| 行番号 | 変更前                          | 変更後                                      |
|--------|--------------------------------|---------------------------------------------|
| 112    | `npxCmd, ['prisma', ...]`      | node_modules/.bin/prisma を直接実行         |
| 146    | `npxCmd, ['prisma', ...]`      | node_modules/.bin/prisma を直接実行         |
| 258    | `npxCmd, ['pm2', ...]`         | node_modules/.bin/pm2 を直接実行            |
| 280    | `npxCmd, ['pm2', ...]`         | node_modules/.bin/pm2 を直接実行            |
| 301    | `npxCmd, ['pm2', ...]`         | node_modules/.bin/pm2 を直接実行            |
| 319    | `npxCmd, ['pm2', ...]`         | node_modules/.bin/pm2 を直接実行            |
| 331    | `npxCmd, ['pm2', ...]`         | node_modules/.bin/pm2 を直接実行            |

**実装方法**:
```typescript
// ローカルバイナリのパスを解決
const binDir = path.join(projectRoot, 'node_modules', '.bin');
const prismaCmd = path.join(binDir, process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
const pm2Cmd = path.join(binDir, process.platform === 'win32' ? 'pm2.cmd' : 'pm2');
```

## 技術的決定事項

### 決定1: node_modules/.bin の直接参照

**検討した選択肢**:
1. `node_modules/.bin/xxx` を直接参照
   - メリット: 確実にローカルバージョンを使用
   - デメリット: パスが長くなる
2. `npx --no-install xxx`
   - メリット: npx のキャッシュ機能を活用
   - デメリット: 環境によっては動作が不安定

**決定**: `node_modules/.bin` の直接参照

**根拠**:
- 確実性を優先
- プラットフォーム対応（Windows では .cmd ファイル）も容易

## ファイル変更一覧

| ファイル            | 変更内容                                    |
|---------------------|---------------------------------------------|
| `package.json`      | prepare スクリプトで npx を削除             |
| `src/bin/cli.ts`    | npx を node_modules/.bin に置換             |

## テスト戦略

### E2Eテスト

既存の `e2e/npx-cli.spec.ts` で検証:
- tarball からインストール後、CLI が正常動作すること
- Prisma エラーが発生しないこと
