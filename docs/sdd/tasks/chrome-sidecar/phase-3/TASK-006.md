# TASK-006: Session API拡張

## 説明

セッションAPIのレスポンスに `chrome_container_id` と `chrome_debug_port` フィールドを追加する。

**対象ファイル**:
- `src/app/api/sessions/[id]/route.ts` - GET レスポンスにchromeフィールド追加
- `src/app/api/projects/[id]/sessions/route.ts` - GET レスポンスにchromeフィールド追加
- `src/app/api/sessions/__tests__/chrome-sidecar-response.test.ts` - テスト

**設計書**: `docs/sdd/design/chrome-sidecar/api/session-api.md`

## 技術的文脈

- 既存のセッションレスポンスにフィールドを追加するだけの軽微な変更
- DBスキーマにカラムが追加された後、SELECTの結果に自動的に含まれる
- Drizzle ORMの`select()`は明示的にカラムを指定している場合のみ変更が必要
- 現在認証機能が存在しないため、全ユーザーに chrome_debug_port を返す

## TDD手順

### テストファイル

`src/app/api/sessions/__tests__/chrome-sidecar-response.test.ts`

### テストケース

1. **GET /api/sessions/:id - サイドカーあり**
   - chrome_container_id と chrome_debug_port がレスポンスに含まれること
   - 値がDB上の値と一致すること

2. **GET /api/sessions/:id - サイドカーなし**
   - chrome_container_id が null であること
   - chrome_debug_port が null であること

3. **GET /api/projects/:id/sessions - セッション一覧**
   - 各セッションに chrome_container_id, chrome_debug_port が含まれること
   - サイドカーありセッションとなしセッションが混在する場合に正しく返ること

### 実装手順

1. テストファイル作成・テスト実行（RED確認）
2. セッションAPI のレスポンス構築部分を確認
   - Drizzle の select() でカラムが明示的に列挙されている場合は追加
   - `select()` が全カラムの場合は変更不要（スキーマ変更で自動的に含まれる）
3. テスト実行（GREEN確認）

## 受入基準

- [ ] GET /api/sessions/:id のレスポンスに chrome_container_id が含まれること
- [ ] GET /api/sessions/:id のレスポンスに chrome_debug_port が含まれること
- [ ] GET /api/projects/:id/sessions の各セッションにも同様のフィールドが含まれること
- [ ] サイドカーなしセッションでは null が返ること
- [ ] 既存テストが壊れていないこと
- [ ] 全テストケースがパスすること

**依存関係**: TASK-001 (DBスキーマ: chrome_container_id, chrome_debug_port)
**推定工数**: 20分
**ステータス**: `TODO`
