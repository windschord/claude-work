# 技術設計書: Project-Environment 1対1化

## 概要

ExecutionEnvironment と Project の関係を多対1から1対1に変更する。
各プロジェクトが専用の環境を持つことで、プロジェクトの独立性を高め、設定変更の影響範囲をプロジェクトに限定する。

- 要件定義書: `docs/sdd/requirements/env-project-one-to-one.md`
- 対象ブランチ: `fix/env-project-one-to-one`（予定）

---

## 1. スキーマ変更設計

### 1.1 変更対象テーブル

#### `executionEnvironments` テーブルへの `project_id` 追加

```typescript
// src/db/schema.ts

export const executionEnvironments = sqliteTable('ExecutionEnvironment', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'HOST' | 'DOCKER' | 'SSH'
  description: text('description'),
  config: text('config').notNull(),
  auth_dir_path: text('auth_dir_path'),
  // 追加: プロジェクトとの1対1参照
  project_id: text('project_id').unique().references(() => projects.id, { onDelete: 'cascade' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

**重要**: SQLite の `ALTER TABLE ADD COLUMN` は `NOT NULL` カラムにデフォルト値が必要（または既存レコードへの事前データ移行が必要）。
マイグレーションスクリプトでデータを埋めてから `NOT NULL` 制約を付与する方式を採用する。
Drizzle ORM の `db:push` では直接 `NOT NULL` にできないため、マイグレーションスクリプト内でのみ最終制約を担保する。

#### `projects` テーブルの `environment_id` 変更

```typescript
export const projects = sqliteTable('Project', {
  // ...
  // 変更: set null → cascade、nullable はマイグレーション完了後に notNull() 化
  environment_id: text('environment_id')
    .notNull()  // マイグレーション完了後に追加
    .unique()   // 1対1制約
    .references(() => executionEnvironments.id, { onDelete: 'restrict' }),
  // ...
});
```

**補足**: `onDelete: 'restrict'` とすることで、環境を先に削除してプロジェクトが孤立することを防ぐ。
プロジェクト削除時は `executionEnvironments.project_id` に `onDelete: 'cascade'` があるため環境も連動削除される。

#### `sessions` テーブルの `environment_id` / `docker_mode` 削除

```typescript
export const sessions = sqliteTable('Session', {
  // 削除: environment_id
  // 削除: docker_mode
  // ...
});
```

### 1.2 リレーション定義の更新

```typescript
// projectsRelations
export const projectsRelations = relations(projects, ({ one, many }) => ({
  environment: one(executionEnvironments, {
    fields: [projects.environment_id],
    references: [executionEnvironments.id],
  }),
  sessions: many(sessions),
  scripts: many(runScripts),
  developerSettings: many(developerSettings),
}));

// executionEnvironmentsRelations: 1対1双方向
export const executionEnvironmentsRelations = relations(executionEnvironments, ({ one, many }) => ({
  project: one(projects, {
    fields: [executionEnvironments.project_id],
    references: [projects.id],
  }),
  networkFilterConfig: one(networkFilterConfigs, {
    fields: [executionEnvironments.id],
    references: [networkFilterConfigs.environment_id],
  }),
  networkFilterRules: many(networkFilterRules),
}));

// sessionsRelations: environment参照を削除
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  project: one(projects, {
    fields: [sessions.project_id],
    references: [projects.id],
  }),
  messages: many(messages),
}));
```

### 1.3 型エクスポートの変更

`sessions` テーブルから `environment_id` / `docker_mode` を削除することで、
`Session` 型・`NewSession` 型からこれらのフィールドが自動的に消える。

---

## 2. マイグレーションスクリプト設計

### 2.1 スクリプト概要

- パス: `scripts/migrate-env-project-one-to-one.ts`
- 実行方式: `npx tsx scripts/migrate-env-project-one-to-one.ts`
- べき等性: 2回実行しても安全（既に移行済みのレコードをスキップ）

### 2.2 実行順序

```text
1. 前提チェック（DBアクセス確認）
2. トランザクション開始
   2a. executionEnvironments に project_id カラムを追加
       (ALTER TABLE ExecutionEnvironment ADD COLUMN project_id TEXT)
   2b. projects に UNIQUE 制約を追加
       (SQLiteの制約: 既存テーブルへの UNIQUE ADD COLUMN は再作成が必要)
       → 実際には db:push でスキーマを更新後にデータ移行する方式を採用
   2c. 共有環境の検出と複製 (REQ-MIG-001)
   2d. NetworkFilterConfig/Rules の複製 (REQ-MIG-002)
   2e. auth_dir_path / Docker Volume の複製 (REQ-MIG-003)
   2f. 環境未設定プロジェクトへのデフォルト環境作成 (REQ-MIG-004)
   2g. executionEnvironments.project_id の NOT NULL 検証
   2h. sessions テーブルから environment_id / docker_mode を削除
       (SQLiteでは直接 DROP COLUMN が可能: SQLite 3.35.0+)
