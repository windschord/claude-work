# 技術設計: プロジェクト-環境バインディング

## 概要

| 項目 | 内容 |
|------|------|
| フィーチャー名 | project-environment-binding |
| 作成日 | 2026-02-27 |
| ステータス | ACTIVE |

## 背景・目的

現在、セッション作成時に都度実行環境を選択する設計になっているが、実行環境はプロジェクト単位で固定すべき概念である。本フィーチャーでは「プロジェクトに環境を紐付ける」設計に変更し、セッション作成UIを簡素化する。

## アーキテクチャ概要

```text
[プロジェクト作成/編集]
       |
       v
  environment_id (必須)
       |
       v
[セッション作成] --- project.environment_id を直接使用 ---> [Claude PTY起動]
       |
       v
[WebSocket] --- project.environment_id を直接参照 ---> [AdapterFactory]
```

## DB変更

### projects.environment_id

現在の状態:
- nullable（NULL許容）
- onDelete: 'set null'（環境削除時にNULLになる）

変更後の状態:
- アプリレベルで必須バリデーション（SQLite ALTER TABLE制約の制限によりDBレベルではNOT NULL化せず）
- onDelete の物理的なカスケードは変更しないが、アプリレベルでRESTRICT相当チェックを実装

**SQLite制約について:**
SQLiteはALTER TABLE ADD CONSTRAINTに対応していないため、既存カラムへのNOT NULL追加は`db:push`では行わない。代わりに:
1. CREATE API, PATCH APIでのバリデーション必須化
2. 環境削除前のプロジェクト使用チェックでRESTRICT相当を実現

## API変更

### 1. POST /api/projects

`environment_id` を必須パラメータとして追加する。

**リクエスト変更:**

```json
{
  "name": "my-project",
  "path": "/path/to/repo",
  "environment_id": "env-uuid"  // 必須（新規追加）
}
```

**バリデーション:**
- `environment_id` が未指定または空の場合: 400 Bad Request
- `environment_id` が存在しない環境IDの場合: 400 Bad Request

### 2. POST /api/projects/clone

リモートリポジトリのクローン作成時も `environment_id` を必須化する。

**リクエスト変更:**

```json
{
  "name": "my-project",
  "remote_url": "https://github.com/...",
  "environment_id": "env-uuid"  // 必須（新規追加）
}
```

**バリデーション:** POST /api/projects と同様。

### 3. DELETE /api/environments/[id]

環境削除前にプロジェクトで使用中かチェックする。

**変更点:**

```typescript
// 削除前チェック
const usingProjects = await db.select()
  .from(projects)
  .where(eq(projects.environment_id, id));

if (usingProjects.length > 0) {
  return NextResponse.json(
    { error: 'この環境を使用しているプロジェクトが存在します', projects: usingProjects },
    { status: 409 }
  );
}
```

**新しいエラーレスポンス (409 Conflict):**

```json
{
  "error": "この環境を使用しているプロジェクトが存在します",
  "projects": [{ "id": "...", "name": "..." }]
}
```

### 4. PATCH /api/projects/[id]

プロジェクト設定変更で `environment_id` の更新をサポートする。

**変更点:**
- `environment_id` をpatchableフィールドとして追加
- 変更前にセッション数チェック（アクティブセッションが0件の場合のみ変更可）

```typescript
if (body.environment_id !== undefined) {
  // アクティブセッション数チェック
  const activeSessions = await db.select()
    .from(sessions)
    .where(and(
      eq(sessions.project_id, id),
      ne(sessions.status, 'deleted')
    ));

  if (activeSessions.length > 0) {
    return NextResponse.json(
      { error: 'セッションが存在するプロジェクトの環境は変更できません' },
      { status: 409 }
    );
  }

  updateData.environment_id = body.environment_id;
}
```

**新しいエラーレスポンス (409 Conflict):**

```json
{
  "error": "セッションが存在するプロジェクトの環境は変更できません"
}
```

### 5. POST /api/projects/[id]/sessions

セッション作成時に `environment_id` パラメータを無視し、`project.environment_id` を使用する。

**変更点:**

```typescript
// 変更前: リクエストボディの environment_id を使用
const effectiveEnvironmentId = body.environment_id ?? project.default_environment_id;

// 変更後: プロジェクトの environment_id を直接使用
const environmentId = project.environment_id;
if (!environmentId) {
  // レガシーフォールバック（後方互換性）:
  // environment_id未設定の既存プロジェクトはclone_locationに基づいて環境を自動選択
  // - clone_location === 'docker': デフォルトのDocker環境を使用
  // - dockerMode=true（非推奨パラメータ）: レガシーDockerモードで動作
  // 新規プロジェクトはすべてenvironment_idが必須のため、このパスは既存データのみ
  return NextResponse.json(
    { error: 'プロジェクトに環境が設定されていません' },
    { status: 400 }
  );
}
```

