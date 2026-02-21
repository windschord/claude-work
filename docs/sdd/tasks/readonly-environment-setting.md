# タスク管理書: プロジェクト実行環境の変更禁止

## 関連ドキュメント
- 要件定義: `docs/sdd/requirements/readonly-environment-setting.md`
- 設計書: `docs/sdd/design/readonly-environment-setting.md`

## タスク一覧

### TASK-001: PATCH APIからenvironment_id更新を削除し、claude_code_options/custom_env_vars更新に対応

**ステータス:** completed
**対応要件:** REQ-005, TD-002
**対象ファイル:** `src/app/api/projects/[project_id]/route.ts`

**実装手順:**
1. テスト作成: `src/app/api/projects/[project_id]/__tests__/route.test.ts`
   - PATCH APIがenvironment_idを無視することを確認するテスト
   - PATCH APIがclaude_code_options, custom_env_varsを正しく更新するテスト
2. テスト実行 → 失敗確認
3. PATCH handler実装:
   - `const { environment_id } = body;` → `const { claude_code_options, custom_env_vars } = body;` に変更
   - updateDataの構築: claude_code_options, custom_env_varsのみ更新
   - PUT handlerと同様のバリデーション（claude_code_optionsはobject、custom_env_varsはキー形式チェック）を追加
4. テスト実行 → 成功確認

**受入基準:**
- PATCH APIにenvironment_idを送信しても無視される
- claude_code_optionsとcustom_env_varsが正しく更新される
- バリデーションエラー時に適切なエラーレスポンスが返る

---

### TASK-002: ProjectEnvironmentSettingsを読み取り専用表示に変更

**ステータス:** completed
**対応要件:** REQ-001, REQ-003, REQ-004
**対象ファイル:** `src/components/settings/ProjectEnvironmentSettings.tsx`

**実装手順:**
1. 不要な依存を削除:
   - `useEnvironments` hookのimportと使用を削除
   - `isSaving`, `saveMessage` stateを削除
   - `handleSave` 関数を削除
2. プロジェクト情報の取得を拡張:
   - fetchProjectで取得したデータから`clone_location`, `environment`, `environment_id`を保持
3. UIを読み取り専用に変更:
   - セレクトボックスをテキスト表示に置換
   - 環境タイプに応じたバッジ表示（Docker=青, Host=緑）
   - environment_idが設定されている場合: 環境名(タイプ)
   - environment_idが未設定の場合: clone_locationに基づく自動判定結果
4. 説明メッセージを追加:
   - 「クローン場所（{clone_location}）の設定に基づいて自動的に決定されます。プロジェクト作成後に変更することはできません。」
5. 保存ボタンを削除

**受入基準:**
- セレクトボックスではなくテキストで環境が表示される
- 保存ボタンが存在しない
- clone_locationに応じた正しい環境名が表示される
- 説明メッセージが表示される

---

### TASK-003: ProjectSettingsModalの実行環境セクションを読み取り専用に変更

**ステータス:** completed
**対応要件:** REQ-002, REQ-003, REQ-004
**対象ファイル:** `src/components/projects/ProjectSettingsModal.tsx`

**実装手順:**
1. 不要な依存を削除:
   - `useEnvironments` hookのimportと使用を削除
   - `environmentId` stateは残す（表示用）
2. プロジェクト設定の取得を拡張:
   - `fetchProjectSettings`で`clone_location`, `environment`も取得してstateに保持
3. UIを読み取り専用に変更:
   - セレクトボックス（行305-318）をテキスト表示に置換
   - TASK-002と同様の表示ロジック
   - 説明メッセージを追加
4. 保存処理の修正:
   - `handleSaveAll` からenvironment_id送信を削除（行184）
5. クリーンアップ:
   - `handleClose` からsetEnvironmentId('') を削除

**受入基準:**
- モーダル内でセレクトボックスではなくテキストで環境が表示される
- 保存処理でenvironment_idが送信されない
- clone_locationに応じた正しい環境名が表示される
- 説明メッセージが表示される