3. トランザクションコミット
4. Drizzleスキーマとの同期 (db:push)
```

### 2.3 共有環境の検出と複製アルゴリズム

```typescript
// 1. 複数プロジェクトに共有されている環境を検出
const sharedEnvs = db.select({
  environment_id: projects.environment_id,
  count: sql<number>`count(*)`,
}).from(projects)
  .where(isNotNull(projects.environment_id))
  .groupBy(projects.environment_id)
  .having(sql`count(*) > 1`)
  .all();

// 2. 各共有環境について処理
for (const shared of sharedEnvs) {
  const projectsUsingEnv = db.select()
    .from(projects)
    .where(eq(projects.environment_id, shared.environment_id))
    .all();

  const originalEnv = db.select()
    .from(executionEnvironments)
    .where(eq(executionEnvironments.id, shared.environment_id))
    .get();

  // 最初のプロジェクトは元の環境をそのまま使用（project_id を設定）
  // 残りのプロジェクトには複製した環境を作成
  let firstProject = true;
  for (const project of projectsUsingEnv) {
    if (firstProject) {
      // 元の環境の project_id を設定
      db.update(executionEnvironments)
        .set({ project_id: project.id })
        .where(eq(executionEnvironments.id, shared.environment_id))
        .run();
      firstProject = false;
      continue;
    }

    // 環境を複製
    const newEnvId = crypto.randomUUID();
    db.insert(executionEnvironments).values({
      id: newEnvId,
      name: originalEnv.name,
      type: originalEnv.type,
      description: originalEnv.description,
      config: originalEnv.config,
      auth_dir_path: null, // 後でコピー処理
      project_id: project.id,
    }).run();

    // projects.environment_id を更新
    db.update(projects)
      .set({ environment_id: newEnvId })
      .where(eq(projects.id, project.id))
      .run();

    await cloneNetworkFilter(shared.environment_id, newEnvId);
    await cloneAuthDir(originalEnv, newEnvId);
  }
}
```

### 2.4 NetworkFilterConfig/Rules の複製

```typescript
async function cloneNetworkFilter(
  srcEnvId: string,
  dstEnvId: string
): Promise<void> {
  // NetworkFilterConfig の複製
  const srcConfig = db.select()
    .from(networkFilterConfigs)
    .where(eq(networkFilterConfigs.environment_id, srcEnvId))
    .get();

  if (srcConfig) {
    db.insert(networkFilterConfigs).values({
      environment_id: dstEnvId,
      enabled: srcConfig.enabled,
    }).run();
  }

  // NetworkFilterRules の複製
  const srcRules = db.select()
    .from(networkFilterRules)
    .where(eq(networkFilterRules.environment_id, srcEnvId))
    .all();

  for (const rule of srcRules) {
    db.insert(networkFilterRules).values({
      environment_id: dstEnvId,
      target: rule.target,
      port: rule.port,
      description: rule.description,
      enabled: rule.enabled,
    }).run();
  }
}
```

### 2.5 auth_dir_path ディレクトリのコピー

```typescript
async function cloneAuthDir(
  originalEnv: ExecutionEnvironment,
  newEnvId: string
): Promise<void> {
  if (originalEnv.auth_dir_path) {
    // ホストディレクトリのコピー
    const newAuthDirPath = path.join(getEnvironmentsDir(), newEnvId);
    await fsPromises.cp(originalEnv.auth_dir_path, newAuthDirPath, {
      recursive: true,
    });
    db.update(executionEnvironments)
      .set({ auth_dir_path: newAuthDirPath })
      .where(eq(executionEnvironments.id, newEnvId))
      .run();
  } else if (originalEnv.type === 'DOCKER') {
    // 名前付きVolume使用: 新しい環境ID用のVolumeを作成
    const dockerClient = DockerClient.getInstance();
    const volumes = getConfigVolumeNames(newEnvId);
    await dockerClient.createVolume(volumes.claudeVolume);
    await dockerClient.createVolume(volumes.configClaudeVolume);
  }
}
```

### 2.6 環境未設定プロジェクトへのデフォルト環境作成

```typescript
const nullEnvProjects = db.select()
  .from(projects)
  .where(isNull(projects.environment_id))
  .all();

