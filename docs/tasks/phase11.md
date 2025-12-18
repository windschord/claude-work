# フェーズ11: APIレスポンス形式統一とUI不具合修正

推定期間: 120分（AIエージェント作業時間）
MVP: Yes

## 概要

Phase 10マージ後の動作検証で発見された不具合を修正します。
APIレスポンス形式を設計書通りに統一し、ストア実装を修正します。
すべてのタスクはTDD（テスト駆動開発）で実装します。

**参照**: `docs/verification-report-phase10-post-merge.md`

---

## タスク11.1: セッション作成APIレスポンス形式の修正

**優先度**: Critical
**推定工数**: 40分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

POST /api/projects/{project_id}/sessions のレスポンス形式を設計書通りに修正します。

**現在の実装**:
- API（src/app/api/projects/[project_id]/sessions/route.ts:204）は`newSession`オブジェクト自体を返している
- ストア（src/store/index.ts:596-599）は`responseData.session`を期待している
- 結果：`undefined`がsessions配列に追加され、SessionListコンポーネントがクラッシュ

**修正後の動作**:
- APIは`{ session: {...} }`形式を返す（設計書 docs/design.md:466-479 に準拠）
- ストアは正しく`responseData.session`にアクセスできる
- セッション作成後、UIが正常に動作する

### 実装手順（TDD）

1. **テスト作成**: `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts`にテストケースを追加
   - セッション作成成功時のレスポンス形式を検証（`{ session: {...} }`形式）
   - レスポンスに含まれるsessionオブジェクトのフィールドを検証（id, project_id, name, status, model, worktree_path, branch_name, created_at）
   - 既存のテストケースを新しいレスポンス形式に合わせて更新

2. **テスト実行**: テストが失敗することを確認
   ```bash
   npm test -- src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts
   ```

3. **テストコミット**: テストのみをコミット
   ```bash
   git add src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts
   git commit -m "test: セッション作成APIレスポンス形式のテストを追加"
   ```

4. **実装**: `src/app/api/projects/[project_id]/sessions/route.ts`を修正
   - 204行目を修正:
     ```typescript
     // 修正前
     return NextResponse.json(newSession, { status: 201 });

     // 修正後
     return NextResponse.json({ session: newSession }, { status: 201 });
     ```

5. **テスト実行**: すべてのテストが通過することを確認
   ```bash
   npm test
   ```

6. **実装コミット**: 実装をコミット
   ```bash
   git add src/app/api/projects/[project_id]/sessions/route.ts src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts
   git commit -m "fix: セッション作成APIのレスポンス形式を{session: {...}}に修正"
   ```

### 受入基準

- [ ] テストファイルに新しいテストケースが追加されている
- [ ] レスポンス形式が`{ session: {...} }`であることを検証するテストがある
- [ ] テストのみのコミットが存在する
- [ ] src/app/api/projects/[project_id]/sessions/route.ts:204が`{ session: newSession }`を返している
- [ ] すべてのテストが通過する（`npm test`）
- [ ] 実装のコミットが存在する

### 依存関係

なし

---

## タスク11.2: プロジェクト追加APIレスポンス形式の修正

**優先度**: Critical
**推定工数**: 40分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

POST /api/projects のレスポンス形式を設計書通りに修正します。

**現在の実装**:
- API（src/app/api/projects/route.ts:185）は`project`オブジェクト自体を返している
- ストア（src/store/index.ts:472-481）は`data.project`を期待し、存在チェックも行っている
- 結果：プロジェクト追加が失敗する可能性が高い

**修正後の動作**:
- APIは`{ project: {...} }`形式を返す（設計書 docs/design.md:380-392 に準拠）
- ストアは正しく`data.project`にアクセスできる
- プロジェクト追加が正常に動作する

### 実装手順（TDD）

1. **テスト作成**: `src/app/api/projects/__tests__/route.test.ts`にテストケースを追加
   - POST成功時のレスポンス形式を検証（`{ project: {...} }`形式）
   - レスポンスに含まれるprojectオブジェクトのフィールドを検証（id, name, path, default_model, run_scripts, session_count, created_at）

2. **テスト実行**: テストが失敗することを確認
   ```bash
   npm test -- src/app/api/projects/__tests__/route.test.ts
   ```

3. **テストコミット**: テストのみをコミット
   ```bash
   git add src/app/api/projects/__tests__/route.test.ts
   git commit -m "test: プロジェクト追加APIレスポンス形式のテストを追加"
   ```

4. **実装**: `src/app/api/projects/route.ts`を修正
   - 185行目を修正:
     ```typescript
     // 修正前
     return NextResponse.json(project, { status: 201 });

     // 修正後
     return NextResponse.json({ project }, { status: 201 });
     ```

5. **テスト実行**: すべてのテストが通過することを確認
   ```bash
   npm test
   ```

6. **実装コミット**: 実装をコミット
   ```bash
   git add src/app/api/projects/route.ts src/app/api/projects/__tests__/route.test.ts
   git commit -m "fix: プロジェクト追加APIのレスポンス形式を{project: {...}}に修正"
   ```

