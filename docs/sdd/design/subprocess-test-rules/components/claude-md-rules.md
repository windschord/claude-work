# コンポーネント設計: CLAUDE.md プロセス実行テスト規則

## 概要

プロジェクトのCLAUDE.mdに「プロセス実行のテスト規則」セクションを追加する。

## 対象ファイル

- **変更**: `CLAUDE.md` (プロジェクトルートの方)

## 追加位置

`## React Hooks Usage Guidelines` セクションの前に配置する。

## 追加内容

以下のセクションを追加:

```markdown
## Subprocess Testing Rules

### spawnSync/execSync テストでの cwd・env 検証

- `spawnSync`/`execSync` をモックするテストでは、`cwd` のアサーションを必須とする
- `env` を明示的に渡している場合は、`env` のアサーションも必須とする
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
