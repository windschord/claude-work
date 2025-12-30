# タスク: セッション管理機能の改善

## 情報の明確性チェック（全体）

### ユーザーから明示された情報
- セッション削除機能の追加（確認ダイアログあり）
- セッション名自動生成（形容詞+動物名形式）
- セッション名は任意入力、未入力時に自動命名
- 複数セッション作成は不要（単一セッション作成のみ）

### 不明/要確認の情報
| 項目 | 現状の理解 | 確認状況 |
|------|-----------|----------|
| 削除確認ダイアログ | あり | [x] 確認済み |
| 自動生成名形式 | 形容詞+動物名 | [x] 確認済み |
| 名前入力の扱い | 任意入力、未入力時に自動生成 | [x] 確認済み |

## 実装計画

### フェーズ1: セッション名自動生成機能
*推定時間: 40分*

#### タスク1.1: セッション名生成ユーティリティの実装

**説明**:
- 対象ファイルパス: `src/lib/session-name-generator.ts`
- 形容詞+動物名形式のセッション名を生成する関数を実装
- 一意性を保証するための重複チェック機能を実装

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- TypeScript使用
- 参照: なし（新規ファイル）

**実装手順（TDD）**:
1. テスト作成: `src/lib/__tests__/session-name-generator.test.ts`
   - generateSessionName()が正しい形式を返すテスト
   - generateUniqueSessionName()が重複を避けるテスト
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: テストを通過させる
5. 実装コミット

**受入基準**:
- [ ] `src/lib/session-name-generator.ts`が存在する
- [ ] generateSessionName()が「形容詞-動物名」形式の文字列を返す
- [ ] generateUniqueSessionName()が既存名と重複しない名前を返す
- [ ] 形容詞リストが50語以上ある
- [ ] 動物名リストが50語以上ある
- [ ] テストが全て通過する

**依存関係**: なし
**推定工数**: 30分
**ステータス**: `TODO`

---

### フェーズ2: セッション削除UI
*推定時間: 50分*

#### タスク2.1: DeleteSessionDialogコンポーネントの実装

**説明**:
- 対象ファイルパス: `src/components/sessions/DeleteSessionDialog.tsx`
- セッション削除確認ダイアログを実装
- Headless UIのDialogコンポーネントを使用

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- UIライブラリ: Headless UI
- スタイリング: Tailwind CSS
- 参照すべき既存コード: `src/components/git/DeleteWorktreeDialog.tsx`

**実装手順（TDD）**:
1. テスト作成: `src/components/sessions/__tests__/DeleteSessionDialog.test.tsx`
   - ダイアログが正しく表示されるテスト
   - キャンセルボタンでonCancelが呼ばれるテスト
   - 削除ボタンでonConfirmが呼ばれるテスト
   - isDeleting時にボタンが無効化されるテスト
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: テストを通過させる
5. 実装コミット

**受入基準**:
- [ ] `src/components/sessions/DeleteSessionDialog.tsx`が存在する
- [ ] セッション名がダイアログに表示される
- [ ] キャンセルボタンが機能する
- [ ] 削除ボタンが機能する
- [ ] 削除中はローディング表示される
- [ ] テストが全て通過する

**依存関係**: なし
**推定工数**: 30分
**ステータス**: `TODO`

---

#### タスク2.2: SessionCardに削除ボタンを追加

**説明**:
- 対象ファイルパス: `src/components/sessions/SessionCard.tsx`
- セッションカードに削除ボタン（ゴミ箱アイコン）を追加
- DeleteSessionDialogとの連携を実装

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- アイコン: Lucide React（Trash2アイコン）
- 状態管理: Zustand（deleteSessionアクション使用）
- 参照すべき既存コード: `src/components/sessions/SessionCard.tsx`

**実装手順（TDD）**:
1. テスト作成: `src/components/sessions/__tests__/SessionCard.test.tsx`に追加
   - 削除ボタンが表示されるテスト
   - 削除ボタンクリックでダイアログが開くテスト
   - 削除確認でdeleteSessionが呼ばれるテスト
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: テストを通過させる
5. 実装コミット

**受入基準**:
- [ ] SessionCardに削除ボタンが表示される
- [ ] 削除ボタンクリックで確認ダイアログが開く
- [ ] 確認後にセッションが削除される
- [ ] 削除後にセッション一覧が更新される
- [ ] テストが全て通過する

**依存関係**: タスク2.1
**推定工数**: 20分
**ステータス**: `TODO`

---

