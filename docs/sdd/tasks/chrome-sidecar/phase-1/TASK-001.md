# TASK-001: DBスキーマ拡張 (Sessionテーブル)

## 説明

SessionテーブルにChromeサイドカー関連のカラム (`chrome_container_id`, `chrome_debug_port`) を追加し、Drizzleマイグレーションを生成する。

**対象ファイル**:
- `src/db/schema.ts` - Sessionテーブルにカラム追加
- `drizzle/` - マイグレーションファイル（自動生成）

**設計書**: `docs/sdd/design/chrome-sidecar/components/db-schema.md`

## 技術的文脈

- 既存の `container_id` カラムの直後に配置
- 両カラムともNULL許可（既存レコードとの後方互換性）
- `chrome_container_id`: TEXT型 (`cw-chrome-<session-id>` 形式)
- `chrome_debug_port`: INTEGER型（ホスト側にマッピングされたポート番号）

## TDD手順

### テストファイル

`src/db/__tests__/schema-chrome-sidecar.test.ts`

### テストケース

1. **スキーマ定義の検証**
   - sessions テーブルに `chrome_container_id` カラムが存在すること
   - sessions テーブルに `chrome_debug_port` カラムが存在すること

2. **NULL許可の検証**
   - `chrome_container_id` がNULL状態でレコード挿入できること
   - `chrome_debug_port` がNULL状態でレコード挿入できること

3. **値の設定・取得の検証**
   - `chrome_container_id` に文字列値を設定・取得できること
   - `chrome_debug_port` に整数値を設定・取得できること

4. **既存レコードへの影響なしの検証**
   - chrome関連カラムなしで作成されたセッションの読み取りでNULLが返ること

### 実装手順

1. テストファイル作成・テスト実行（全件RED確認）
2. `src/db/schema.ts` の sessions テーブル定義にカラム追加
3. `npm run db:generate` でマイグレーション生成
4. テスト実行（全件GREEN確認）

## 受入基準

- [ ] `src/db/schema.ts` に `chrome_container_id` (TEXT, NULL許可) が追加されている
- [ ] `src/db/schema.ts` に `chrome_debug_port` (INTEGER, NULL許可) が追加されている
- [ ] `drizzle/` にマイグレーションファイルが生成されている
- [ ] 既存テストが壊れていないこと
- [ ] 新規テストが全てパスすること

**依存関係**: なし
**推定工数**: 20分
**ステータス**: `TODO`