### 受入基準

- [ ] テストファイルに新しいテストケースが追加されている
- [ ] レスポンス形式が`{ project: {...} }`であることを検証するテストがある
- [ ] テストのみのコミットが存在する
- [ ] src/app/api/projects/route.ts:185が`{ project }`を返している
- [ ] すべてのテストが通過する（`npm test`）
- [ ] 実装のコミットが存在する

### 依存関係

なし

---

## タスク11.3: プロジェクト更新APIレスポンス形式の修正

**優先度**: Critical
**推定工数**: 30分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

PUT /api/projects/{project_id} のレスポンス形式を設計書通りに修正します。

**現在の実装**:
- API（src/app/api/projects/[project_id]/route.ts）のレスポンス形式を確認する必要がある
- ストア（src/store/index.ts:510-515）は`responseData.project`を期待している

**修正後の動作**:
- APIは`{ project: {...} }`形式を返す（設計書 docs/design.md:429-443 に準拠）
- ストアは正しく`responseData.project`にアクセスできる
- プロジェクト更新が正常に動作する

### 実装手順（TDD）

1. **現状確認**: `src/app/api/projects/[project_id]/route.ts`を読んで、PUTハンドラーの実装を確認
   - レスポンス形式を確認
   - 修正が必要かどうかを判断

2. **テスト作成**: `src/app/api/projects/[project_id]/__tests__/route.test.ts`にテストケースを追加
   - PUT成功時のレスポンス形式を検証（`{ project: {...} }`形式）
   - レスポンスに含まれるprojectオブジェクトのフィールドを検証

3. **テスト実行**: テストが失敗することを確認（必要な場合）
   ```bash
   npm test -- src/app/api/projects/[project_id]/__tests__/route.test.ts
   ```

4. **テストコミット**: テストのみをコミット（必要な場合）
   ```bash
   git add src/app/api/projects/[project_id]/__tests__/route.test.ts
   git commit -m "test: プロジェクト更新APIレスポンス形式のテストを追加"
   ```

5. **実装**: `src/app/api/projects/[project_id]/route.ts`を修正（必要な場合）
   - レスポンスを`{ project }`形式に修正

6. **テスト実行**: すべてのテストが通過することを確認
   ```bash
   npm test
   ```

7. **実装コミット**: 実装をコミット（必要な場合）
   ```bash
   git add src/app/api/projects/[project_id]/route.ts src/app/api/projects/[project_id]/__tests__/route.test.ts
   git commit -m "fix: プロジェクト更新APIのレスポンス形式を{project: {...}}に修正"
   ```

### 受入基準

- [ ] `src/app/api/projects/[project_id]/route.ts`のPUTハンドラーを確認済み
- [ ] テストファイルに適切なテストケースが存在する
- [ ] レスポンス形式が`{ project: {...} }`である
- [ ] すべてのテストが通過する（`npm test`）
- [ ] 必要に応じてコミットが存在する

### 依存関係

なし

---

## タスク11.4: ブラウザでの動作確認（セッション作成）

**優先度**: Critical
**推定工数**: 10分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

タスク11.1の修正後、実際にブラウザでセッション作成が正常に動作することを確認します。

### 実装手順

1. **サーバー起動確認**: 開発サーバーが起動していることを確認
   ```bash
   # 必要に応じて
   npm run dev
   ```

2. **ブラウザテスト**: Chrome DevToolsを使ってテスト
   - `http://localhost:3000/`にアクセス
   - ログイン
   - 既存プロジェクトを開く
   - セッション作成フォームに入力:
     - 名前: テストセッション2
     - プロンプト: Hello, Claude! APIレスポンス修正後のテストです。
     - モデル: Auto
     - 作成数: 1
   - 「セッション作成」ボタンをクリック
   - UIがクラッシュしないことを確認
   - セッション一覧に新しいセッションが表示されることを確認

3. **データベース確認**: セッションが正しく作成されているか確認
   ```bash
   sqlite3 prisma/data/claudework.db "SELECT id, name, status FROM Session ORDER BY created_at DESC LIMIT 1;"
   ```

4. **結果記録**: 動作確認結果をコミットメッセージに記録
   ```bash
   git commit --allow-empty -m "verify: セッション作成機能の動作確認完了

ブラウザテスト結果:
- セッション作成フォームから送信成功
- UIクラッシュなし
- セッション一覧に正しく表示される
- データベースにセッションが作成されている

Phase 11タスク11.1, 11.2の修正により、セッション作成機能が正常に動作することを確認。"
   ```

### 受入基準

- [ ] ブラウザでセッション作成フォームにアクセスできる
- [ ] フォーム送信後、UIがクラッシュしない
- [ ] セッション一覧に新しいセッションが表示される
- [ ] データベースにセッションが作成されている（status: running または initializing）
- [ ] 動作確認の結果が記録されている

### 依存関係

- タスク11.1（セッション作成API修正）が完了していること

