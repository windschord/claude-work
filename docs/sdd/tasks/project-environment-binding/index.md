# タスク: プロジェクト-環境バインディング

## 概要

| 項目 | 内容 |
|------|------|
| フィーチャー名 | project-environment-binding |
| 関連設計 | [design](../../design/project-environment-binding/index.md) |
| 作成日 | 2026-02-27 |

## タスク一覧

### TASK-PEB-001: 環境削除API - プロジェクト使用中チェック

**説明**:
- 対象ファイル: `src/app/api/environments/[id]/route.ts`
- DELETE実行前に、その環境を使用しているプロジェクトが存在する場合は409 Conflictを返す

**実装内容**:
- 削除前にDBでプロジェクト使用チェック
- 使用中の場合: `{ error: "...", projects: [...] }` で409返却

**受入基準**:
- [x] 使用中環境の削除で409が返る
- [x] 未使用環境は正常削除できる
- [x] レスポンスに使用中プロジェクト情報が含まれる

**依存関係**: なし
**ステータス**: `DONE`
**完了サマリー**: DELETE /api/environments/[id] に使用中プロジェクトチェックを追加。使用中の場合は409 Conflictを返す。

---

### TASK-PEB-002: プロジェクト作成API - environment_id必須化

**説明**:
- 対象ファイル:
  - `src/app/api/projects/route.ts`
  - `src/app/api/projects/clone/route.ts`
- POST時に `environment_id` を必須パラメータとして追加

**実装内容**:
- `environment_id` 未指定時: 400 Bad Request
- 存在しない環境ID指定時: 400 Bad Request

**受入基準**:
- [x] environment_id未指定で400が返る
- [x] 無効なenvironment_idで400が返る
- [x] 有効なenvironment_idでプロジェクト作成成功

**依存関係**: TASK-PEB-001
**ステータス**: `DONE`
**完了サマリー**: POST /api/projects と POST /api/projects/clone で environment_id を必須化。バリデーション追加。

---

### TASK-PEB-003: プロジェクト設定API - environment_id変更サポート

**説明**:
- 対象ファイル: `src/app/api/projects/[id]/route.ts`
- PATCH時に `environment_id` の変更をサポート
- アクティブセッションが存在する場合は409を返す

**実装内容**:
- `environment_id` がbodyに含まれる場合、セッション数チェック
- セッションあり: 409 Conflict
- セッションなし: 環境IDを更新

**受入基準**:
- [x] セッションありの状態でのenvironment_id変更が409を返す
- [x] セッションなしの状態でenvironment_id変更が成功する
- [x] 他のフィールドの変更は影響を受けない

**依存関係**: TASK-PEB-002
**ステータス**: `DONE`
**完了サマリー**: PATCH /api/projects/[id] に environment_id 変更サポートを追加。セッション存在チェックあり。

---

### TASK-PEB-004: セッション作成API - 環境決定ロジック簡素化

**説明**:
- 対象ファイル: `src/app/api/projects/[project_id]/sessions/route.ts`
- セッション作成時の環境決定を `project.environment_id` 直参照に変更
- リクエストボディの `environment_id` パラメータを無視

**実装内容**:
- `project.environment_id` を直接使用
- NULLの場合は400エラー

**受入基準**:
- [x] セッション作成がproject.environment_idを使用する
- [x] リクエストのenvironment_idが無視される
- [x] project.environment_idがNULLの場合400が返る

**依存関係**: TASK-PEB-002
**ステータス**: `DONE`
**完了サマリー**: セッション作成APIをproject.environment_id直参照に変更。フォールバックロジックを削除。

---

### TASK-PEB-005: WebSocket環境解決簡素化

**説明**:
- 対象ファイル: `src/lib/websocket/claude-ws.ts`
- WebSocket接続時の環境IDをプロジェクトの `environment_id` から直接取得するよう変更

**実装内容**:
- セッションのenvironment_idフォールバックロジックを削除
- `project.environment_id` を直参照

**受入基準**:
- [x] WebSocket接続がproject.environment_idを使用する
- [x] フォールバックロジックが削除されている
- [x] environment_idがNULLの場合エラーになる

**依存関係**: TASK-PEB-004
**ステータス**: `DONE`
**完了サマリー**: claude-ws.ts の環境解決をproject.environment_id直参照に簡素化。

---

### TASK-PEB-006: UI - プロジェクト作成モーダル環境選択

**説明**:
- 対象ファイル:
  - `src/components/projects/AddProjectModal.tsx`
  - `src/components/projects/RemoteRepoForm.tsx`
