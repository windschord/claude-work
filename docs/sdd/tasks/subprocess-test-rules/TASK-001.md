# TASK-001: CLAUDE.mdにプロセス実行テスト規則を追記

## 概要

CLAUDE.mdに「Subprocess Testing Rules」セクションを追加し、spawnSync/execSyncテスト時のcwd/envアサーション必須ルールとprocess.cwd()使用時のコメント義務を記載する。

## 関連ドキュメント

- 要件: [US-002](../../requirements/subprocess-test-rules/stories/US-002.md), [US-003](../../requirements/subprocess-test-rules/stories/US-003.md)
- 設計: [claude-md-rules](../../design/subprocess-test-rules/components/claude-md-rules.md) @../../design/subprocess-test-rules/components/claude-md-rules.md

## 実装対象ファイル

- **変更**: `CLAUDE.md` (プロジェクトルート)

## 実装手順

1. `CLAUDE.md`を読み込む
2. `## React Hooks Usage Guidelines` セクションの前に以下のセクションを追加:

```markdown
## Subprocess Testing Rules

### spawnSync/execSync テストでの cwd・env 検証

- `spawnSync`/`execSync` をモックするテストでは、`cwd` と `env` のアサーションを必須とする
- `expect.objectContaining()` は省略したキーをスルーするため、重要なオプション（`cwd`, `env`）は明示的に検証すること
- 子プロセスの `cwd` に `process.cwd()` を使う場合は、使用意図を必ずコメントで明記すること。意図が書かれていない `cwd: process.cwd()` はコードレビューで指摘対象とする

#### NG例

\```typescript
expect(mockSpawnSync).toHaveBeenCalledWith('npx', args,
  expect.objectContaining({ stdio: 'inherit' }) // cwd が未検証
);
\```

#### OK例

\```typescript
expect(mockSpawnSync).toHaveBeenCalledWith('npx', args,
  expect.objectContaining({
    stdio: 'inherit',
    cwd: expect.any(String),
    env: expect.objectContaining({ DATABASE_URL: expect.any(String) }),
  })
);
\```

#### process.cwd() 使用時

NG:
\```typescript
const result = spawnSync('cmd', args, {
  cwd: process.cwd(), // 意図不明
});
\```

OK:
\```typescript
// ユーザーの作業ディレクトリで実行する必要がある（相対パスのファイル操作のため）
const result = spawnSync('cmd', args, {
  cwd: process.cwd(),
});
\```
```

## 受入基準

- [x] CLAUDE.mdに「Subprocess Testing Rules」セクションが追加されている
- [x] NG例とOK例がコードブロックで記載されている
- [x] process.cwd()使用時のコメント規則が記載されている
- [x] 既存セクションのフォーマットと統一されている

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | ルール内容、NG/OK例、追加位置 |
| 不明/要確認の情報 | なし |

## 推定工数

10分

## ステータス

DONE
