# 要件定義: Project-Environment 1対1化

## 概要

ExecutionEnvironmentとProjectの関係を多対1（1つの環境を複数プロジェクトが共有可能）から
1対1（各プロジェクトが専用の環境を持つ）に変更する。

## 背景

現在の設計では1つのExecutionEnvironmentを複数のプロジェクトで共有できるが、
これによりある環境の設定変更が他のプロジェクトに影響を与えるという問題がある。
また、`sessions.environment_id`が存在することでセッション単位での環境オーバーライドが可能だが、
実際にはプロジェクトの環境が常に使用されるという実装の乖離がある。
プロジェクトと環境を1対1にすることで、プロジェクトの独立性と設定の明確さを高める。

## 確定した方針

1. `sessions.environment_id` を廃止: セッションはプロジェクトの環境を常に継承する
2. 環境管理UIをプロジェクト設定に統合: `/settings/environments` ページは廃止
3. プロジェクト作成時にDOCKER環境を自動作成: デフォルトでDOCKER環境を紐づけ
4. 既存データのマイグレーション: 共有環境はプロジェクトごとに複製

## 現在の構造（変更前）

### スキーマ

- `projects.environment_id`: FK to executionEnvironments（nullable、多対1）
- `sessions.environment_id`: FK to executionEnvironments（nullable、多対1）
- `sessions.docker_mode`: boolean（legacy、廃止予定）
- `executionEnvironments`: 独立テーブル（複数プロジェクトから参照可能）
- `networkFilterConfigs.environment_id`: UNIQUE（1対1）
- `networkFilterRules.environment_id`: 多対1

### リレーション

- Project → Environment: 多対1（複数プロジェクトが1環境を共有）
- Session → Environment: 多対1（セッション独自の環境指定が可能だが実際は未使用）
- Environment → NetworkFilterConfig: 1対1
- Environment → NetworkFilterRules: 1対多

## 変更後の構造

### スキーマ（目標）

- `projects.environment_id`: FK to executionEnvironments（NOT NULL、UNIQUE制約追加）
- `executionEnvironments.project_id`: FK to projects（NOT NULL、UNIQUE制約）
- `sessions.environment_id`: 廃止（列を削除）
- `sessions.docker_mode`: 廃止（列を削除）

### リレーション（目標）

- Project → Environment: 1対1（双方向UNIQUE）
- Session → Environment: プロジェクト経由で間接参照
- Environment → NetworkFilterConfig: 1対1（変更なし）
- Environment → NetworkFilterRules: 1対多（変更なし）

---

## 要件定義

### 1. データモデル変更要件

#### REQ-DM-001: Project-Environment 1対1制約

**WHEN** データモデルの移行が完了したとき、
**THE SYSTEM SHALL** `projects.environment_id` に NOT NULL 制約を適用する。

**WHEN** データモデルの移行が完了したとき、
**THE SYSTEM SHALL** `executionEnvironments` テーブルに `project_id` カラムを追加し、
UNIQUE 制約と NOT NULL 制約を設定する。

**WHILE** システムが稼働している間、
**THE SYSTEM SHALL** 1つのプロジェクトが1つの環境のみに紐付くことを DB レベルで保証する。

受入基準:
- `projects` テーブルの `environment_id` が NOT NULL となっている
- `executionEnvironments` テーブルに `project_id` カラム（UNIQUE, NOT NULL）が存在する
- 異なるプロジェクトが同一の `environment_id` を持つレコードを INSERT しようとすると UNIQUE 制約違反エラーが発生する
- `executionEnvironments` の `project_id` が `NULL` のレコードが存在しない（マイグレーション完了後）

#### REQ-DM-002: sessions.environment_id 廃止

**WHEN** データモデルの移行が完了したとき、
**THE SYSTEM SHALL** `sessions` テーブルから `environment_id` カラムを削除する。

受入基準:
- `sessions` テーブルに `environment_id` カラムが存在しない
- セッション作成 API が `environment_id` パラメータを受け付けなくなっている（無視または 400 エラー）
- 既存のセッションレコードに影響がない

#### REQ-DM-003: sessions.docker_mode 廃止

**WHEN** データモデルの移行が完了したとき、
**THE SYSTEM SHALL** `sessions` テーブルから `docker_mode` カラムを削除する。

受入基準:
- `sessions` テーブルに `docker_mode` カラムが存在しない
- フロントエンドの `Session` 型定義から `docker_mode` フィールドが削除されている

---

### 2. マイグレーション要件

#### REQ-MIG-001: 共有環境の複製