- プロジェクト作成フォームに環境選択ドロップダウンを追加

**実装内容**:
- `useEnvironments` hookで環境一覧取得
- デフォルト環境を初期選択
- 送信データに `environment_id` を含める

**受入基準**:
- [x] 環境選択ドロップダウンが表示される
- [x] デフォルト環境が初期選択される
- [x] 送信時にenvironment_idが含まれる
- [x] 環境未選択の場合バリデーションエラーが表示される

**依存関係**: TASK-PEB-002
**ステータス**: `DONE`
**完了サマリー**: AddProjectModalとRemoteRepoFormに環境選択ドロップダウンを追加。useEnvironments hookを利用。

---

### TASK-PEB-007: UI - セッション作成モーダル環境選択削除

**説明**:
- 対象ファイル: `src/components/sessions/CreateSessionModal.tsx`
- セッション作成モーダルから環境選択UIを削除
- プロジェクトに紐付いた環境名のみ表示

**実装内容**:
- 環境選択RadioGroup/ドロップダウンを削除
- プロジェクト環境名を読み取り専用で表示

**受入基準**:
- [x] 環境選択UIが表示されない
- [x] プロジェクトの環境名が表示される
- [x] セッション作成が正常に動作する

**依存関係**: TASK-PEB-004
**ステータス**: `DONE`
**完了サマリー**: CreateSessionModalから環境選択UIを削除。プロジェクト環境名の表示に変更。

---

### TASK-PEB-008: UI - プロジェクト設定画面環境変更

**説明**:
- 対象ファイル: `src/components/settings/ProjectEnvironmentSettings.tsx`
- セッションが0件の場合のみ「環境を変更」ボタンを表示
- セッションが存在する場合は変更不可メッセージを表示

**実装内容**:
- アクティブセッション数を取得
- 0件の場合: 環境変更ボタン表示
- 1件以上の場合: 変更不可の説明テキスト表示

**受入基準**:
- [x] セッションなしの場合に環境変更ボタンが表示される
- [x] セッションありの場合にボタンが非表示になる
- [x] 変更不可の理由が表示される

**依存関係**: TASK-PEB-003
**ステータス**: `DONE`
**完了サマリー**: ProjectEnvironmentSettingsにセッション数チェックを追加。条件付きで変更ボタンを表示。

---

### TASK-PEB-009: UI - 環境管理画面削除ボタン制御

**説明**:
- 対象ファイル:
  - `src/components/environments/EnvironmentList.tsx`
  - `src/components/environments/EnvironmentCard.tsx`
  - `src/hooks/useEnvironments.ts`
- 使用中プロジェクトが存在する環境の削除ボタンを無効化

**実装内容**:
- `GET /api/environments` レスポンスに `usedByProjectCount` を追加（バックエンド対応含む）
- 環境カードで `usedByProjectCount > 0` の場合に削除ボタンをdisabled
- ツールチップで無効理由を表示

**受入基準**:
- [x] 使用中環境の削除ボタンがdisabledになる
- [x] 未使用環境の削除ボタンは通常通り動作する
- [x] 無効理由がツールチップで確認できる

**依存関係**: TASK-PEB-001
**ステータス**: `DONE`
**完了サマリー**: EnvironmentCard/Listに使用中チェックを追加。usedByProjectCountフィールドを利用して削除ボタンを制御。

---

## タスクサマリー

| タスクID | タイトル | 依存 | ステータス |
|---------|---------|------|-----------|
| TASK-PEB-001 | 環境削除API - プロジェクト使用中チェック | - | DONE |
| TASK-PEB-002 | プロジェクト作成API - environment_id必須化 | PEB-001 | DONE |
| TASK-PEB-003 | プロジェクト設定API - environment_id変更サポート | PEB-002 | DONE |
| TASK-PEB-004 | セッション作成API - 環境決定ロジック簡素化 | PEB-002 | DONE |
| TASK-PEB-005 | WebSocket環境解決簡素化 | PEB-004 | DONE |
| TASK-PEB-006 | UI - プロジェクト作成モーダル環境選択 | PEB-002 | DONE |
| TASK-PEB-007 | UI - セッション作成モーダル環境選択削除 | PEB-004 | DONE |
| TASK-PEB-008 | UI - プロジェクト設定画面環境変更 | PEB-003 | DONE |
| TASK-PEB-009 | UI - 環境管理画面削除ボタン制御 | PEB-001 | DONE |

**全タスク: DONE**
