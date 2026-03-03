# デフォルト環境概念の廃止 - タスク計画

## タスク一覧

| ID | タスク | ステータス | 依存 |
|----|-------|----------|------|
| TASK-RDE-001 | DBスキーマからis_default削除 | TODO | - |
| TASK-RDE-002 | environment-serviceからデフォルト関連コード削除 | TODO | TASK-RDE-001 |
| TASK-RDE-003 | server.tsからデフォルト環境初期化削除 | TODO | TASK-RDE-002 |
| TASK-RDE-004 | セッション作成APIのフォールバック削除・必須バリデーション | TODO | TASK-RDE-002 |
| TASK-RDE-005 | フロントエンド型定義・UIからis_default削除 | TODO | TASK-RDE-001 |
| TASK-RDE-006 | テストの修正 | TODO | TASK-RDE-001〜005 |

## TASK-RDE-001: DBスキーマからis_default削除

**ファイル:** `src/db/schema.ts`

**手順:**
1. `executionEnvironments`テーブルから`is_default`行を削除
2. `npm run db:push`でスキーマ反映

## TASK-RDE-002: environment-serviceからデフォルト関連コード削除

**ファイル:** `src/services/environment-service.ts`

**手順:**
1. `DEFAULT_HOST_ENVIRONMENT`定数を削除
2. `DEFAULT_DOCKER_ENVIRONMENT`定数を削除
3. `getDefault()`メソッドを削除
4. `ensureDefaultExists()`メソッドを削除
5. `ensureDefaultEnvironment()`メソッドを削除
6. `create()`メソッドから`is_default: false`を削除
7. `delete()`メソッドにセッション使用中チェックを追加
8. 不要になったimport (`and`)を確認して削除

## TASK-RDE-003: server.tsからデフォルト環境初期化削除

**ファイル:** `server.ts`

**手順:**
1. `ensureDefaultExists()`呼び出しとtry-catchブロックを削除（行275-282）

## TASK-RDE-004: セッション作成APIのフォールバック削除

**ファイル:** `src/app/api/projects/[project_id]/sessions/route.ts`

**手順:**
1. `environmentService.getDefault()`を使用するフォールバックロジック（行218-243）を削除
2. `effectiveEnvironmentId`がnullの場合に400エラーを返すバリデーションに置換
3. `environmentService`のimportからgetDefault関連を整理

## TASK-RDE-005: フロントエンド型定義・UIからis_default削除

**ファイル:**
- `src/hooks/useEnvironments.ts`
- `src/components/environments/EnvironmentCard.tsx`
- `src/components/projects/AddProjectModal.tsx`
- `src/components/projects/RemoteRepoForm.tsx`
- `src/components/projects/AddProjectWizard/StepEnvironment.tsx`
- `src/components/sessions/CreateSessionModal.tsx`

**手順:**
1. `Environment`インターフェースから`is_default`削除
2. EnvironmentCard: 「デフォルト」バッジ削除、削除ボタンのis_defaultチェック削除
3. AddProjectModal: `defaultEnvironmentId`ロジック削除
4. RemoteRepoForm: `defaultEnvironmentId`ロジック削除
5. StepEnvironment: デフォルト自動選択削除、`(default)`テキスト削除
6. CreateSessionModal: is_defaultソートロジック削除

## TASK-RDE-006: テストの修正

**ファイル:**
- `src/services/__tests__/environment-service.test.ts`
- `src/components/projects/__tests__/AddProjectModal.test.tsx`
- `src/components/projects/__tests__/RemoteRepoForm.test.tsx`
- `src/components/projects/__tests__/ProjectCard.test.tsx`
- `src/components/projects/AddProjectWizard/__tests__/WizardContainer.test.tsx`

**手順:**
1. モックデータから`is_default`プロパティを削除
2. デフォルト環境関連テストを削除
3. セッション使用中チェックのテストを追加
4. 全テスト実行して確認