**WHEN** マイグレーションが実行されるとき、
**THE SYSTEM SHALL** 複数のプロジェクトに紐付く環境（共有環境）を、各プロジェクト向けに個別に複製する。

**WHEN** 共有環境を複製するとき、
**THE SYSTEM SHALL** 元の環境の `name`, `type`, `description`, `config` をコピーする。

受入基準:
- マイグレーション後、全プロジェクトがそれぞれ独自の `environment_id` を持つ
- 複製された環境の `name`, `type`, `config` が元の環境と一致する
- 環境を共有していた N 個のプロジェクトに対して N 個の環境レコードが生成される

#### REQ-MIG-002: NetworkFilterConfig/Rules の複製

**WHEN** 共有環境を複製するとき、
**THE SYSTEM SHALL** 元の `networkFilterConfigs` レコードを新しい環境 ID に紐付けて複製する。

**WHEN** 共有環境を複製するとき、
**THE SYSTEM SHALL** 元の `networkFilterRules` レコードをすべて新しい環境 ID に紐付けて複製する。

受入基準:
- 複製後の環境に対応する `networkFilterConfigs` レコードが存在する
- 複製後の環境に対応する `networkFilterRules` レコードが元と同数存在する
- 複製されたルールの `target`, `port`, `description`, `enabled` が元と一致する

#### REQ-MIG-003: auth_dir_path の複製

**WHEN** 共有 DOCKER 環境を複製するとき、
**THE SYSTEM SHALL** 元の `auth_dir_path` ディレクトリを新しい環境 ID のディレクトリにコピーする。

**IF** `auth_dir_path` が NULL（名前付き Volume 使用）の場合、
**THE SYSTEM SHALL** 新しい環境用の設定 Volume を作成する。

受入基準:
- 複製された DOCKER 環境の `auth_dir_path` が独立したディレクトリを指す
- 元の認証ディレクトリと複製先が別パスになっている
- 名前付き Volume 使用時は新しい環境 ID に基づく Volume が作成される

#### REQ-MIG-004: 環境未設定プロジェクトへのデフォルト環境作成

**WHEN** マイグレーションが実行され、`projects.environment_id` が NULL のレコードが存在するとき、
**THE SYSTEM SHALL** 各プロジェクトに対してデフォルトの DOCKER 環境を作成して紐付ける。

受入基準:
- マイグレーション後、`environment_id` が NULL のプロジェクトが存在しない
- 新規作成された環境の `type` が `DOCKER` である
- 新規作成された環境の `name` がプロジェクト名をベースとした一意な名前である

#### REQ-MIG-005: マイグレーションのアトミック性

**WHEN** マイグレーションが実行されるとき、
**THE SYSTEM SHALL** すべての操作をトランザクション内で実行し、エラー発生時は全ての変更をロールバックする。

受入基準:
- マイグレーションが途中でエラーになった場合、DB が変更前の状態に戻る
- マイグレーション完了後のみ UNIQUE 制約が適用される

---

### 3. API 変更要件

#### REQ-API-001: セッション作成 API からの environment_id パラメータ削除

**WHEN** `POST /api/projects/[project_id]/sessions` が呼び出されるとき、
**THE SYSTEM SHALL** リクエストボディの `environment_id` パラメータを無視し、常にプロジェクトの環境を使用する。

**IF** `environment_id` を含むリクエストボディが送信された場合、
**THE SYSTEM SHALL** 400 エラーを返さずにパラメータを無視する（後方互換性のため）。

受入基準:
- セッション作成時に `environment_id` を指定してもプロジェクトの環境が使用される
- セッション作成 API のドキュメントから `environment_id` が削除される
- `sessions` テーブルに `environment_id` が保存されなくなる

#### REQ-API-002: プロジェクト作成時の環境自動作成

**WHEN** `POST /api/projects` または `POST /api/projects/clone` が呼び出されるとき、
**THE SYSTEM SHALL** 指定されたデフォルト設定（DOCKER 環境）で環境を自動作成してプロジェクトに紐付ける。

**IF** リクエストボディに `environment_config` が指定されている場合、
**THE SYSTEM SHALL** そのパラメータを使用して環境を作成する。

受入基準:
- プロジェクト作成 API に `environment_id` パラメータが不要になる
- プロジェクト作成後、プロジェクトに紐付く環境レコードが自動生成される
- 自動生成された環境の `type` がデフォルトで `DOCKER` である

#### REQ-API-003: 環境設定の更新 API