### 6. WebSocket (claude-ws.ts)

WebSocket接続時の環境解決をプロジェクト直参照に簡素化する。

**変更点:**

```typescript
// 変更前: セッションの environment_id → フォールバックでプロジェクト
const envId = session.environment_id ?? project.environment_id ?? defaultEnv.id;

// 変更後: プロジェクトの environment_id を直接参照
const envId = project.environment_id;
if (!envId) {
  throw new Error('プロジェクトに環境が設定されていません');
}
```

## UI変更

### 1. AddProjectModal

プロジェクト作成フォームに環境選択ドロップダウンを追加する。

**変更点:**
- `useEnvironments` hookを利用して環境一覧を取得
- ドロップダウンでデフォルト環境を初期選択
- 送信時に `environment_id` を含める

**コンポーネント構成:**

```tsx
<EnvironmentSelector
  environments={environments}
  value={selectedEnvironmentId}
  onChange={setSelectedEnvironmentId}
  required
/>
```

### 2. RemoteRepoForm

リモートリポジトリクローンフォームに環境選択パラメータを追加する。

**変更点:**
- `AddProjectModal` と同様の `EnvironmentSelector` を追加
- クローンAPIリクエストに `environment_id` を含める

### 3. CreateSessionModal

セッション作成モーダルから環境選択UIを削除し、プロジェクトの環境名を表示のみにする。

**変更点（削除）:**
- 環境選択RadioGroup/ドロップダウンを削除

**変更点（追加）:**
- プロジェクトに紐付いた環境名の表示

```tsx
// 環境選択UI → 表示のみに変更
<div className="text-sm text-gray-500">
  実行環境: <span className="font-medium">{project.environment?.name}</span>
</div>
```

### 4. ProjectEnvironmentSettings

プロジェクト設定画面で環境変更ボタンを条件付きで表示する。

**変更点:**
- セッション数が0件の場合のみ「環境を変更」ボタンを表示
- セッションが存在する場合は変更不可の旨を表示

```tsx
{activeSessions.length === 0 ? (
  <Button onClick={handleChangeEnvironment}>環境を変更</Button>
) : (
  <p className="text-sm text-gray-500">
    セッションが存在するため環境を変更できません
  </p>
)}
```

### 5. EnvironmentList / EnvironmentCard

使用中の環境の削除ボタンを無効化する。

**変更点:**
- 各環境について使用中プロジェクト数を取得
- 使用中の場合は削除ボタンをdisabledにし、ツールチップで理由を表示

```tsx
<Button
  disabled={environment.project_count > 0}
  title={environment.project_count > 0 ? '使用中のプロジェクトがあるため削除できません' : ''}
  onClick={() => handleDelete(environment.id)}
>
  削除
</Button>
```

## データモデル変更

### 環境一覧APIレスポンス拡張

```json
{
  "environments": [
    {
      "id": "env-uuid",
      "name": "Default Docker",
      "type": "DOCKER",
      "project_count": 3
    }
  ]
}
```

## 変更ファイル一覧

| ファイル | 変更種別 | 説明 |
|---------|---------|------|
| `src/app/api/projects/route.ts` | 変更 | POST: environment_id必須化 |
| `src/app/api/projects/clone/route.ts` | 変更 | POST: environment_id必須化 |
| `src/app/api/environments/[id]/route.ts` | 変更 | DELETE: 使用中チェック追加 |
| `src/app/api/projects/[id]/route.ts` | 変更 | PATCH: environment_id変更サポート |
| `src/app/api/projects/[project_id]/sessions/route.ts` | 変更 | project.environment_id直接使用 |
| `src/lib/websocket/claude-ws.ts` | 変更 | 環境解決簡素化 |
| `src/components/projects/AddProjectModal.tsx` | 変更 | 環境選択ドロップダウン追加 |
| `src/components/projects/RemoteRepoForm.tsx` | 変更 | 環境選択パラメータ追加 |
| `src/components/sessions/CreateSessionModal.tsx` | 変更 | 環境選択UI削除、環境名表示 |
| `src/components/settings/ProjectEnvironmentSettings.tsx` | 変更 | 条件付き変更ボタン追加 |
| `src/components/environments/EnvironmentList.tsx` | 変更 | project_count取得・パススルー |
| `src/components/environments/EnvironmentCard.tsx` | 変更 | 使用中削除ボタン無効化 |
| `src/hooks/useEnvironments.ts` | 変更 | project_countフィールド追加 |