---

## タスク11.5: Dialogコンポーネントの閉じる動作修正

**優先度**: Medium
**推定工数**: 30分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

プロジェクト追加ダイアログの「キャンセル」ボタンが動作しない問題を修正します。

**現在の動作**:
- 「キャンセル」ボタンをクリックしてもダイアログが閉じない
- Escキーでは閉じることができる

**期待される動作**:
- 「キャンセル」ボタンをクリックするとダイアログが閉じる
- Escキーでも引き続き閉じられる

### 実装手順（TDD）

1. **コンポーネント特定**: プロジェクト追加ダイアログのコンポーネントを特定
   ```bash
   # Dialogコンポーネントを検索
   find src/components -name "*Dialog*" -o -name "*Modal*"
   grep -r "プロジェクト追加" src/components
   ```

2. **テスト作成**: 該当コンポーネントのテストファイルにテストケースを追加
   - 「キャンセル」ボタンをクリックするとonCloseが呼ばれることを検証
   - ダイアログが閉じることを検証

3. **テスト実行**: テストが失敗することを確認
   ```bash
   npm test -- [テストファイルパス]
   ```

4. **テストコミット**: テストのみをコミット
   ```bash
   git add [テストファイルパス]
   git commit -m "test: Dialogの閉じる動作のテストを追加"
   ```

5. **実装**: ダイアログコンポーネントを修正
   - 「キャンセル」ボタンのonClickハンドラーを確認
   - 正しくonCloseが呼ばれるように修正
   - イベントの伝播（propagation）を確認

6. **テスト実行**: すべてのテストが通過することを確認
   ```bash
   npm test
   ```

7. **実装コミット**: 実装をコミット
   ```bash
   git add [コンポーネントファイルパス] [テストファイルパス]
   git commit -m "fix: Dialogのキャンセルボタンが正しく動作するように修正"
   ```

8. **ブラウザ確認**: 実際にブラウザでテスト
   - プロジェクト追加ダイアログを開く
   - 「キャンセル」ボタンをクリック
   - ダイアログが閉じることを確認

### 受入基準

- [ ] プロジェクト追加ダイアログのコンポーネントが特定されている
- [ ] テストファイルに適切なテストケースが追加されている
- [ ] テストのみのコミットが存在する
- [ ] 「キャンセル」ボタンをクリックするとダイアログが閉じる
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ブラウザで動作確認済み
- [ ] 実装のコミットが存在する

### 依存関係

なし

---

## フェーズ完了条件

- [ ] すべてのタスク（11.1〜11.5）が完了している
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ブラウザでセッション作成が正常に動作する
- [ ] ブラウザでプロジェクト追加が正常に動作する（タスク11.2, 11.3の副次的な確認）
- [ ] Dialogの「キャンセル」ボタンが正常に動作する
- [ ] 各タスクのコミットメッセージがConventional Commitsに従っている
- [ ] TDDサイクル（テストコミット→実装コミット）が守られている
- [ ] APIレスポンス形式が設計書（docs/design.md）と一致している

## 備考

### APIレスポンス形式の統一方針

このフェーズでは、APIレスポンス形式を以下のように統一します：

**GETエンドポイント**:
- `{ リソース名（複数形）: [...] }`
- 例: `{ projects: [...] }`, `{ sessions: [...] }`

**POST/PUTエンドポイント**:
- `{ リソース名（単数形）: {...} }`
- 例: `{ project: {...} }`, `{ session: {...} }`

**一括作成エンドポイント**:
- `{ リソース名（複数形）: [...] }`
- 例: `{ sessions: [...] }` (POST /api/projects/{id}/sessions/bulk)

### 優先順位

このフェーズのタスクは以下の優先順位で実装してください：

1. **Critical**: タスク11.1, 11.2, 11.3（APIレスポンス形式修正）- アプリケーションのコア機能が動作しないため最優先
2. **Critical**: タスク11.4（ブラウザ動作確認）- 修正が正しく機能することを確認
3. **Medium**: タスク11.5（Dialog修正）- UX改善

### TDDの重要性

このフェーズではすべてのタスクでTDD（テスト駆動開発）を採用します。
特にAPIレスポンス形式の修正において、テストを先に書くことで：
- レスポンス形式の仕様を明確にできる
- 修正後の回帰を防げる
- 修正の妥当性を検証できる

### 既存テストの更新

タスク11.1と11.2では、既存のテストケースも新しいレスポンス形式に合わせて更新する必要があります。
既存テストが失敗する場合は、レスポンス形式の期待値を修正してください。

### ブラウザでの動作確認

タスク11.4では、Chrome DevToolsを使って実際にブラウザで動作確認を行います。
これにより、API修正がフロントエンドと正しく統合されていることを確認できます。

### Next.js 15の注意点

このプロジェクトはNext.js 15を使用しています。
以下の点に注意してください：

- App Routerを使用している
- `params`は非同期（Promise）として扱う必要がある
- API Routeのテストでは`NextRequest`を使用する