**WHEN** `PATCH /api/projects/[project_id]` で環境設定の変更が要求されるとき、
**THE SYSTEM SHALL** セッション有無に関わらず環境設定を更新できるようにする。

**IF** プロジェクトに紐付く環境の `config` を更新する場合、
**THE SYSTEM SHALL** `PUT /api/environments/[env_id]` を通じて更新するか、
プロジェクト PATCH API に環境設定を渡せるようにする。

受入基準:
- 既存セッションが存在する状態でも環境設定（`config`, `name`, `description`）を変更できる
- 環境 `type` の変更は既存セッションが存在する場合に 409 エラーを返す

#### REQ-API-004: 環境独立管理 API の変更

**WHEN** `/api/environments` エンドポイントが呼び出されるとき、
**THE SYSTEM SHALL** プロジェクトに紐付いた環境の管理専用に制限する。

**THE SYSTEM SHALL NOT** `/api/environments` から独立した（プロジェクト未紐付け）環境の新規作成を許可する。

受入基準:
- `POST /api/environments` はプロジェクト ID の指定なしでは 400 エラーを返す（または廃止）
- `GET /api/environments` にプロジェクト ID フィルタが追加される
- 既存の環境設定 API（ネットワークフィルター等）は引き続き機能する

---

### 4. UI 変更要件

#### REQ-UI-001: /settings/environments ページの廃止

**WHEN** ユーザーが `/settings/environments` にアクセスするとき、
**THE SYSTEM SHALL** プロジェクト設定ページにリダイレクトするか、ページを削除する。

受入基準:
- `/settings/environments` へのアクセスが適切にリダイレクトまたは 404 を返す
- グローバルナビゲーションから「環境設定」メニューが削除される
- `EnvironmentList`, `EnvironmentCard`, `EnvironmentForm` 等の環境一覧コンポーネントが適切に再配置される

#### REQ-UI-002: プロジェクト設定画面への環境設定統合

**WHEN** ユーザーがプロジェクト設定画面を開くとき、
**THE SYSTEM SHALL** そのプロジェクト専用の環境設定（`config`, ネットワークフィルター等）を表示・編集できるようにする。

受入基準:
- プロジェクト設定画面に環境設定セクションが存在する
- 環境 `config`（イメージ名、ポートマッピング、ボリュームマウント）をプロジェクト設定から変更できる
- ネットワークフィルター設定がプロジェクト設定画面から操作できる
- 環境タイプ（DOCKER/HOST）の変更もプロジェクト設定から可能

#### REQ-UI-003: セッション作成フォームから環境選択の削除

**WHEN** ユーザーがセッション作成フォームを開くとき、
**THE SYSTEM SHALL** 環境選択ドロップダウンを表示しない。

受入基準:
- セッション作成フォームに環境選択 UI が存在しない
- セッション一覧の環境バッジは引き続き表示される（プロジェクトの環境情報を参照）
- `CreateSessionData` 型から `environment_id`, `dockerMode` フィールドが削除される

#### REQ-UI-004: プロジェクト作成フォームの変更

**WHEN** ユーザーがプロジェクト追加フォームを開くとき、
**THE SYSTEM SHALL** 環境選択ドロップダウンの代わりに環境設定フォームを表示する（またはデフォルト環境で自動作成する）。

受入基準:
- プロジェクト追加フォームで事前に作成した環境を選択する UI が不要になる
- プロジェクト作成後に環境設定を変更できる UI が提供される

---

### 5. サービス層変更要件

#### REQ-SVC-001: environment-service.ts の変更

**WHEN** `environmentService.create()` が呼び出されるとき、
**THE SYSTEM SHALL** `project_id` パラメータを必須とし、作成された環境を指定プロジェクトに紐付ける。

**WHEN** `environmentService.delete()` が呼び出されるとき、
**THE SYSTEM SHALL** 紐付くプロジェクトも同時に考慮し、プロジェクト削除時に環境も削除する（cascade）。

受入基準:
- `CreateEnvironmentInput` に `project_id` フィールドが追加される
- 環境の `project_id` が `NULL` となるケースが発生しない
- プロジェクト削除時に紐付く環境も自動削除される（または別途削除 API を呼び出す）

#### REQ-SVC-002: adapter-factory.ts の環境取得方法変更

**WHEN** `AdapterFactory.getAdapter()` が呼び出されるとき、
**THE SYSTEM SHALL** セッションのプロジェクトに紐付く環境を使用する。

受入基準:
- アダプター取得時に `session.environment_id` ではなく `project.environment_id` を参照する
- `AdapterFactory` がセッションからプロジェクト経由で環境を解決できる