for (const project of nullEnvProjects) {
  const newEnvId = crypto.randomUUID();
  const defaultConfig = JSON.stringify({
    imageName: 'ghcr.io/windschord/claude-work-sandbox',
    imageTag: 'latest',
  });

  db.insert(executionEnvironments).values({
    id: newEnvId,
    name: `${project.name} 環境`,
    type: 'DOCKER',
    config: defaultConfig,
    project_id: project.id,
  }).run();

  db.update(projects)
    .set({ environment_id: newEnvId })
    .where(eq(projects.id, project.id))
    .run();

  // Docker Volume 作成（ベストエフォート）
  try {
    const dockerClient = DockerClient.getInstance();
    const volumes = getConfigVolumeNames(newEnvId);
    await dockerClient.createVolume(volumes.claudeVolume);
    await dockerClient.createVolume(volumes.configClaudeVolume);
  } catch (error) {
    logger.warn('Failed to create Docker volumes for default environment', {
      projectId: project.id,
      environmentId: newEnvId,
      error,
    });
  }
}
```

### 2.7 トランザクション制御

```typescript
db.transaction((tx) => {
  // 全データ移行処理をトランザクション内で実行
  // エラー発生時は自動ロールバック
});
```

SQLiteの外部リソース（ファイルコピー、Dockerボリューム）はトランザクション外でベストエフォート実行する。
失敗してもDBは整合性を維持する。

---

## 3. API設計

### 3.1 新規エンドポイント: `/api/projects/[project_id]/environment`

現在の `/api/environments/[id]` を `/api/projects/[project_id]/environment` に移動する。
環境を直接IDで操作する代わりに、プロジェクト経由でのみアクセスする。

#### `GET /api/projects/[project_id]/environment`

プロジェクトの環境を取得する。

```
レスポンス:
{
  "environment": {
    "id": "uuid",
    "name": "string",
    "type": "HOST" | "DOCKER" | "SSH",
    "description": "string | null",
    "config": "json-string",
    "auth_dir_path": "string | null",
    "project_id": "uuid",
    "status"?: EnvironmentStatus,
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
エラー:
  404: プロジェクトが見つからない
  404: 環境が設定されていない
```

**クエリパラメータ:**
- `includeStatus=true`: Docker環境の稼働状況（available, authenticated）を追加

#### `PUT /api/projects/[project_id]/environment`

プロジェクトの環境設定（name, description, config, type）を更新する。

```
リクエスト:
{
  "name"?: "string",
  "description"?: "string",
  "type"?: "HOST" | "DOCKER",
  "config"?: { ... }
}

レスポンス:
{
  "environment": { ... },
  "warning"?: "アクティブセッションが存在します。次回セッション起動時に適用されます。"
}

エラー:
  400: name が空文字列
  400: config.skipPermissions が boolean でない
  400: portMappings/volumeMounts バリデーションエラー
  404: プロジェクトが見つからない
```

**type 変更の扱い:**
アクティブセッション（status = running | initializing | waiting_input）が存在する場合でも変更を許可し、
レスポンスに警告メッセージを含める（409 は返さない）。

#### `POST /api/projects/[project_id]/environment/apply`

環境設定変更を実行中セッションに即時適用する（旧 `POST /api/environments/[id]/apply` の移動）。

#### `GET /api/projects/[project_id]/environment/network-filter`

ネットワークフィルター設定を取得する（旧 `GET /api/environments/[id]/network-filter` の移動）。

#### `PUT /api/projects/[project_id]/environment/network-filter`

ネットワークフィルターの有効/無効を切り替える（旧 `PUT /api/environments/[id]/network-filter` の移動）。

#### `GET /api/projects/[project_id]/environment/network-filter/test`

ネットワーク疎通確認（旧 `GET /api/environments/[id]/network-filter/test` の移動）。

#### `GET /api/projects/[project_id]/environment/network-rules`

ネットワークルール一覧取得（旧 `GET /api/environments/[id]/network-rules` の移動）。

#### `POST /api/projects/[project_id]/environment/network-rules`

ネットワークルールを追加する（旧 `POST /api/environments/[id]/network-rules` の移動）。

#### `PUT /api/projects/[project_id]/environment/network-rules/[ruleId]`

ルールを更新する（旧エンドポイントの移動）。

#### `DELETE /api/projects/[project_id]/environment/network-rules/[ruleId]`

ルールを削除する（旧エンドポイントの移動）。

#### `GET /api/projects/[project_id]/environment/network-rules/templates`

デフォルトルールテンプレート取得（旧エンドポイントの移動）。

#### `POST /api/projects/[project_id]/environment/network-rules/templates/apply`

テンプレートをルールとして一括適用（旧エンドポイントの移動）。

#### `GET /api/projects/[project_id]/environment/dockerfile`

Dockerfileのアップロード/取得（旧 `GET|POST /api/environments/[id]/dockerfile` の移動）。

### 3.2 廃止するエンドポイント

以下のエンドポイントは廃止し、新エンドポイントにリダイレクトまたは 410 Gone を返す。

| 旧エンドポイント | 対応方針 |
|---|---|
| `POST /api/environments` | 廃止（410 Gone。プロジェクト作成時に自動作成） |
| `GET /api/environments` | 廃止（410 Gone） |
| `GET /api/environments/[id]` | 後方互換のため `GET /api/projects/[project_id]/environment` にリダイレクトを検討。または廃止。 |
| `PUT /api/environments/[id]` | 廃止 |
| `DELETE /api/environments/[id]` | 廃止（プロジェクト削除時に連動削除） |
| `/api/environments/[id]/...` 全サブルート | 廃止（`/api/projects/[project_id]/environment/...` に移動） |
| `GET /api/environments/check-ports` | 廃止または `/api/projects/[project_id]/environment/check-ports` に移動 |

**移行方針:** 段階的廃止として、まず新エンドポイントを追加し、フロントエンドを切り替え後に旧エンドポイントを削除する。

### 3.3 変更するエンドポイント

#### `POST /api/projects`

`environment_id` パラメータを廃止し、プロジェクト作成時に環境を自動生成する。

```typescript
// 変更前
const { path: projectPath, environment_id } = body;
if (typeof environment_id !== 'string' || environment_id.trim() === '') {
  return NextResponse.json({ error: '実行環境の指定は必須です' }, { status: 400 });
}

// 変更後
const { path: projectPath, environment_config } = body;
// environment_config は任意。未指定時はデフォルト DOCKER 環境を自動作成

// プロジェクト作成後に環境を自動生成
const project = db.insert(schema.projects).values({
  name,
  path: absolutePath,
  clone_location: 'host',
  environment_id: null, // 後で更新
}).returning().get();

const environment = await environmentService.createForProject(project.id, environment_config);

db.update(schema.projects)
  .set({ environment_id: environment.id })
  .where(eq(schema.projects.id, project.id))
  .run();
```

#### `POST /api/projects/clone`

同様に `environment_id` パラメータを廃止し、clone 完了後に環境を自動生成する。

#### `PATCH /api/projects/[project_id]`

`environment_id` 変更制限を撤廃する（1対1構造では environment_id は不変になるため）。
環境設定の変更は新しい `PUT /api/projects/[project_id]/environment` を使用する。
`PATCH` は `claude_code_options`, `custom_env_vars` のみを受け付ける。

#### `POST /api/projects/[project_id]/sessions`

`environment_id` パラメータを無視する（後方互換のためエラーにはしない）。
`sessions` テーブルへの `environment_id` 保存を削除する。

---

## 4. サービス層設計

### 4.1 `environment-service.ts` の変更点

#### `CreateEnvironmentInput` の変更

```typescript
export interface CreateEnvironmentInput {
  name: string;
  type: 'HOST' | 'DOCKER' | 'SSH';
  description?: string;
  config: object;
  project_id: string; // 追加（必須）
}
```

#### `createForProject()` の追加

プロジェクト作成時に呼び出す専用メソッド。DOCKER 環境のデフォルト設定を持つ。

```typescript
async createForProject(
  projectId: string,
  config?: Partial<CreateEnvironmentInput>
): Promise<ExecutionEnvironment> {
  const defaultConfig = {
    imageName: 'ghcr.io/windschord/claude-work-sandbox',
    imageTag: 'latest',
  };

  return this.create({
    name: config?.name ?? `${projectId.slice(0, 8)} 環境`,
    type: config?.type ?? 'DOCKER',
    description: config?.description,
    config: { ...defaultConfig, ...(config?.config ?? {}) },
    project_id: projectId,
  });
}
```

#### `create()` の変更

`project_id` を `executionEnvironments` テーブルに保存する。

```typescript
async create(input: CreateEnvironmentInput): Promise<ExecutionEnvironment> {
  // ...
  const environment = db.insert(schema.executionEnvironments).values({
    name: input.name,
    type: input.type,
    description: input.description,
    config: configJson,
    project_id: input.project_id, // 追加
  }).returning().get();
  // ...
}
```

#### `delete()` の変更

`projects.environment_id` の `onDelete: 'restrict'` により、環境のみの削除は防がれる。
プロジェクト削除時は `executionEnvironments.project_id` の `onDelete: 'cascade'` により環境も削除される。
`delete()` メソッドは内部でのみ使用し、公開 API からの直接呼び出しを廃止する。

#### `findByProjectId()` の追加

```typescript
async findByProjectId(projectId: string): Promise<ExecutionEnvironment | null> {
  const env = db.select()
    .from(schema.executionEnvironments)
    .where(eq(schema.executionEnvironments.project_id, projectId))
    .get();
  return env ?? null;
}
```

#### `update()` の変更: `type` 変更サポート

現在の `update()` は `name`, `description`, `config` のみ受け付ける。
`type` フィールドを追加する。

```typescript
export interface UpdateEnvironmentInput {
  name?: string;
  description?: string;
  config?: object;
  type?: 'HOST' | 'DOCKER' | 'SSH'; // 追加
}
```

### 4.2 `adapter-factory.ts` の環境取得方法変更

現在は `AdapterFactory.getAdapter(environment)` に `ExecutionEnvironment` オブジェクトを渡しているが、
取得元をセッションではなくプロジェクト経由に変更する必要がある。

変更が必要な呼び出し箇所は以下の 2 箇所:

1. `src/lib/websocket/claude-websocket-handler.ts`（または同等のハンドラ）
2. `src/app/api/environments/[id]/apply/route.ts`（新パスに移動後）

変更後の環境取得パターン:

```typescript
// 変更前: session.environment_id から取得
const envId = session.environment_id;

// 変更後: project.environment_id から取得
const project = db.select()
  .from(schema.projects)
  .where(eq(schema.projects.id, session.project_id))
  .get();
const environment = await environmentService.findById(project.environment_id);
const adapter = AdapterFactory.getAdapter(environment);
```

`AdapterFactory` 自体の実装は変更不要。環境オブジェクトを渡す仕組みは現行のままでよい。

### 4.3 セッション作成フロー変更

`src/app/api/projects/[project_id]/sessions/route.ts` の変更:

```typescript
// 変更前
const effectiveEnvironmentId = project.environment_id;
// ...
const newSession = db.insert(schema.sessions).values({
  // ...
  environment_id: effectiveEnvironmentId,  // 削除
  docker_mode: false,                       // 削除
}).returning().get();

// 変更後
const newSession = db.insert(schema.sessions).values({
  project_id,
  name: sessionDisplayName,
  status: 'initializing',
  worktree_path: worktreePath,
  branch_name: branchName,
  claude_code_options: claude_code_options ? JSON.stringify(claude_code_options) : null,
  custom_env_vars: custom_env_vars ? JSON.stringify(custom_env_vars) : null,
}).returning().get();
```

`requestEnvironmentId` のバリデーションと利用コードは削除する（後方互換でリクエストボディに含まれていても無視する）。

### 4.4 `process-lifecycle-manager.ts` の環境参照変更

`processLifecycleManager` が環境を参照している箇所を確認し、
`session.environment_id` ではなく `project.environment_id` から取得するよう変更する。

現行コードでは `ProcessLifecycleManager` は `environmentService` を import しているが、
直接 `session.environment_id` を参照している箇所はないか確認が必要。
WebSocket ハンドラからのアダプター取得が主な変更ポイントとなる。

### 4.5 WebSocket ハンドラの環境参照変更

`src/lib/websocket/claude-websocket-handler.ts`（またはサーバー側の PTY 起動ロジック）で
セッションの `environment_id` を参照している箇所を、プロジェクト経由に変更する。

```typescript
// 環境取得パターン（変更後）
const session = db.select().from(schema.sessions)
  .where(eq(schema.sessions.id, sessionId))
  .get();
const project = db.select().from(schema.projects)
  .where(eq(schema.projects.id, session.project_id))
  .get();
const environment = await environmentService.findById(project.environment_id);
```

---

## 5. UI設計

### 5.1 プロジェクト設定画面の環境セクション

現在の `src/app/settings/environments/page.tsx` を廃止し、
プロジェクト設定画面に環境設定セクションを追加する。

プロジェクト設定画面のパス: `/projects/[project_id]/settings`（またはモーダル）

#### ワイヤーフレーム

```
プロジェクト設定
├── 基本設定セクション
│   ├── プロジェクト名
│   └── パス / リモートURL
│
├── Claude Code オプションセクション
│   ├── モデル設定
│   └── 権限設定
│
└── 実行環境セクション（新規追加）
    ├── 環境タイプ（HOST / DOCKER）ラジオボタン
    │   ├── アクティブセッション存在時の警告:
    │   │   "実行中のセッションがあります。次回のセッション起動時に適用されます。"
    │   └── HOST 環境が Docker コンテナ内で無効な場合はグレーアウト
    │
    ├── [DOCKER の場合] Docker 設定
    │   ├── イメージ名（テキスト入力 or ドロップダウン）
    │   ├── イメージタグ
    │   ├── Skip Permissions チェックボックス
    │   ├── ポートマッピング（PortMappingList コンポーネントを再利用）
    │   └── ボリュームマウント（VolumeMountList コンポーネントを再利用）
    │
    ├── ネットワークフィルター
    │   └── NetworkFilterSection コンポーネントを再利用
    │       ├── 有効/無効トグル
    │       └── ルール一覧（追加・編集・削除）
    │
    ├── [変更あり] "設定を保存" ボタン
    └── [変更あり] "今すぐ適用" ボタン（実行中セッションを再起動）
```

#### コンポーネント構成

```
src/components/projects/
└── ProjectEnvironmentSection.tsx  # 新規作成
    使用する既存コンポーネント:
    - src/components/environments/PortMappingList.tsx
    - src/components/environments/VolumeMountList.tsx
    - src/components/environments/NetworkFilterSection.tsx
    - src/components/environments/ApplyChangesButton.tsx
    - src/components/environments/NetworkRuleForm.tsx
    - src/components/environments/NetworkRuleList.tsx
    - src/components/environments/NetworkTemplateDialog.tsx
```

#### `useProjectEnvironment` フック（新規）

```typescript
// src/hooks/useProjectEnvironment.ts
export function useProjectEnvironment(projectId: string) {
  // GET /api/projects/[projectId]/environment
  const fetchEnvironment = async () => { ... };

  // PUT /api/projects/[projectId]/environment
  const updateEnvironment = async (input: UpdateEnvironmentInput) => { ... };

  // GET /api/projects/[projectId]/environment/network-filter
  // PUT /api/projects/[projectId]/environment/network-filter
  // ルール CRUD ...

  return {
    environment,
    isLoading,
    error,
    warning,  // アクティブセッション存在時の警告メッセージ
    updateEnvironment,
    applyChanges,
    networkFilter,
    updateNetworkFilter,
    networkRules,
    createRule,
    updateRule,
    deleteRule,
  };
}
```

### 5.2 セッション作成フォームの変更

`src/components/sessions/CreateSessionModal.tsx`（または同等のコンポーネント）から
環境選択ドロップダウンを削除する。

```typescript
// 変更前
export interface CreateSessionData {
  name?: string;
  prompt: string;
  dockerMode: boolean;
  environment_id?: string;
}

// 変更後
export interface CreateSessionData {
  name?: string;
  prompt: string;
  source_branch?: string;
  claude_code_options?: object;
  custom_env_vars?: object;
}
```

### 5.3 環境バッジの表示元変更

セッション一覧の環境バッジ（HOST/DOCKER/SSH ラベル）は現在 `session.environment_type`（join結果）を使用している。
変更後は `project.environment.type` から取得する。

`GET /api/projects` のレスポンスで `sessions` に `environment_type` を含める処理は、
プロジェクトの環境から取得するよう変更する（現行と同じロジックを維持）。

```typescript
// src/app/api/projects/route.ts (変更後も同様のjoin)
const allSessions = rawProjects.flatMap((project) =>
  project.sessions.map((session) => ({
    ...session,
    environment_name: project.environment?.name || null,
    environment_type: project.environment?.type || null,
    // environment_id, docker_mode フィールドは削除
  }))
);
```

### 5.4 ナビゲーション変更

#### グローバルナビゲーションから「環境設定」を削除

`src/app/settings/layout.tsx` のナビゲーションリンクから
`/settings/environments` を削除する。

#### `/settings/environments` ページの廃止

- `src/app/settings/environments/page.tsx` を削除または
- リダイレクト（`/settings` へ）に変更

#### プロジェクト作成フォームの変更

`src/components/projects/AddProjectModal.tsx`（または同等）から
「環境を選択」ドロップダウンを削除する。
環境は自動作成されるため、選択は不要。
プロジェクト作成後に設定を変更したい場合は「プロジェクト設定 > 実行環境」から行う旨を説明テキストで表示する。

---

## 6. テスト設計

### 6.1 マイグレーションスクリプトのテスト

**テストファイル:** `scripts/__tests__/migrate-env-project-one-to-one.test.ts`

```typescript
describe('migrate-env-project-one-to-one', () => {
  describe('共有環境の複製', () => {
    it('1つの環境を共有する2プロジェクトに対して、それぞれ独自の環境が作成される', () => {
      // 前提: project_A, project_B が同じ env_1 を共有
      // 期待: 移行後に project_A が env_1 を保持し、project_B が新規 env_2 を持つ
    });

    it('複製された環境の name, type, config が元の環境と一致する', () => { ... });

    it('3プロジェクトが共有する場合、3つの独立した環境が作成される', () => { ... });
  });

  describe('NetworkFilter の複製', () => {
    it('NetworkFilterConfig が複製される', () => { ... });
    it('NetworkFilterRules が全件複製される', () => { ... });
    it('複製されたルールの全フィールドが元と一致する', () => { ... });
  });

  describe('環境未設定プロジェクトへのデフォルト環境作成', () => {
    it('environment_id が null のプロジェクトに DOCKER 環境が作成される', () => { ... });
    it('作成された環境名がプロジェクト名を含む', () => { ... });
  });

  describe('アトミック性', () => {
    it('中断時にロールバックされる', () => { ... });
    it('2回実行してもべき等に動作する', () => { ... });
  });

  describe('マイグレーション後の整合性', () => {
    it('全プロジェクトが有効な environment_id を持つ', () => { ... });
    it('全 executionEnvironments に project_id が設定されている', () => { ... });
    it('project.environment_id と executionEnvironments.project_id が相互参照している', () => { ... });
  });
});
```

### 6.2 API変更のテスト

**テストファイル:**
- `src/app/api/projects/[project_id]/environment/__tests__/route.test.ts`（新規）
- `src/app/api/projects/__tests__/route.test.ts`（既存を更新）
- `src/app/api/projects/clone/__tests__/route.test.ts`（既存を更新）
- `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts`（既存を更新）

```typescript
describe('GET /api/projects/[project_id]/environment', () => {
  it('プロジェクトの環境を返す', () => { ... });
  it('includeStatus=true でステータスを含める', () => { ... });
  it('存在しないプロジェクトで 404 を返す', () => { ... });
});

describe('PUT /api/projects/[project_id]/environment', () => {
  it('name, description, config を更新できる', () => { ... });
  it('type を DOCKER から HOST に変更できる', () => { ... });
  it('アクティブセッションが存在する場合に警告を返す', () => { ... });
  it('config.skipPermissions が boolean でない場合に 400 を返す', () => { ... });
});

describe('POST /api/projects', () => {
  it('environment_id を指定せずにプロジェクトを作成できる', () => { ... });
  it('プロジェクト作成後に DOCKER 環境が自動作成される', () => { ... });
  it('environment_id を指定しても無視される', () => { ... });
});

describe('POST /api/projects/[project_id]/sessions', () => {
  it('environment_id パラメータを無視してプロジェクトの環境を使用する', () => { ... });
  it('セッション作成時に environment_id が sessions テーブルに保存されない', () => { ... });
});
```

### 6.3 サービス層のテスト

**テストファイル:**
- `src/services/__tests__/environment-service.test.ts`（既存を更新）

```typescript
describe('EnvironmentService', () => {
  describe('create()', () => {
    it('project_id なしでは失敗する', () => { ... });
    it('project_id を設定して環境を作成できる', () => { ... });
  });

  describe('createForProject()', () => {
    it('デフォルト DOCKER 設定で環境を作成する', () => { ... });
    it('カスタム config を指定できる', () => { ... });
  });

  describe('findByProjectId()', () => {
    it('プロジェクト ID から環境を取得できる', () => { ... });
    it('存在しないプロジェクト ID で null を返す', () => { ... });
  });

  describe('delete()', () => {
    it('プロジェクトに紐付く環境の直接削除を拒否する（restrict）', () => { ... });
  });
});
```

### 6.4 UI変更のテスト

**テストファイル:**
- `src/components/projects/__tests__/ProjectEnvironmentSection.test.tsx`（新規）
- `src/components/sessions/__tests__/CreateSessionModal.test.tsx`（既存を更新）

```typescript
describe('ProjectEnvironmentSection', () => {
  it('環境タイプ選択のラジオボタンが表示される', () => { ... });
  it('DOCKER 選択時に Docker 設定フィールドが表示される', () => { ... });
  it('アクティブセッション存在時に警告メッセージが表示される', () => { ... });
  it('type を変更してもエラーにならない', () => { ... });
  it('NetworkFilterSection が表示される', () => { ... });
});

describe('CreateSessionModal', () => {
  it('環境選択ドロップダウンが表示されない', () => { ... });
  it('送信データに environment_id が含まれない', () => { ... });
});
```

---

## 7. 実装上の注意点

### 7.1 循環参照の回避

`projects.environment_id` → `executionEnvironments` 参照と
`executionEnvironments.project_id` → `projects` 参照は循環参照になる。

SQLite は循環 FK を許容するが、Drizzle ORM の型推論では問題が生じる可能性がある。
`projects` と `executionEnvironments` の定義順序に注意が必要。

**対処方針:** `executionEnvironments` テーブルの `project_id` FK はスキーマ定義上は
`sql` ヘルパーを使った遅延参照を検討するか、
あるいは Drizzle ORM のドキュメントに従い前方参照を使用する。

### 7.2 プロジェクト削除時のカスケード

`projects` 削除時のカスケード動作:

```
projects (削除)
└── sessions (cascade 削除)
    └── messages (cascade 削除)
└── runScripts (cascade 削除)
└── developerSettings (cascade 削除)
└── executionEnvironments (project_id の cascade 削除)
    └── networkFilterConfigs (cascade 削除)
    └── networkFilterRules (cascade 削除)
    └── auth_dir_path ディレクトリ（ベストエフォート削除）
    └── Docker Volume（ベストエフォート削除）
```

`environmentService.delete()` の外部リソース削除ロジックを
プロジェクト削除 API の DELETE ハンドラで呼び出す（または DB削除フック相当の処理として `DELETE /api/projects/[project_id]` に組み込む）。

### 7.3 `db:push` と マイグレーションスクリプトの実行順序

1. マイグレーションスクリプトを先に実行してデータを整備する
2. その後 `db:push` でスキーマを同期する

または:

1. `db:push` で `project_id` カラム（nullable）を追加する
2. マイグレーションスクリプトでデータを埋める
3. `db:push` で `project_id` を `NOT NULL` + `UNIQUE` に変更する

後者の方が安全。SQLite の制約上、`NOT NULL` への変更はテーブル再作成が必要になるため、
Drizzle ORM がどのように処理するかを事前に検証する。

### 7.4 `sessions.environment_id` / `docker_mode` の削除タイミング

既存セッションのデータ参照に問題がないことを確認してから削除する。
`sessions` テーブルへの `environment_id` 書き込みを先に停止し、
既存レコードへの影響がないことを確認後にカラムを削除する。

---

## 8. 影響ファイル一覧

### 8.1 変更ファイル（主要）

| ファイル | 変更内容 |
|---|---|
| `src/db/schema.ts` | `executionEnvironments` に `project_id` 追加、`projects.environment_id` に `notNull()` / `unique()` 追加、`sessions` から `environment_id` / `docker_mode` 削除、リレーション更新 |
| `src/services/environment-service.ts` | `CreateEnvironmentInput` に `project_id` 追加、`createForProject()` 追加、`findByProjectId()` 追加、`update()` に `type` フィールド追加 |
| `src/app/api/projects/route.ts` | `environment_id` パラメータ廃止、環境自動作成ロジック追加 |
| `src/app/api/projects/clone/route.ts` | `environment_id` パラメータ廃止、環境自動作成ロジック追加 |
| `src/app/api/projects/[project_id]/sessions/route.ts` | `environment_id` パラメータ無視、`sessions` への `environment_id` 保存削除 |
| `src/app/api/projects/[project_id]/route.ts` | `PATCH` から `environment_id` 変更ロジックを削除 |
| `src/store/index.ts` | `Session` 型から `docker_mode` / `environment_id` 削除、`CreateSessionData` から `dockerMode` / `environment_id` 削除 |
| `src/hooks/useEnvironments.ts` | 廃止（`useProjectEnvironment.ts` に置き換え） |
| `src/app/settings/environments/page.tsx` | 廃止またはリダイレクト |
| `src/app/settings/layout.tsx` | 環境設定ナビゲーションを削除 |

### 8.2 新規ファイル

| ファイル | 内容 |
|---|---|
| `src/app/api/projects/[project_id]/environment/route.ts` | 環境取得・更新 API |
| `src/app/api/projects/[project_id]/environment/apply/route.ts` | 即時適用 API |
| `src/app/api/projects/[project_id]/environment/network-filter/route.ts` | ネットワークフィルター API |
| `src/app/api/projects/[project_id]/environment/network-filter/test/route.ts` | ネットワークテスト API |
| `src/app/api/projects/[project_id]/environment/network-rules/route.ts` | ルール一覧・追加 API |
| `src/app/api/projects/[project_id]/environment/network-rules/[ruleId]/route.ts` | ルール更新・削除 API |
| `src/app/api/projects/[project_id]/environment/network-rules/templates/route.ts` | テンプレート取得 API |
| `src/app/api/projects/[project_id]/environment/network-rules/templates/apply/route.ts` | テンプレート一括適用 API |
| `src/app/api/projects/[project_id]/environment/dockerfile/route.ts` | Dockerfile API |
| `src/hooks/useProjectEnvironment.ts` | プロジェクト環境管理フック |
| `src/components/projects/ProjectEnvironmentSection.tsx` | プロジェクト設定の環境セクション |
| `scripts/migrate-env-project-one-to-one.ts` | マイグレーションスクリプト |
