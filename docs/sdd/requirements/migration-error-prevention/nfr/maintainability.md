# 非機能要件: 保守性要件

## 概要

マイグレーションエラー恒久対策における保守性要件を定義します。スキーマ定義の一元化、手動メンテナンスの排除、コード品質の維持を目的とします。

## 保守性要件一覧

### NFR-002: 手動マイグレーション管理の完全廃止

**要件**: `CURRENT_DB_VERSION`による手動マイグレーション管理を完全に廃止しなければならない

**関連ストーリー**: [US-001](../stories/US-001.md) @../stories/US-001.md（スキーママイグレーションの自動化）

**根拠**:
- 手動マイグレーション機構とDrizzle Kitの二重管理が今回のエラー原因
- Single Source of Truthパターンの実現（`src/db/schema.ts`のみが正）
- 開発者の認知負荷削減（「マイグレーション忘れ」の概念自体を排除）

**廃止対象**:

1. **定数**:
   - `CURRENT_DB_VERSION`

2. **関数**:
   - `migrateDatabase()`
   - `createInitialTables()`
   - `addClaudeCodeOptionsColumns()`
   - `createGitHubPATTable()`
   - `safeAddColumn()`

3. **ヘルパー関数**:
   - マイグレーションバージョン比較ロジック
   - 条件付きALTER TABLE実行ロジック

**移行方針**:
- 既存の手動マイグレーション関数はすべて削除（コメントアウトではなく完全削除）
- `drizzle-kit push`に一本化
- `src/db/schema.ts`への変更のみでスキーマ更新が可能

**検証方法**:
- `git grep -i "CURRENT_DB_VERSION"` で残存確認
- `git grep -i "migrateDatabase"` で残存確認
- コードレビューで手動SQL実行箇所がないことを確認

---

### NFR-004: スキーマ検証の読み取り専用原則

**要件**: スキーマ検証は読み取り専用操作であり、データベースを変更してはならない

**関連ストーリー**: [US-002](../stories/US-002.md) @../stories/US-002.md（スキーマ整合性の早期検出）

**根拠**:
- 検証処理の副作用を排除し、冪等性を保証
- 複数プロセスからの並列実行を安全に実現
- ヘルスチェックAPI（US-003）での再利用を可能にする

**許可される操作**:
- `PRAGMA table_info(table_name)` - テーブル構造の取得
- `SELECT name FROM sqlite_master WHERE type='table'` - テーブル一覧の取得
- Drizzleスキーマ定義の読み込み（`getTableName()`, `getTableColumns()`）

**禁止される操作**:
- `ALTER TABLE` - カラムの追加・削除・変更
- `CREATE TABLE` / `DROP TABLE` - テーブルの作成・削除
- `INSERT` / `UPDATE` / `DELETE` - データの変更
- `PRAGMA foreign_keys=ON` 等の設定変更（読み取り専用PRAGMAは許可）

**実装上の注意**:
- `validateSchemaIntegrity()`関数は戻り値でのみ結果を返す
- データベース接続はread-onlyモードで開く必要はない（操作制限のみで十分）
- ログ出力は許可（副作用ではあるが検証外）

**検証方法**:
- ユニットテストで`validateSchemaIntegrity()`実行前後のスキーマが同一であることを確認
- SQLite WALファイルのサイズが変化しないことを確認
- トランザクションログにWRITE操作がないことを確認

---

### NFR-006: コードの可読性と文書化

**要件**: スキーマ関連コードは明確なドキュメントコメントを含み、将来のメンテナンス担当者が理解しやすくなければならない

**関連ストーリー**: すべて（US-001、US-002、US-003）

**根拠**:
- 今回のエラーは「スキーマ管理の仕組みが複雑で理解困難」が一因
- 新規参加者が迅速にオンボーディングできるようにする
- 6ヶ月後の自分自身が理解できるコードを目指す

**文書化要件**:

1. **JSDoc コメント必須**:
   - すべての公開関数に`@param`、`@returns`、`@throws`を記載
   - `syncSchema()`、`validateSchemaIntegrity()`には使用例を含める

2. **READMEへの記載**:
   - スキーマ変更手順を`docs/DATABASE.md`に記載
   - 「スキーマ追加時は`src/db/schema.ts`のみ編集」を明記

3. **エラーメッセージの明確化**:
   - スキーマ不一致時のメッセージに修復手順を含める
   - 「何が問題か」「どう直すか」の両方を提示

**コード例**:
```typescript
/**
 * データベーススキーマを最新状態に同期する
 *
 * src/db/schema.ts の定義に基づき、drizzle-kit push を実行して
 * データベースのスキーマを更新する。
 *
 * @throws {Error} drizzle-kit push が失敗した場合
 *
 * @example
 * ```typescript
 * try {
 *   syncSchema();
 *   console.log('スキーマ同期完了');
 * } catch (error) {
 *   console.error('同期失敗:', error);
 *   process.exit(1);
 * }
 * ```
 */
export function syncSchema(): void {
  // 実装...
}
```

**検証方法**:
- ESLint `jsdoc` プラグインでドキュメントコメントの存在を強制
- レビュー時にドキュメントの正確性を確認
- 新規参加者によるオンボーディングテスト（理解度ヒアリング）

---

## 保守性向上のための追加施策

### コードレビューチェックリスト

- [ ] スキーマ変更は`src/db/schema.ts`のみで行われている
- [ ] 手動SQL実行箇所がない（`db.run()`, `db.exec()`等の直接実行）
- [ ] すべての公開関数にJSDocコメントがある
- [ ] エラーメッセージに修復手順が含まれている
- [ ] ユニットテストでread-only原則が守られている

### 技術的負債の定期レビュー

- 四半期ごとに`src/db/`以下のコードを棚卸し
- 廃止予定の関数が残存していないか確認
- Single Source of Truth原則が守られているか監査

### ドキュメント更新プロセス

- スキーマ変更時は`docs/DATABASE.md`も同時更新
- PRテンプレートに「スキーマ変更時のドキュメント更新」チェック項目を追加
- CI/CDでドキュメントリンク切れをチェック（markdownlint）