#### REQ-SVC-003: セッション作成時の環境継承ロジック

**WHEN** セッションが作成されるとき、
**THE SYSTEM SHALL** プロジェクトの `environment_id` を使用して環境を決定する。

**THE SYSTEM SHALL NOT** セッションに環境 ID を保存する。

受入基準:
- セッション作成処理でプロジェクトから環境 ID を取得する実装になっている
- `session.environment_id` への書き込みが発生しない
- `process-lifecycle-manager.ts` 等の環境参照箇所がプロジェクト経由に変更される

#### REQ-SVC-004: server.ts のデフォルト環境作成ロジック削除

**WHEN** サーバーが起動するとき、
**THE SYSTEM SHALL** グローバルなデフォルト環境を自動作成しない。

受入基準:
- `server.ts` にデフォルト環境を作成するコードが存在しない（現在は存在しないことを確認済み）
- プロジェクト作成時に環境が自動作成されるロジックが `project` API に存在する

---

### 6. 非機能要件

#### REQ-NFR-001: 既存データの整合性維持

**WHEN** マイグレーションが実行されるとき、
**THE SYSTEM SHALL** 既存のすべてのプロジェクト・セッション・メッセージデータを保持する。

受入基準:
- マイグレーション前後でプロジェクト数が変わらない
- マイグレーション前後でセッション数が変わらない
- マイグレーション前後でメッセージ数が変わらない
- マイグレーション後に全プロジェクトが有効な環境 ID を持つ

#### REQ-NFR-002: ダウンタイムなしのマイグレーション

**WHEN** マイグレーションが実行されるとき、
**THE SYSTEM SHALL** サーバー起動時の自動マイグレーションスクリプトまたは `db:push` で適用できるようにする。

受入基準:
- マイグレーションが Drizzle ORM の `db:push` または専用スクリプトで実行できる
- マイグレーション実行中にサーバーが停止しない（オフラインマイグレーション手順を文書化する）
- マイグレーション後にサーバーが正常に起動する

#### REQ-NFR-003: 後方互換性の維持期間

**WHILE** 移行期間中、
**THE SYSTEM SHALL** `sessions.environment_id` および `sessions.docker_mode` が NULL または既存値のまま機能し続けることを保証する。

受入基準:
- 旧クライアントがセッション作成時に `environment_id` を送信しても正常に動作する（無視される）
- 移行後も既存セッションのデータが参照可能（アーカイブとして）

---

## 影響範囲

### 変更対象ファイル（主要）

| ファイル | 変更内容 |
|--------|--------|
| `src/db/schema.ts` | `executionEnvironments` に `project_id` 追加、`sessions` から `environment_id`/`docker_mode` 削除、リレーション更新 |
| `src/services/environment-service.ts` | `create()` に `project_id` 必須化、`delete()` をプロジェクト連動に変更 |
| `src/services/adapter-factory.ts` | 環境取得をプロジェクト経由に変更 |
| `src/app/api/projects/route.ts` | プロジェクト作成時の環境自動作成ロジック追加 |
| `src/app/api/projects/clone/route.ts` | クローン時の環境自動作成ロジック追加 |
| `src/app/api/projects/[project_id]/sessions/route.ts` | `environment_id` パラメータの無視、`sessions` への `environment_id` 保存削除 |
| `src/app/api/projects/[project_id]/route.ts` | `environment_id` 変更制限の緩和、環境設定更新 API の拡張 |
| `src/app/api/environments/route.ts` | 独立環境作成の制限 |
| `src/app/settings/environments/page.tsx` | ページ廃止またはリダイレクト |
| `src/store/index.ts` | `CreateSessionData` の `environment_id`/`dockerMode` 削除 |

### 変更対象ファイル（マイグレーション）

| ファイル | 変更内容 |
|--------|--------|
| `src/db/migrations/` | 新規マイグレーションファイル追加 |
| `scripts/migrate-env-project-one-to-one.ts` | 新規マイグレーションスクリプト |

---

## 確定済み事項（追加）

1. **`/api/environments` エンドポイント**: `/api/projects/[id]/environment` 配下に移動。ネットワークフィルター等も `/api/projects/[id]/environment/network-filter` に移動。
2. **プロジェクト設定 UI**: プロジェクト設定画面に「実行環境」セクションを追加。環境タイプ、Docker設定、ネットワークフィルターをまとめて表示。
3. **環境 type 変更の制限**: アクティブセッションが存在する場合も type 変更は許可する。警告メッセージのみ表示。
