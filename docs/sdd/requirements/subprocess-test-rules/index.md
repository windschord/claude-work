# 要件定義: subprocess テスト検証規則の整備 (Issue #111)

## 概要

PR #110で修正した`syncSchema()`のバグ（systemd実行時に`drizzle-kit push`が設定ファイルを見つけられない）がテストで検知できなかった問題を受け、subprocessの`cwd`/`env`をテストで検証する規則を整備する。

## 背景

- `spawnSync`の`cwd`に`process.cwd()`を使用していたが、systemd実行時はCWDがパッケージ外になるためエラー発生
- テストが`cwd`オプションをアサートしていなかった（`expect.objectContaining()`で省略）
- テスト実行時は`process.cwd()` = プロジェクトルートになるため、バグが再現しない

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス | リンク |
|----|---------|--------|-----------|--------|
| US-001 | subprocessテストでcwd/envアサーションを必須化 | 高 | 未着手 | [詳細](stories/US-001.md) @stories/US-001.md |
| US-002 | CLAUDE.mdにプロセス実行テスト規則を追記 | 高 | 未着手 | [詳細](stories/US-002.md) @stories/US-002.md |
| US-003 | process.cwd()使用時のコメント規則を設定 | 低 | 未着手 | [詳細](stories/US-003.md) @stories/US-003.md |

## 非機能要件

| ID | カテゴリ | リンク |
|----|---------|--------|
| NFR-maintainability | 保守性 | [詳細](nfr/maintainability.md) @nfr/maintainability.md |

## 対象範囲

### 現在のsubprocess使用箇所

| ファイル | 関数 | cwd指定 | テストでのcwdアサーション |
|---------|------|---------|------------------------|
| `src/services/git-service.ts` | 多数のspawnSync | worktreePath等を明示指定 | 統合テスト（実git操作） |
| `src/bin/cli.ts` | spawnSync（build, pm2） | packageRoot等を明示指定 | 要確認 |
| `src/lib/env-validation.ts` | execSync（which） | 未指定（cwdは不要） | cwdアサーションなし |

### スコープ外

- 既存テストの大規模リファクタリング（統合テスト形式のgit-service.test.tsは除外）
- ESLintカスタムルールの実装（将来の拡張として検討）

## 参考

- 修正PR: #110
- Issue: #111