### フェーズ3: セッション作成UIの簡略化
*推定時間: 40分*

#### タスク3.1: CreateSessionFormの簡略化

**説明**:
- 対象ファイルパス: `src/components/sessions/CreateSessionForm.tsx`
- セッション名入力を任意に変更
- セッション数選択UIを削除
- 名前未入力時に自動生成を適用

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- 状態管理: Zustand
- 参照すべき既存コード: `src/components/sessions/CreateSessionForm.tsx`
- 使用するユーティリティ: `src/lib/session-name-generator.ts`

**実装手順（TDD）**:
1. テスト作成: `src/components/sessions/__tests__/CreateSessionForm.test.tsx`に追加
   - セッション名が任意入力になっているテスト
   - セッション数選択UIが表示されないテスト
   - 名前未入力時に自動生成されるテスト
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: テストを通過させる
5. 実装コミット

**受入基準**:
- [ ] セッション名入力が任意になっている（required属性なし）
- [ ] セッション数選択UIが表示されない
- [ ] 名前未入力で送信時に自動生成された名前が使用される
- [ ] placeholderに「未入力の場合は自動生成」の旨が表示される
- [ ] テストが全て通過する

**依存関係**: タスク1.1
**推定工数**: 25分
**ステータス**: `TODO`

---

#### タスク3.2: セッション作成APIのname任意化

**説明**:
- 対象ファイルパス: `src/app/api/projects/[project_id]/sessions/route.ts`
- nameパラメータを任意に変更
- name未指定時はサーバー側でも自動生成（フォールバック）

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- ORM: Prisma
- 参照すべき既存コード: `src/app/api/projects/[project_id]/sessions/route.ts`

**実装手順（TDD）**:
1. テスト作成: `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts`に追加
   - name未指定でもセッションが作成されるテスト
   - 自動生成された名前がレスポンスに含まれるテスト
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: テストを通過させる
5. 実装コミット

**受入基準**:
- [ ] name未指定でリクエストしてもエラーにならない
- [ ] name未指定時は自動生成された名前でセッションが作成される
- [ ] 既存のname指定リクエストは引き続き動作する
- [ ] テストが全て通過する

**依存関係**: タスク1.1
**推定工数**: 15分
**ステータス**: `TODO`

---

### フェーズ4: 不要コードの削除
*推定時間: 15分*

#### タスク4.1: 複数セッション作成APIの削除

**説明**:
- 対象ファイルパス: `src/app/api/projects/[project_id]/sessions/bulk/route.ts`
- 複数セッション作成APIを削除
- 関連するテストファイルも削除

**技術的文脈**:
- 削除対象: `src/app/api/projects/[project_id]/sessions/bulk/`ディレクトリ全体
- 参照するストアメソッド: createBulkSessions（後で削除）

**実装手順**:
1. APIディレクトリを削除
2. 関連テストを削除
3. コミット

**受入基準**:
- [ ] `src/app/api/projects/[project_id]/sessions/bulk/`が存在しない
- [ ] ビルドが成功する

**依存関係**: なし
**推定工数**: 5分
**ステータス**: `TODO`

---

#### タスク4.2: Zustandストアからcreatebulksessionsを削除

**説明**:
- 対象ファイルパス: `src/store/index.ts`
- createBulkSessionsメソッドを削除

**技術的文脈**:
- 状態管理: Zustand
- 参照すべき既存コード: `src/store/index.ts`

**実装手順**:
1. createBulkSessionsメソッドを削除
2. 型定義からも削除
3. コミット

**受入基準**:
- [ ] createBulkSessionsメソッドが存在しない
- [ ] TypeScriptエラーがない
- [ ] ビルドが成功する

**依存関係**: タスク4.1
**推定工数**: 10分
**ステータス**: `TODO`

---

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - ブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## 実装順序

```text
タスク1.1 (セッション名生成)
    ↓
┌───┴───┐
↓       ↓
タスク2.1   タスク3.1
(削除ダイアログ) (フォーム簡略化)
↓       ↓
タスク2.2   タスク3.2
(カード変更)  (API変更)
    ↓
タスク4.1 (bulk API削除)
    ↓
タスク4.2 (ストア整理)
```

## リスクと軽減策

| リスク | 影響度 | 軽減策 |
|--------|--------|--------|
| 自動生成名の重複 | 低 | 重複チェック＋再生成ロジック |
| 削除操作の誤操作 | 中 | 確認ダイアログで防止 |
| 既存テストの破損 | 中 | 各タスクでテスト更新を含める |
