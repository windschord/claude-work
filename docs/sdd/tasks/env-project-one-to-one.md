# タスク計画書: Project-Environment 1対1化

## 概要

ExecutionEnvironment と Project の関係を多対1から1対1に変更する実装タスク計画。

- 要件定義書: `docs/sdd/requirements/env-project-one-to-one.md`
- 技術設計書: `docs/sdd/design/env-project-one-to-one.md`
- 対象ブランチ: `fix/env-project-one-to-one`

## タスク一覧

| ID | タスク名 | ステータス | 依存 |
|---|---|---|---|
| TASK-001 | スキーマ変更: executionEnvironments に project_id 追加 | DONE | なし |
| TASK-002 | マイグレーションスクリプト作成 | DONE | TASK-001 |
| TASK-003 | スキーマ変更: projects/sessions の制約更新・カラム削除 | DONE | TASK-002 |
| TASK-004 | environment-service.ts の拡張 | DONE | TASK-003 |
| TASK-005 | 新規API: /api/projects/[project_id]/environment/* | DONE | TASK-004 |
| TASK-006 | 既存API変更: プロジェクト作成時の環境自動作成 | DONE | TASK-004 |
| TASK-007 | 既存API変更: セッション作成 API の environment_id 廃止 | DONE | TASK-003 |
| TASK-008 | WebSocketハンドラの環境参照をプロジェクト経由に変更 | DONE | TASK-003 |
| TASK-009 | 旧環境 API の廃止（410 Gone）| DONE | TASK-005 |
| TASK-010 | store・型定義の変更 | TODO | TASK-003 |
| TASK-011 | useProjectEnvironment フック作成 | TODO | TASK-005 |
| TASK-012 | ProjectEnvironmentSection コンポーネント作成 | TODO | TASK-011 |
| TASK-013 | セッション作成フォームから環境選択を削除 | TODO | TASK-010 |
| TASK-014 | /settings/environments ページ廃止・ナビゲーション変更 | TODO | TASK-009 |
| TASK-015 | プロジェクト作成フォーム(AddProjectWizard)の変更 | TODO | TASK-006 |
| TASK-016 | 旧コンポーネント・フックの削除 | TODO | TASK-014, TASK-015 |
| TASK-017 | 結合テスト・既存テストの修正 | TODO | TASK-016 |

## フェーズ構成

```
Phase A: スキーマ・マイグレーション (TASK-001 〜 003)
Phase B: サービス層・API (TASK-004 〜 009)
Phase C: フロントエンド (TASK-010 〜 015)
Phase D: クリーンアップ (TASK-016 〜 017)
```

---

## Phase A: スキーマ・マイグレーション

### TASK-001: スキーマ変更 - executionEnvironments に project_id 追加

**ステータス**: DONE

**説明**

`executionEnvironments` テーブルに `project_id` カラムを追加する。
この時点では nullable（NOT NULL 制約なし）で追加する。後続のマイグレーションスクリプト（TASK-002）でデータを埋めてから TASK-003 で制約を強化する。
また、循環参照を避けるため Drizzle ORM の前方参照パターンを使用する。

**依存タスク**: なし

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/db/schema.ts` | 変更 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/db/__tests__/schema-project-id.test.ts (新規)
import { describe, it, expect } from 'vitest';

describe('executionEnvironments schema: project_id カラム追加', () => {
  describe('スキーマ型チェック', () => {
    it('NewExecutionEnvironment 型に project_id フィールドが存在する', () => {
      // 型レベルのチェック（TypeScriptコンパイル通過 = テスト成功）
      const input: import('@/db/schema').NewExecutionEnvironment = {
        name: 'test',
        type: 'DOCKER',
        config: '{}',
        project_id: 'some-project-id',
      };
      expect(input.project_id).toBe('some-project-id');
    });

    it('project_id は nullable である', () => {
      const input: import('@/db/schema').NewExecutionEnvironment = {
        name: 'test',
        type: 'DOCKER',
        config: '{}',
        // project_id を省略可能
      };
      expect(input.project_id).toBeUndefined();
    });
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/db/__tests__/schema-project-id.test.ts
```

3. 実装内容

`src/db/schema.ts` の `executionEnvironments` テーブル定義に以下を追加:

```typescript
// executionEnvironments テーブルに追加
project_id: text('project_id').unique().references((): AnySQLiteColumn => projects.id, { onDelete: 'cascade' }),
```

また、インポートに `AnySQLiteColumn` を追加し、循環参照を解決するため参照を遅延関数として記述する。

`executionEnvironmentsRelations` を更新:
```typescript
export const executionEnvironmentsRelations = relations(executionEnvironments, ({ one, many }) => ({
  project: one(projects, {
    fields: [executionEnvironments.project_id],
    references: [projects.id],
  }),
  networkFilterConfig: one(networkFilterConfigs, { ... }),
  networkFilterRules: many(networkFilterRules),
}));
```

4. テスト再実行と確認

```bash
npx vitest run src/db/__tests__/schema-project-id.test.ts
npm run build:server  # TypeScript 型エラーがないことを確認
```

**受入基準**

- `executionEnvironments` テーブル定義に `project_id` カラムが存在する
- `project_id` は nullable（NOT NULL 制約なし）
- `project_id` に UNIQUE 制約が付与されている
- `project_id` → `projects.id` の外部キー（`onDelete: 'cascade'`）が定義されている
- `executionEnvironmentsRelations` に `project` リレーションが追加されている
- `NewExecutionEnvironment` 型から `project_id` を任意で渡せる（TypeScript 型エラーなし）

**コミットメッセージ案**

```
feat(schema): executionEnvironments に project_id カラムを追加（nullable）

Project-Environment 1対1化の第1ステップとして、executionEnvironments テーブルに
project_id カラムを追加する。この時点では nullable で UNIQUE 制約のみ付与する。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-001
- docs/sdd/design/env-project-one-to-one.md: セクション1.1
```

---

### TASK-002: マイグレーションスクリプト作成

**ステータス**: DONE

**説明**

既存データを1対1構造に移行するスクリプトを作成する。
共有環境の複製、NetworkFilterConfig/Rules の複製、auth_dir_path の複製、
環境未設定プロジェクトへのデフォルト環境作成を担当する。
スクリプトはべき等（2回実行しても安全）に設計する。

**依存タスク**: TASK-001

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `scripts/migrate-env-project-one-to-one.ts` | 新規 |
| `scripts/__tests__/migrate-env-project-one-to-one.test.ts` | 新規 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// scripts/__tests__/migrate-env-project-one-to-one.test.ts (新規)
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

// テスト用のインメモリDBを使用するため、スクリプトをDI可能な形に設計する

describe('migrate-env-project-one-to-one', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    // テーブルスキーマを作成
    setupTestSchema(db);
  });

  describe('共有環境の複製 (REQ-MIG-001)', () => {
    it('1環境を2プロジェクトで共有している場合、それぞれ独立した環境が作成される', async () => {
      // 前提: project_A, project_B が同じ env_1 を共有
      const envId = insertTestEnv(db, { name: 'shared', type: 'DOCKER' });
      const projA = insertTestProject(db, { name: 'A', environment_id: envId });
      const projB = insertTestProject(db, { name: 'B', environment_id: envId });

      await runMigration(db);

      // project_A は env_1 を保持し、project_B は新しい環境を持つ
      const projAAfter = db.prepare('SELECT environment_id FROM Project WHERE id = ?').get(projA) as { environment_id: string };
      const projBAfter = db.prepare('SELECT environment_id FROM Project WHERE id = ?').get(projB) as { environment_id: string };

      expect(projAAfter.environment_id).not.toBeNull();
      expect(projBAfter.environment_id).not.toBeNull();
      expect(projAAfter.environment_id).not.toBe(projBAfter.environment_id);
    });

    it('複製された環境の name, type, config が元の環境と一致する', async () => {
      const envId = insertTestEnv(db, { name: 'original', type: 'DOCKER', config: '{"imageName":"test"}' });
      const projA = insertTestProject(db, { environment_id: envId });
      const projB = insertTestProject(db, { environment_id: envId });

      await runMigration(db);

      const projBEnvId = (db.prepare('SELECT environment_id FROM Project WHERE id = ?').get(projB) as { environment_id: string }).environment_id;
      const clonedEnv = db.prepare('SELECT * FROM ExecutionEnvironment WHERE id = ?').get(projBEnvId) as Record<string, unknown>;

      expect(clonedEnv.name).toBe('original');
      expect(clonedEnv.type).toBe('DOCKER');
      expect(clonedEnv.config).toBe('{"imageName":"test"}');
    });

    it('3プロジェクトが共有する場合、3つの独立した環境が作成される', async () => {
      const envId = insertTestEnv(db, {});
      const projects = [
        insertTestProject(db, { environment_id: envId }),
        insertTestProject(db, { environment_id: envId }),
        insertTestProject(db, { environment_id: envId }),
      ];

      await runMigration(db);

      const envIds = projects.map(pid =>
        (db.prepare('SELECT environment_id FROM Project WHERE id = ?').get(pid) as { environment_id: string }).environment_id
      );
      const uniqueEnvIds = new Set(envIds);
      expect(uniqueEnvIds.size).toBe(3);
    });
  });

  describe('NetworkFilter の複製 (REQ-MIG-002)', () => {
    it('NetworkFilterConfig が複製先にコピーされる', async () => {
      const envId = insertTestEnv(db, {});
      insertNetworkFilterConfig(db, { environment_id: envId, enabled: true });
      const projA = insertTestProject(db, { environment_id: envId });
      const projB = insertTestProject(db, { environment_id: envId });

      await runMigration(db);

      const projBEnvId = getProjectEnvId(db, projB);
      const config = db.prepare('SELECT * FROM NetworkFilterConfig WHERE environment_id = ?').get(projBEnvId);
      expect(config).not.toBeNull();
      expect((config as Record<string, unknown>).enabled).toBe(1);
    });

    it('NetworkFilterRules が全件複製される', async () => {
      const envId = insertTestEnv(db, {});
      insertNetworkFilterConfig(db, { environment_id: envId });
      insertNetworkFilterRule(db, { environment_id: envId, target: 'example.com', port: 443 });
      insertNetworkFilterRule(db, { environment_id: envId, target: '*.github.com', port: null });
      const projA = insertTestProject(db, { environment_id: envId });
      const projB = insertTestProject(db, { environment_id: envId });

      await runMigration(db);

      const projBEnvId = getProjectEnvId(db, projB);
      const rules = db.prepare('SELECT * FROM NetworkFilterRule WHERE environment_id = ?').all(projBEnvId);
      expect(rules.length).toBe(2);
    });

    it('複製されたルールの全フィールドが元と一致する', async () => {
      const envId = insertTestEnv(db, {});
      insertNetworkFilterConfig(db, { environment_id: envId });
      insertNetworkFilterRule(db, {
        environment_id: envId,
        target: 'api.example.com',
        port: 443,
        description: 'Test rule',
        enabled: false,
      });
      const projA = insertTestProject(db, { environment_id: envId });
      const projB = insertTestProject(db, { environment_id: envId });

      await runMigration(db);

      const projBEnvId = getProjectEnvId(db, projB);
      const rule = db.prepare('SELECT * FROM NetworkFilterRule WHERE environment_id = ?').get(projBEnvId) as Record<string, unknown>;
      expect(rule.target).toBe('api.example.com');
      expect(rule.port).toBe(443);
      expect(rule.description).toBe('Test rule');
      expect(rule.enabled).toBe(0); // false
    });
  });

  describe('環境未設定プロジェクトへのデフォルト環境作成 (REQ-MIG-004)', () => {
    it('environment_id が null のプロジェクトに DOCKER 環境が作成される', async () => {
      const proj = insertTestProject(db, { name: 'MyProject', environment_id: null });

      await runMigration(db);

      const projAfter = db.prepare('SELECT environment_id FROM Project WHERE id = ?').get(proj) as { environment_id: string | null };
      expect(projAfter.environment_id).not.toBeNull();

      const env = db.prepare('SELECT * FROM ExecutionEnvironment WHERE id = ?').get(projAfter.environment_id) as Record<string, unknown>;
      expect(env.type).toBe('DOCKER');
    });

    it('作成された環境名がプロジェクト名を含む', async () => {
      const proj = insertTestProject(db, { name: 'TestProject', environment_id: null });

      await runMigration(db);

      const projAfter = db.prepare('SELECT environment_id FROM Project WHERE id = ?').get(proj) as { environment_id: string };
      const env = db.prepare('SELECT * FROM ExecutionEnvironment WHERE id = ?').get(projAfter.environment_id) as Record<string, unknown>;
      expect((env.name as string)).toContain('TestProject');
    });
  });

  describe('べき等性', () => {
    it('2回実行しても同じ結果になる', async () => {
      const envId = insertTestEnv(db, {});
      insertTestProject(db, { environment_id: envId });
      insertTestProject(db, { environment_id: envId });

      await runMigration(db);
      const envCountAfterFirst = (db.prepare('SELECT count(*) as c FROM ExecutionEnvironment').get() as { c: number }).c;

      await runMigration(db);
      const envCountAfterSecond = (db.prepare('SELECT count(*) as c FROM ExecutionEnvironment').get() as { c: number }).c;

      expect(envCountAfterFirst).toBe(envCountAfterSecond);
    });
  });

  describe('マイグレーション後の整合性 (REQ-NFR-001)', () => {
    it('全プロジェクトが有効な environment_id を持つ', async () => {
      insertTestProject(db, { environment_id: null });
      const envId = insertTestEnv(db, {});
      insertTestProject(db, { environment_id: envId });
      insertTestProject(db, { environment_id: envId });

      await runMigration(db);

      const nullEnvProjects = db.prepare('SELECT count(*) as c FROM Project WHERE environment_id IS NULL').get() as { c: number };
      expect(nullEnvProjects.c).toBe(0);
    });

    it('全 executionEnvironments に project_id が設定されている', async () => {
      const envId = insertTestEnv(db, {});
      insertTestProject(db, { environment_id: envId });

      await runMigration(db);

      const nullProjectIdEnvs = db.prepare('SELECT count(*) as c FROM ExecutionEnvironment WHERE project_id IS NULL').get() as { c: number };
      expect(nullProjectIdEnvs.c).toBe(0);
    });

    it('project.environment_id と executionEnvironments.project_id が相互参照している', async () => {
      const envId = insertTestEnv(db, {});
      const projId = insertTestProject(db, { environment_id: envId });

      await runMigration(db);

      const proj = db.prepare('SELECT environment_id FROM Project WHERE id = ?').get(projId) as { environment_id: string };
      const env = db.prepare('SELECT project_id FROM ExecutionEnvironment WHERE id = ?').get(proj.environment_id) as { project_id: string };
      expect(env.project_id).toBe(projId);
    });
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run scripts/__tests__/migrate-env-project-one-to-one.test.ts
```

3. 実装内容

`scripts/migrate-env-project-one-to-one.ts` を新規作成:

- `runMigration(db)` 関数をエクスポート（テスト・本番共用）
- `db.transaction()` で全操作をラップ
- 共有環境の検出と複製（技術設計書 2.3 参照）
- NetworkFilterConfig/Rules の複製（技術設計書 2.4 参照）
- auth_dir_path のコピー処理（技術設計書 2.5 参照、ファイルコピーはトランザクション外）
- 環境未設定プロジェクトへのデフォルト DOCKER 環境作成（技術設計書 2.6 参照）
- `executionEnvironments.project_id` の整合性チェック（NULL レコードが残っていれば例外）

4. テスト再実行と確認

```bash
npx vitest run scripts/__tests__/migrate-env-project-one-to-one.test.ts
```

**受入基準**

- テスト全件パス
- `npx tsx scripts/migrate-env-project-one-to-one.ts` で実行可能
- 2回実行しても同じ結果（べき等性）
- マイグレーション後に全プロジェクトが `environment_id` を持つ
- マイグレーション後に全環境が `project_id` を持つ
- 共有環境が N プロジェクトに使われていた場合、N 個の環境が作成される

**コミットメッセージ案**

```
feat(migration): Project-Environment 1対1化マイグレーションスクリプトを追加

共有環境の複製、NetworkFilterConfig/Rules の複製、デフォルト環境自動作成を
トランザクション内でアトミックに実行するスクリプトを追加する。

## 受入基準の達成状況
- [x] 共有環境の複製（N プロジェクト → N 環境）
- [x] NetworkFilterConfig/Rules の複製
- [x] 環境未設定プロジェクトへのデフォルト DOCKER 環境作成
- [x] べき等性（2回実行しても安全）

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-002
- docs/sdd/design/env-project-one-to-one.md: セクション2
```

---

### TASK-003: スキーマ変更 - projects/sessions の制約更新・カラム削除

**ステータス**: DONE

**説明**

マイグレーション完了後のスキーマ最終形を定義する。
`projects.environment_id` に `notNull()` と `unique()` を追加し、
`sessions` テーブルから `environment_id` と `docker_mode` を削除する。
また、リレーション定義も更新する。

**依存タスク**: TASK-002

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/db/schema.ts` | 変更 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/db/__tests__/schema-final.test.ts (新規)
import { describe, it, expect } from 'vitest';
import type { NewSession, Session } from '@/db/schema';

describe('最終スキーマ: 型定義確認', () => {
  describe('Session 型から environment_id と docker_mode が削除されている', () => {
    it('NewSession 型に environment_id フィールドが存在しない', () => {
      const session: NewSession = {
        project_id: 'proj-id',
        name: 'test',
        status: 'initializing',
        worktree_path: '/path',
        branch_name: 'branch',
      };
      // TypeScript コンパイルエラーにならないことで確認
      // @ts-expect-error environment_id は存在しないはず
      const _ = session.environment_id;
      expect(true).toBe(true); // 型チェックが通れば OK
    });

    it('NewSession 型に docker_mode フィールドが存在しない', () => {
      const session: NewSession = {
        project_id: 'proj-id',
        name: 'test',
        status: 'initializing',
        worktree_path: '/path',
        branch_name: 'branch',
      };
      // @ts-expect-error docker_mode は存在しないはず
      const _ = session.docker_mode;
      expect(true).toBe(true);
    });
  });

  describe('projects の environment_id', () => {
    it('NewProject の environment_id が必須フィールドとして型定義されている', () => {
      // notNull() 追加後は environment_id が必須になる
      // TypeScript の型を通して確認（コンパイル通過 = 成功）
      expect(true).toBe(true);
    });
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/db/__tests__/schema-final.test.ts
npm run build:server
```

3. 実装内容

`src/db/schema.ts`:

- `projects.environment_id` を以下に変更:
  ```typescript
  environment_id: text('environment_id')
    .notNull()
    .unique()
    .references(() => executionEnvironments.id, { onDelete: 'restrict' }),
  ```

- `sessions` テーブルから以下を削除:
  ```typescript
  docker_mode: integer('docker_mode', { mode: 'boolean' }).notNull().default(false),
  environment_id: text('environment_id').references(() => executionEnvironments.id, { onDelete: 'set null' }),
  ```

- `sessionsRelations` から `environment` リレーションを削除:
  ```typescript
  export const sessionsRelations = relations(sessions, ({ one, many }) => ({
    project: one(projects, {
      fields: [sessions.project_id],
      references: [projects.id],
    }),
    messages: many(messages),
  }));
  ```

- `executionEnvironmentsRelations` から `sessions` を削除し `project` に変更（TASK-001 で実施済みの場合は確認のみ）

4. テスト再実行と確認

```bash
npx vitest run src/db/__tests__/schema-final.test.ts
npm run build:server
npm run db:push  # スキーマをDBに反映（マイグレーション後に実行）
```

**受入基準**

- `sessions` 型から `environment_id` フィールドが消えている
- `sessions` 型から `docker_mode` フィールドが消えている
- `projects.environment_id` が `notNull()` かつ `unique()` になっている
- `onDelete: 'restrict'`（環境単体削除の防止）が設定されている
- TypeScript コンパイルエラーなし
- `npm run build:server` が通る

**コミットメッセージ案**

```
feat(schema): sessions から environment_id/docker_mode 削除、projects.environment_id を NOT NULL/UNIQUE に変更

マイグレーション完了後のスキーマ最終形。sessions テーブルの廃止予定カラムを削除し、
projects.environment_id に 1対1制約を付与する。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-003
- docs/sdd/design/env-project-one-to-one.md: セクション1.1〜1.3
```

---

## Phase B: サービス層・API

### TASK-004: environment-service.ts の拡張

**ステータス**: DONE

**説明**

`CreateEnvironmentInput` に `project_id` フィールドを追加し、
`createForProject()`・`findByProjectId()` メソッドを追加する。
`UpdateEnvironmentInput` に `type` フィールドを追加する。

**依存タスク**: TASK-003

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/services/environment-service.ts` | 変更 |
| `src/services/__tests__/environment-service.test.ts` | 新規または変更 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/services/__tests__/environment-service.test.ts (新規または追記)
describe('EnvironmentService', () => {
  describe('create()', () => {
    it('project_id を設定して環境を作成できる', async () => {
      const env = await environmentService.create({
        name: 'Test Env',
        type: 'DOCKER',
        config: { imageName: 'test' },
        project_id: 'project-uuid',
      });
      expect(env.project_id).toBe('project-uuid');
    });

    it('作成された環境の project_id が DB に保存されている', async () => {
      const env = await environmentService.create({
        name: 'Test Env',
        type: 'DOCKER',
        config: {},
        project_id: 'project-uuid',
      });
      const found = await environmentService.findById(env.id);
      expect(found?.project_id).toBe('project-uuid');
    });
  });

  describe('createForProject()', () => {
    it('デフォルト DOCKER 設定で環境を作成する', async () => {
      const env = await environmentService.createForProject('project-uuid');
      expect(env.type).toBe('DOCKER');
      expect(env.project_id).toBe('project-uuid');
      const config = JSON.parse(env.config);
      expect(config.imageName).toBeDefined();
    });

    it('カスタム config を指定して作成できる', async () => {
      const env = await environmentService.createForProject('project-uuid', {
        name: 'Custom',
        config: { imageName: 'custom-image', imageTag: 'v1.0' },
      });
      const config = JSON.parse(env.config);
      expect(config.imageName).toBe('custom-image');
      expect(config.imageTag).toBe('v1.0');
    });

    it('name が未指定の場合、project_id の先頭 8 文字を含む名前が設定される', async () => {
      const projectId = 'abcdef12-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
      const env = await environmentService.createForProject(projectId);
      expect(env.name).toContain(projectId.slice(0, 8));
    });
  });

  describe('findByProjectId()', () => {
    it('project_id から環境を取得できる', async () => {
      const created = await environmentService.create({
        name: 'Test',
        type: 'DOCKER',
        config: {},
        project_id: 'target-project',
      });
      const found = await environmentService.findByProjectId('target-project');
      expect(found?.id).toBe(created.id);
    });

    it('存在しない project_id では null を返す', async () => {
      const found = await environmentService.findByProjectId('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('update()', () => {
    it('type を DOCKER から HOST に変更できる', async () => {
      const env = await environmentService.create({
        name: 'Test',
        type: 'DOCKER',
        config: {},
        project_id: 'proj-id',
      });
      const updated = await environmentService.update(env.id, { type: 'HOST' });
      expect(updated.type).toBe('HOST');
    });
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/services/__tests__/environment-service.test.ts
```

3. 実装内容

`src/services/environment-service.ts`:

- `CreateEnvironmentInput` に `project_id: string` を追加
- `UpdateEnvironmentInput` に `type?: 'HOST' | 'DOCKER' | 'SSH'` を追加
- `create()` 内の `db.insert()` に `project_id: input.project_id` を追加
- `update()` 内に `type` 更新処理を追加
- `createForProject()` メソッドを追加:
  ```typescript
  async createForProject(
    projectId: string,
    config?: Partial<Omit<CreateEnvironmentInput, 'project_id'>>
  ): Promise<ExecutionEnvironment>
  ```
- `findByProjectId()` メソッドを追加:
  ```typescript
  async findByProjectId(projectId: string): Promise<ExecutionEnvironment | null>
  ```

4. テスト再実行と確認

```bash
npx vitest run src/services/__tests__/environment-service.test.ts
```

**受入基準**

- `CreateEnvironmentInput` に `project_id: string` が追加されている
- `UpdateEnvironmentInput` に `type` が追加されている
- `createForProject()` がデフォルト DOCKER 設定で環境を作成する
- `findByProjectId()` でプロジェクト ID から環境を取得できる
- テスト全件パス

**コミットメッセージ案**

```
feat(environment-service): createForProject・findByProjectId を追加、create() に project_id 必須化

Project-Environment 1対1化に対応するため、環境サービスを拡張する。
プロジェクト作成時の環境自動生成と、プロジェクト経由の環境取得をサポートする。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-004
- docs/sdd/design/env-project-one-to-one.md: セクション4.1
```

---

### TASK-005: 新規API作成 - /api/projects/[project_id]/environment/*

**ステータス**: DONE

**説明**

プロジェクトに紐付く環境を管理する新しい API エンドポイント群を作成する。
旧 `/api/environments/[id]/*` のサブルートに対応する新パスを実装する。
既存コンポーネントとの接続は後続タスクで行うため、本タスクではAPIのみを実装する。

**依存タスク**: TASK-004

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/app/api/projects/[project_id]/environment/route.ts` | 新規 |
| `src/app/api/projects/[project_id]/environment/__tests__/route.test.ts` | 新規 |
| `src/app/api/projects/[project_id]/environment/apply/route.ts` | 新規 |
| `src/app/api/projects/[project_id]/environment/network-filter/route.ts` | 新規 |
| `src/app/api/projects/[project_id]/environment/network-filter/test/route.ts` | 新規 |
| `src/app/api/projects/[project_id]/environment/network-rules/route.ts` | 新規 |
| `src/app/api/projects/[project_id]/environment/network-rules/[ruleId]/route.ts` | 新規 |
| `src/app/api/projects/[project_id]/environment/network-rules/templates/route.ts` | 新規 |
| `src/app/api/projects/[project_id]/environment/network-rules/templates/apply/route.ts` | 新規 |
| `src/app/api/projects/[project_id]/environment/dockerfile/route.ts` | 新規 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/app/api/projects/[project_id]/environment/__tests__/route.test.ts (新規)
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

describe('GET /api/projects/[project_id]/environment', () => {
  it('プロジェクトの環境を返す', async () => {
    // モックセットアップ: プロジェクトと環境を DB にセット
    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/projects/proj-1/environment');
    const res = await GET(req, { params: { project_id: 'proj-1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.environment).toBeDefined();
    expect(body.environment.project_id).toBe('proj-1');
  });

  it('存在しないプロジェクトで 404 を返す', async () => {
    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/projects/nonexistent/environment');
    const res = await GET(req, { params: { project_id: 'nonexistent' } });
    expect(res.status).toBe(404);
  });

  it('環境が設定されていないプロジェクトで 404 を返す', async () => {
    // 環境未設定プロジェクト（migration 前の状態はないはずだが念のため）
    // ...
  });
});

describe('PUT /api/projects/[project_id]/environment', () => {
  it('name, description, config を更新できる', async () => {
    const { PUT } = await import('../route');
    const req = new NextRequest('http://localhost/api/projects/proj-1/environment', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated', config: { imageName: 'new-image' } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, { params: { project_id: 'proj-1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.environment.name).toBe('Updated');
  });

  it('type を変更できる（警告なし・アクティブセッションなし時）', async () => {
    const { PUT } = await import('../route');
    const req = new NextRequest('http://localhost/api/projects/proj-1/environment', {
      method: 'PUT',
      body: JSON.stringify({ type: 'HOST' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, { params: { project_id: 'proj-1' } });
    expect(res.status).toBe(200);
  });

  it('アクティブセッションが存在する場合に warning を返す', async () => {
    // アクティブセッション（status=running）が存在するプロジェクトで type 変更
    // ...
    const body = await res.json();
    expect(body.warning).toBeDefined();
  });

  it('config.skipPermissions が boolean でない場合に 400 を返す', async () => {
    const { PUT } = await import('../route');
    const req = new NextRequest('http://localhost/api/projects/proj-1/environment', {
      method: 'PUT',
      body: JSON.stringify({ config: { skipPermissions: 'yes' } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req, { params: { project_id: 'proj-1' } });
    expect(res.status).toBe(400);
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run "src/app/api/projects/\[project_id\]/environment/__tests__/route.test.ts"
```

3. 実装内容

`src/app/api/projects/[project_id]/environment/route.ts`:

- `GET`: `environmentService.findByProjectId(project_id)` で環境を取得して返す
- `PUT`: `environmentService.update(env.id, input)` で環境を更新する。アクティブセッション存在時は `warning` を含めて返す

各サブルートは旧 `/api/environments/[id]/` 配下の対応するルートを、
パラメータとして `env_id` の代わりに `project_id` を受け取るよう移植する。

各ルート実装の共通パターン:
```typescript
const project = await projectService.findById(project_id);
if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 });
const env = await environmentService.findByProjectId(project_id);
if (!env) return NextResponse.json({ error: '環境が設定されていません' }, { status: 404 });
// 以降は env.id を使って旧 API と同じ処理
```

4. テスト再実行と確認

```bash
npx vitest run "src/app/api/projects/\[project_id\]/environment/__tests__/route.test.ts"
```

**受入基準**

- `GET /api/projects/[project_id]/environment` が環境オブジェクトを返す
- `PUT /api/projects/[project_id]/environment` で name/description/config/type を更新できる
- アクティブセッション存在時に `warning` フィールドを含む 200 レスポンスを返す
- 存在しないプロジェクトに対して 404 を返す
- ネットワークフィルター・ルール・テンプレート・Dockerfile の各サブルートが旧 API と同等の機能を持つ

**コミットメッセージ案**

```
feat(api): /api/projects/[project_id]/environment/* エンドポイントを追加

プロジェクト経由で環境を管理する新しい API エンドポイント群を追加する。
旧 /api/environments/[id]/* の機能をプロジェクト配下に移動する。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-005
- docs/sdd/design/env-project-one-to-one.md: セクション3.1
```

---

### TASK-006: 既存API変更 - プロジェクト作成時の環境自動作成

**ステータス**: DONE

**説明**

`POST /api/projects` と `POST /api/projects/clone` から `environment_id` パラメータを廃止し、
プロジェクト作成時に `environmentService.createForProject()` で環境を自動作成する。
プロジェクト削除時（`DELETE /api/projects/[project_id]`）に環境の外部リソース削除処理を追加する。

**依存タスク**: TASK-004

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/app/api/projects/route.ts` | 変更 |
| `src/app/api/projects/__tests__/route.test.ts` | 変更 |
| `src/app/api/projects/clone/route.ts` | 変更 |
| `src/app/api/projects/clone/__tests__/route.test.ts` | 変更 |
| `src/app/api/projects/[project_id]/route.ts` | 変更 |
| `src/app/api/projects/[project_id]/__tests__/route.test.ts` | 変更 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/app/api/projects/__tests__/route.test.ts (既存を更新)
describe('POST /api/projects', () => {
  it('environment_id を指定せずにプロジェクトを作成できる', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ path: '/tmp/test-repo' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project).toBeDefined();
  });

  it('プロジェクト作成後に DOCKER 環境が自動作成される', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ path: '/tmp/test-repo' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();
    const projectId = body.project.id;

    // 環境が作成されていることを確認
    const env = await environmentService.findByProjectId(projectId);
    expect(env).not.toBeNull();
    expect(env?.type).toBe('DOCKER');
  });

  it('リクエストボディに environment_id が含まれていても無視される', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ path: '/tmp/test-repo', environment_id: 'old-env-id' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // environment_id パラメータがあってもエラーにならない
  });
});

describe('DELETE /api/projects/[project_id]', () => {
  it('プロジェクト削除時に環境の外部リソースも削除される', async () => {
    // 環境の delete メソッドが呼ばれていることを確認
    const deleteSpy = vi.spyOn(environmentService, 'delete');
    // ... プロジェクト削除処理
    expect(deleteSpy).toHaveBeenCalled();
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/app/api/projects/__tests__/route.test.ts
npx vitest run src/app/api/projects/clone/__tests__/route.test.ts
npx vitest run "src/app/api/projects/\[project_id\]/__tests__/route.test.ts"
```

3. 実装内容

`src/app/api/projects/route.ts`:
- `environment_id` バリデーションを削除
- プロジェクト INSERT 後に `environmentService.createForProject(project.id)` を呼び出し
- `db.update(projects).set({ environment_id: env.id })` でプロジェクトに環境を紐付け

`src/app/api/projects/clone/route.ts`:
- 同様に `environment_id` バリデーションを削除し、clone 完了後に環境自動作成

`src/app/api/projects/[project_id]/route.ts`:
- `PATCH` から `environment_id` 変更ロジックを削除
- `DELETE` ハンドラで環境の外部リソース削除処理を追加:
  ```typescript
  const env = await environmentService.findByProjectId(project_id);
  if (env) {
    await environmentService.delete(env.id); // auth_dir, Docker Volume 削除
  }
  // その後プロジェクト DB レコードを削除
  ```

4. テスト再実行と確認

```bash
npx vitest run src/app/api/projects/__tests__/route.test.ts
npx vitest run src/app/api/projects/clone/__tests__/route.test.ts
```

**受入基準**

- プロジェクト作成時に `environment_id` パラメータが不要になっている
- プロジェクト作成後に DOCKER 環境が自動生成されている
- プロジェクト作成リクエストに `environment_id` が含まれていてもエラーにならない（無視）
- プロジェクト削除時に環境の外部リソース（auth_dir_path, Docker Volume）も削除される

**コミットメッセージ案**

```
feat(api): プロジェクト作成時の環境自動作成、削除時の環境クリーンアップを追加

POST /api/projects, POST /api/projects/clone から environment_id パラメータを廃止し、
プロジェクト作成後に DOCKER 環境を自動作成する。プロジェクト削除時は環境も連動削除する。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-006
- docs/sdd/design/env-project-one-to-one.md: セクション3.3
```

---

### TASK-007: 既存API変更 - セッション作成 API の environment_id 廃止

**ステータス**: DONE

**説明**

`POST /api/projects/[project_id]/sessions` のリクエストボディから
`environment_id` パラメータを無視するよう変更する。
セッション作成時に `sessions.environment_id` へ値を保存する処理を削除する。

**依存タスク**: TASK-003

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/app/api/projects/[project_id]/sessions/route.ts` | 変更 |
| `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts` | 変更 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts (既存を更新)
describe('POST /api/projects/[project_id]/sessions', () => {
  it('environment_id パラメータを指定してもエラーにならない（後方互換）', async () => {
    const res = await POST(req_with_env_id);
    expect(res.status).toBe(200);
  });

  it('environment_id を指定してもプロジェクトの環境が使用される', async () => {
    // セッション作成後、sessions テーブルに environment_id が保存されていないことを確認
    const session = await db.select().from(schema.sessions).where(...).get();
    // environment_id カラムが存在しない（TASK-003 完了後）
    expect('environment_id' in session).toBe(false);
  });

  it('docker_mode パラメータを無視する', async () => {
    const res = await POST(req_with_docker_mode);
    expect(res.status).toBe(200);
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run "src/app/api/projects/\[project_id\]/sessions/__tests__/route.test.ts"
```

3. 実装内容

`src/app/api/projects/[project_id]/sessions/route.ts`:
- `requestEnvironmentId` の読み取りと利用コードを削除
- `docker_mode` フィールドの読み取りと利用コードを削除
- `db.insert(schema.sessions).values({ ... })` から `environment_id` と `docker_mode` フィールドを削除

4. テスト再実行と確認

```bash
npx vitest run "src/app/api/projects/\[project_id\]/sessions/__tests__/route.test.ts"
```

**受入基準**

- セッション作成時に `environment_id` を指定してもエラーにならない
- セッション作成時に `sessions.environment_id` が保存されない
- セッション作成時に `sessions.docker_mode` が保存されない

**コミットメッセージ案**

```
feat(api): セッション作成 API から environment_id/docker_mode を廃止

sessions テーブルのカラム削除に対応し、セッション作成時のパラメータを整理する。
後方互換のため environment_id が送信されても無視する（エラーにしない）。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-007
- docs/sdd/design/env-project-one-to-one.md: セクション4.3
```

---

### TASK-008: WebSocketハンドラの環境参照をプロジェクト経由に変更

**ステータス**: DONE

**説明**

`src/lib/websocket/claude-websocket-handler.ts` 等の WebSocket ハンドラが
`session.environment_id` から環境を取得している箇所を、
`project.environment_id` 経由に変更する。

**依存タスク**: TASK-003

**対象ファイル**

調査して特定が必要なファイル（既存コードを確認して変更箇所を特定すること）:

| ファイル | 変更種別 |
|---|---|
| `src/lib/websocket/claude-websocket-handler.ts`（または同等ファイル） | 変更 |
| `src/services/process-lifecycle-manager.ts`（存在する場合） | 変更 |

**TDD手順**

1. 実装前に影響箇所を調査する

```bash
# session.environment_id を参照している箇所を全て確認
npx grep -rn "session\.environment_id" src/
npx grep -rn "environment_id" src/lib/websocket/
npx grep -rn "environment_id" src/services/
```

2. テストファイルとテストケース

```typescript
// 対象ファイルの既存テストに追加
describe('WebSocket ハンドラの環境取得', () => {
  it('session ではなく project の environment_id から環境を取得する', async () => {
    // project.environment_id に対応する環境が使用されることを確認
    const mockSession = { id: 'sess-1', project_id: 'proj-1' }; // environment_id なし
    const mockProject = { id: 'proj-1', environment_id: 'env-1' };
    const mockEnv = { id: 'env-1', type: 'DOCKER', config: '{}' };

    // モックセットアップ
    vi.mocked(db.select).mockReturnValueOnce(mockSession);
    vi.mocked(db.select).mockReturnValueOnce(mockProject);
    vi.mocked(environmentService.findById).mockResolvedValueOnce(mockEnv);

    // 検証: env-1 の環境が選択されていること
    expect(AdapterFactory.getAdapter).toHaveBeenCalledWith(mockEnv);
  });
});
```

3. テスト実行コマンド

```bash
npx vitest run src/lib/websocket/
```

4. 実装内容

`session.environment_id` を参照している箇所を以下のパターンに変更:

```typescript
// 変更前
const envId = session.environment_id;
const environment = await environmentService.findById(envId);

// 変更後
const project = db.select().from(schema.projects)
  .where(eq(schema.projects.id, session.project_id))
  .get();
if (!project) throw new Error(`Project not found: ${session.project_id}`);
const environment = await environmentService.findById(project.environment_id);
```

**受入基準**

- `session.environment_id` を参照している箇所が `project.environment_id` 経由に変更されている
- WebSocket ハンドラ経由でセッションを起動したとき、正しいプロジェクトの環境が使用される
- TypeScript コンパイルエラーなし（`session.environment_id` フィールドが存在しないため型エラーがなければ OK）

**コミットメッセージ案**

```
fix(websocket): 環境参照を session.environment_id からプロジェクト経由に変更

セッションからの直接的な environment_id 参照を廃止し、
project.environment_id を通じて環境を解決するよう変更する。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-008
- docs/sdd/design/env-project-one-to-one.md: セクション4.2
```

---

### TASK-009: 旧環境 API の廃止

**ステータス**: DONE

**説明**

`/api/environments` および `/api/environments/[id]/*` の各エンドポイントを廃止する。
新しいエンドポイント (`/api/projects/[project_id]/environment/*`) への移行が完了したため、
旧エンドポイントは 410 Gone を返すよう変更する。

**依存タスク**: TASK-005

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/app/api/environments/route.ts` | 変更（410 返却） |
| `src/app/api/environments/[id]/route.ts` | 変更（410 返却） |
| `src/app/api/environments/[id]/apply/route.ts` | 変更（410 返却） |
| `src/app/api/environments/[id]/network-filter/route.ts` | 変更（410 返却） |
| `src/app/api/environments/[id]/network-filter/test/route.ts` | 変更（410 返却） |
| `src/app/api/environments/[id]/network-rules/route.ts` | 変更（410 返却） |
| `src/app/api/environments/[id]/network-rules/[ruleId]/route.ts` | 変更（410 返却） |
| `src/app/api/environments/[id]/network-rules/templates/route.ts` | 変更（410 返却） |
| `src/app/api/environments/[id]/network-rules/templates/apply/route.ts` | 変更（410 返却） |
| `src/app/api/environments/[id]/dockerfile/route.ts` | 変更（410 返却） |
| `src/app/api/environments/[id]/sessions/route.ts` | 変更（410 返却） |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/app/api/environments/__tests__/route.test.ts (既存を更新)
describe('旧 /api/environments エンドポイントの廃止', () => {
  it('GET /api/environments は 410 Gone を返す', async () => {
    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost/api/environments');
    const res = await GET(req);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.message).toContain('/api/projects/');
  });

  it('POST /api/environments は 410 Gone を返す', async () => {
    const { POST } = await import('../route');
    const req = new NextRequest('http://localhost/api/environments', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(410);
  });
});

describe('旧 /api/environments/[id] エンドポイントの廃止', () => {
  it('GET /api/environments/[id] は 410 Gone を返す', async () => {
    // ...
  });
  it('PUT /api/environments/[id] は 410 Gone を返す', async () => {
    // ...
  });
  it('DELETE /api/environments/[id] は 410 Gone を返す', async () => {
    // ...
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/app/api/environments/__tests__/route.test.ts
```

3. 実装内容

各ルートファイルで全メソッドハンドラを以下に置き換える:

```typescript
export async function GET() {
  return NextResponse.json(
    { error: 'このエンドポイントは廃止されました。/api/projects/[project_id]/environment を使用してください。' },
    { status: 410 }
  );
}
// POST, PUT, DELETE, PATCH も同様
```

4. テスト再実行と確認

```bash
npx vitest run src/app/api/environments/__tests__/
```

**受入基準**

- 全ての旧環境 API エンドポイントが 410 Gone を返す
- 410 レスポンスに新エンドポイントのパスを含むメッセージが含まれる
- テスト全件パス

**コミットメッセージ案**

```
feat(api): 旧 /api/environments/* エンドポイントを 410 Gone に変更

新しい /api/projects/[project_id]/environment/* への移行完了に伴い、
旧エンドポイントを廃止する。移行先のパスをエラーメッセージに含める。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-009
- docs/sdd/design/env-project-one-to-one.md: セクション3.2
```

---

## Phase C: フロントエンド

### TASK-010: store・型定義の変更

**ステータス**: TODO

**説明**

`src/store/index.ts` の `Session` 型と `CreateSessionData` 型から
`environment_id`, `dockerMode`, `docker_mode` フィールドを削除する。
セッション一覧の環境バッジ表示はプロジェクトの環境から取得するよう変更する。

**依存タスク**: TASK-003

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/store/index.ts` | 変更 |
| `src/store/index.test.ts` | 変更 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/store/index.test.ts (既存を更新)
describe('Session 型の environment_id/docker_mode 廃止', () => {
  it('CreateSessionData 型に environment_id フィールドが存在しない', () => {
    const data: CreateSessionData = {
      name: 'test',
      prompt: 'hello',
    };
    // @ts-expect-error environment_id は存在しないはず
    const _ = data.environment_id;
    expect(true).toBe(true);
  });

  it('CreateSessionData 型に dockerMode フィールドが存在しない', () => {
    const data: CreateSessionData = {
      name: 'test',
      prompt: 'hello',
    };
    // @ts-expect-error dockerMode は存在しないはず
    const _ = data.dockerMode;
    expect(true).toBe(true);
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/store/index.test.ts
```

3. 実装内容

`src/store/index.ts`:

- `CreateSessionData` インターフェースから `dockerMode?: boolean` と `environment_id?: string` を削除
- `Session` 型参照箇所から `environment_id` と `docker_mode` を削除（スキーマの型変更により自動反映されるはず）
- セッション作成アクションから `environment_id` と `docker_mode` の送信を削除

4. テスト再実行と確認

```bash
npx vitest run src/store/index.test.ts
npm run build:next  # TypeScript コンパイルエラー確認
```

**受入基準**

- `CreateSessionData` から `environment_id` と `dockerMode` が削除されている
- TypeScript コンパイルエラーなし

**コミットメッセージ案**

```
refactor(store): CreateSessionData から environment_id/dockerMode を削除

セッション作成時の環境選択廃止に対応し、型定義を更新する。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-010
- docs/sdd/design/env-project-one-to-one.md: セクション5.2
```

---

### TASK-011: useProjectEnvironment フック作成

**ステータス**: TODO

**説明**

プロジェクトに紐付く環境を管理する新しい React フック `useProjectEnvironment` を作成する。
`GET/PUT /api/projects/[project_id]/environment` を呼び出し、
ネットワークフィルター・ルール操作も含む。

**依存タスク**: TASK-005

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/hooks/useProjectEnvironment.ts` | 新規 |
| `src/hooks/__tests__/useProjectEnvironment.test.ts` | 新規 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/hooks/__tests__/useProjectEnvironment.test.ts (新規)
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProjectEnvironment } from '../useProjectEnvironment';

// グローバル fetch をモック
global.fetch = vi.fn();

describe('useProjectEnvironment', () => {
  const projectId = 'test-project-id';

  beforeEach(() => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        environment: {
          id: 'env-1',
          name: 'Test Env',
          type: 'DOCKER',
          config: '{"imageName":"test"}',
          project_id: projectId,
        },
      }),
    } as Response);
  });

  it('マウント時に環境データを取得する', async () => {
    const { result } = renderHook(() => useProjectEnvironment(projectId));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.environment).toBeDefined();
    expect(result.current.environment?.type).toBe('DOCKER');
  });

  it('updateEnvironment を呼ぶと PUT リクエストが送信される', async () => {
    const { result } = renderHook(() => useProjectEnvironment(projectId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        environment: { ...result.current.environment, name: 'Updated' },
      }),
    } as Response);

    await act(async () => {
      await result.current.updateEnvironment({ name: 'Updated' });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/projects/${projectId}/environment`,
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('警告メッセージが存在する場合に warning フィールドが設定される', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        environment: { id: 'env-1', type: 'DOCKER' },
        warning: 'アクティブセッションが存在します',
      }),
    } as Response);

    const { result } = renderHook(() => useProjectEnvironment(projectId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateEnvironment({ type: 'HOST' });
    });

    expect(result.current.warning).toBeDefined();
  });

  it('エラー時に error フィールドが設定される', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Not found' }),
      status: 404,
    } as Response);

    const { result } = renderHook(() => useProjectEnvironment(projectId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeDefined();
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/hooks/__tests__/useProjectEnvironment.test.ts
```

3. 実装内容

`src/hooks/useProjectEnvironment.ts` を新規作成（技術設計書 5.1 のインターフェース参照）:

```typescript
export function useProjectEnvironment(projectId: string) {
  const [environment, setEnvironment] = useState<ExecutionEnvironment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // GET /api/projects/[projectId]/environment
  // PUT /api/projects/[projectId]/environment
  // ネットワークフィルター CRUD
  // ...

  return {
    environment,
    isLoading,
    error,
    warning,
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

4. テスト再実行と確認

```bash
npx vitest run src/hooks/__tests__/useProjectEnvironment.test.ts
```

**受入基準**

- フック呼び出し時に環境データを自動取得する
- `updateEnvironment()` で PUT リクエストを送信できる
- 警告メッセージがある場合に `warning` フィールドに設定される
- ネットワークフィルター・ルールの CRUD 操作が実装されている
- テスト全件パス

**コミットメッセージ案**

```
feat(hooks): useProjectEnvironment フックを追加

プロジェクト設定画面から環境を管理するための React フックを追加する。
環境の取得・更新、ネットワークフィルター管理をサポートする。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-011
- docs/sdd/design/env-project-one-to-one.md: セクション5.1
```

---

### TASK-012: ProjectEnvironmentSection コンポーネント作成

**ステータス**: TODO

**説明**

プロジェクト設定画面に表示する「実行環境」セクションのコンポーネントを作成する。
環境タイプ選択、Docker 設定、ネットワークフィルター設定を含む。
既存の `PortMappingList`, `VolumeMountList`, `NetworkFilterSection` 等を再利用する。

**依存タスク**: TASK-011

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/components/projects/ProjectEnvironmentSection.tsx` | 新規 |
| `src/components/projects/__tests__/ProjectEnvironmentSection.test.tsx` | 新規 |
| `src/components/projects/ProjectSettingsModal.tsx` | 変更（新セクション組み込み） |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/components/projects/__tests__/ProjectEnvironmentSection.test.tsx (新規)
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectEnvironmentSection } from '../ProjectEnvironmentSection';

const mockEnvironment = {
  id: 'env-1',
  name: 'Test Env',
  type: 'DOCKER',
  config: JSON.stringify({ imageName: 'test-image', imageTag: 'latest' }),
  project_id: 'proj-1',
  description: null,
  auth_dir_path: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('ProjectEnvironmentSection', () => {
  it('環境タイプ選択のラジオボタンが表示される', () => {
    render(
      <ProjectEnvironmentSection
        projectId="proj-1"
        environment={mockEnvironment}
        onUpdate={vi.fn()}
      />
    );
    expect(screen.getByLabelText('DOCKER')).toBeInTheDocument();
    expect(screen.getByLabelText('HOST')).toBeInTheDocument();
  });

  it('DOCKER 選択時に Docker 設定フィールドが表示される', () => {
    render(
      <ProjectEnvironmentSection
        projectId="proj-1"
        environment={{ ...mockEnvironment, type: 'DOCKER' }}
        onUpdate={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/イメージ名/)).toBeInTheDocument();
  });

  it('HOST 選択時に Docker 設定フィールドが非表示になる', () => {
    render(
      <ProjectEnvironmentSection
        projectId="proj-1"
        environment={{ ...mockEnvironment, type: 'HOST' }}
        onUpdate={vi.fn()}
      />
    );
    expect(screen.queryByLabelText(/イメージ名/)).not.toBeInTheDocument();
  });

  it('アクティブセッション存在時に警告メッセージが表示される', () => {
    render(
      <ProjectEnvironmentSection
        projectId="proj-1"
        environment={mockEnvironment}
        onUpdate={vi.fn()}
        warning="実行中のセッションがあります。次回のセッション起動時に適用されます。"
      />
    );
    expect(screen.getByText(/次回のセッション起動時/)).toBeInTheDocument();
  });

  it('NetworkFilterSection が表示される', () => {
    render(
      <ProjectEnvironmentSection
        projectId="proj-1"
        environment={mockEnvironment}
        onUpdate={vi.fn()}
      />
    );
    // NetworkFilterSection の存在を確認（data-testid または役割で確認）
    expect(screen.getByTestId('network-filter-section')).toBeInTheDocument();
  });

  it('「設定を保存」ボタンのクリックで onUpdate が呼ばれる', async () => {
    const onUpdate = vi.fn();
    render(
      <ProjectEnvironmentSection
        projectId="proj-1"
        environment={mockEnvironment}
        onUpdate={onUpdate}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /設定を保存/ }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run "src/components/projects/__tests__/ProjectEnvironmentSection.test.tsx"
```

3. 実装内容

`src/components/projects/ProjectEnvironmentSection.tsx` を新規作成:

- `useProjectEnvironment(projectId)` フックを使用
- 環境タイプ（HOST/DOCKER）のラジオボタン
- DOCKER 選択時: イメージ名・タグ・`PortMappingList`・`VolumeMountList`・`skipPermissions` チェックボックス
- `NetworkFilterSection` コンポーネントを再利用
- 「設定を保存」ボタン
- 「今すぐ適用」ボタン（`applyChanges` 呼び出し）
- `warning` が存在する場合の警告バナー

`src/components/projects/ProjectSettingsModal.tsx` に `ProjectEnvironmentSection` を追加:
- 既存の設定セクション（Claude Code オプション等）の後に「実行環境」セクションとして追加

4. テスト再実行と確認

```bash
npx vitest run "src/components/projects/__tests__/ProjectEnvironmentSection.test.tsx"
npx vitest run "src/components/projects/__tests__/ProjectSettingsModal.test.tsx"
```

**受入基準**

- 環境タイプ選択が表示される
- DOCKER/HOST に応じた設定フィールドの切り替えが動作する
- `NetworkFilterSection` が表示される
- 警告メッセージが表示される（アクティブセッション存在時）
- プロジェクト設定モーダルに新セクションが追加されている
- テスト全件パス

**コミットメッセージ案**

```
feat(components): ProjectEnvironmentSection コンポーネントをプロジェクト設定モーダルに追加

プロジェクトごとの実行環境設定をプロジェクト設定画面から行えるようにする。
環境タイプ選択、Docker 設定、ネットワークフィルターを一つのセクションに統合する。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-012
- docs/sdd/design/env-project-one-to-one.md: セクション5.1
```

---

### TASK-013: セッション作成フォームから環境選択を削除

**ステータス**: TODO

**説明**

`CreateSessionModal.tsx` と `CreateSessionForm.tsx` から
環境選択ドロップダウンを削除する。

**依存タスク**: TASK-010

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/components/sessions/CreateSessionModal.tsx` | 変更 |
| `src/components/sessions/CreateSessionForm.tsx` | 変更 |
| `src/components/sessions/__tests__/CreateSessionModal.test.tsx` | 変更 |
| `src/components/sessions/__tests__/CreateSessionForm.test.tsx` | 変更 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/components/sessions/__tests__/CreateSessionModal.test.tsx (既存を更新)
describe('CreateSessionModal - 環境選択削除後', () => {
  it('環境選択ドロップダウンが表示されない', () => {
    render(<CreateSessionModal projectId="proj-1" onClose={vi.fn()} />);
    expect(screen.queryByLabelText(/実行環境/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/環境を選択/)).not.toBeInTheDocument();
  });

  it('フォーム送信データに environment_id が含まれない', async () => {
    const onSubmit = vi.fn();
    render(<CreateSessionModal projectId="proj-1" onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/プロンプト/), { target: { value: 'test prompt' } });
    fireEvent.click(screen.getByRole('button', { name: /セッション作成/ }));
    await waitFor(() => {
      const submitData = onSubmit.mock.calls[0][0];
      expect(submitData).not.toHaveProperty('environment_id');
      expect(submitData).not.toHaveProperty('dockerMode');
    });
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run "src/components/sessions/__tests__/CreateSessionModal.test.tsx"
```

3. 実装内容

`src/components/sessions/CreateSessionModal.tsx`:
- 環境選択ドロップダウンの JSX を削除
- `useEnvironments` フックの import を削除（不要になる場合）
- フォームの state から `environment_id` と `dockerMode` を削除

`src/components/sessions/CreateSessionForm.tsx`:
- 同様に環境選択関連のコードを削除

4. テスト再実行と確認

```bash
npx vitest run "src/components/sessions/__tests__/CreateSessionModal.test.tsx"
npx vitest run "src/components/sessions/__tests__/CreateSessionForm.test.tsx"
```

**受入基準**

- セッション作成フォームに環境選択 UI が存在しない
- フォーム送信データに `environment_id` と `dockerMode` が含まれない
- テスト全件パス

**コミットメッセージ案**

```
feat(components): セッション作成フォームから環境選択を削除

プロジェクトに環境が1対1で紐付くようになったため、
セッション作成時の環境選択は不要になった。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-013
- docs/sdd/requirements/env-project-one-to-one.md: REQ-UI-003
```

---

### TASK-014: /settings/environments ページ廃止・ナビゲーション変更

**ステータス**: TODO

**説明**

`/settings/environments` ページをリダイレクト（`/settings` へ）に変更し、
グローバルナビゲーションから「環境設定」メニューを削除する。

**依存タスク**: TASK-009

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/app/settings/environments/page.tsx` | 変更（リダイレクト化） |
| `src/app/settings/layout.tsx` | 変更（ナビゲーションリンク削除） |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/app/settings/environments/__tests__/page.test.tsx (既存を更新)
describe('/settings/environments ページの廃止', () => {
  it('/settings にリダイレクトする', async () => {
    const { default: EnvironmentsPage } = await import('../page');
    render(<EnvironmentsPage />);
    // redirect が呼ばれていることを確認
    expect(redirect).toHaveBeenCalledWith('/settings');
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/app/settings/environments/__tests__/page.test.tsx
```

3. 実装内容

`src/app/settings/environments/page.tsx`:
```typescript
import { redirect } from 'next/navigation';

export default function EnvironmentsPage() {
  redirect('/settings');
}
```

`src/app/settings/layout.tsx`:
- `href="/settings/environments"` のナビゲーションリンクを削除

4. テスト再実行と確認

```bash
npx vitest run src/app/settings/environments/__tests__/page.test.tsx
```

**受入基準**

- `/settings/environments` にアクセスすると `/settings` にリダイレクトされる
- グローバルナビゲーションから「環境設定」リンクが削除されている

**コミットメッセージ案**

```
feat(settings): /settings/environments ページをリダイレクトに変更、ナビゲーションから環境設定を削除

環境設定はプロジェクト設定に統合されたため、独立ページを廃止する。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-014
- docs/sdd/requirements/env-project-one-to-one.md: REQ-UI-001
```

---

### TASK-015: プロジェクト作成フォーム (AddProjectWizard) の変更

**ステータス**: TODO

**説明**

`AddProjectModal.tsx` / `AddProjectWizard` の StepEnvironment から
「環境を選択」ドロップダウンを削除する。
環境は自動作成されるため、環境設定ステップは省略するか、
「プロジェクト作成後に設定から変更できます」という説明に差し替える。

**依存タスク**: TASK-006

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/components/projects/AddProjectWizard/StepEnvironment.tsx` | 変更 |
| `src/components/projects/AddProjectWizard/types.ts` | 変更 |
| `src/components/projects/AddProjectWizard/__tests__/WizardContainer.test.tsx` | 変更 |
| `src/components/projects/AddProjectModal.tsx` | 変更 |
| `src/components/projects/__tests__/AddProjectModal.test.tsx` | 変更 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/components/projects/AddProjectWizard/__tests__/WizardContainer.test.tsx (既存を更新)
describe('AddProjectWizard - 環境選択削除後', () => {
  it('環境選択ドロップダウンが表示されない', () => {
    render(<WizardContainer ... />);
    expect(screen.queryByLabelText(/実行環境を選択/)).not.toBeInTheDocument();
  });

  it('環境自動作成の説明テキストが表示される', () => {
    render(<WizardContainer ... />);
    expect(screen.getByText(/プロジェクト設定から変更できます/)).toBeInTheDocument();
  });

  it('プロジェクト作成リクエストに environment_id が含まれない', async () => {
    // フォーム送信データに environment_id がないことを確認
    // ...
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run "src/components/projects/AddProjectWizard/__tests__/WizardContainer.test.tsx"
```

3. 実装内容

`src/components/projects/AddProjectWizard/StepEnvironment.tsx`:
- 環境選択ドロップダウンを削除
- 「DOCKER 環境が自動作成されます。プロジェクト作成後にプロジェクト設定から変更できます。」という説明テキストに変更
- ステップのスキップまたはシンプルな情報表示に変更

`src/components/projects/AddProjectWizard/types.ts`:
- `WizardData` から `environment_id` フィールドを削除（あれば）

`src/components/projects/AddProjectModal.tsx`:
- `environment_id` の送信を削除

4. テスト再実行と確認

```bash
npx vitest run "src/components/projects/__tests__/AddProjectModal.test.tsx"
```

**受入基準**

- プロジェクト作成フォームで環境選択ドロップダウンが表示されない
- 環境自動作成の説明テキストが表示される
- フォーム送信データに `environment_id` が含まれない
- テスト全件パス

**コミットメッセージ案**

```
feat(components): AddProjectWizard から環境選択を削除し自動作成の説明を追加

プロジェクト作成時の環境自動作成に対応し、ウィザードから環境選択ステップを削除する。
環境設定はプロジェクト作成後にプロジェクト設定から変更できることを説明する。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-015
- docs/sdd/requirements/env-project-one-to-one.md: REQ-UI-004
```

---

## Phase D: クリーンアップ

### TASK-016: 旧コンポーネント・フックの削除

**ステータス**: TODO

**説明**

`useEnvironments.ts` フックと環境一覧関連コンポーネント
（`EnvironmentList.tsx`, `EnvironmentCard.tsx`, `EnvironmentForm.tsx` 等）を削除する。
これらは `/settings/environments` ページで使用されていたもので、
新アーキテクチャでは `useProjectEnvironment` と `ProjectEnvironmentSection` に置き換わる。

ただし、以下のコンポーネントは `ProjectEnvironmentSection` で再利用されるため **削除しない**:
- `PortMappingList.tsx`
- `VolumeMountList.tsx`
- `NetworkFilterSection.tsx`
- `ApplyChangesButton.tsx`
- `NetworkRuleForm.tsx`
- `NetworkRuleList.tsx`
- `NetworkTemplateDialog.tsx`
- `NetworkTestDialog.tsx`
- `DangerousPathWarning.tsx`

**依存タスク**: TASK-014, TASK-015

**対象ファイル**

削除対象:

| ファイル | 変更種別 |
|---|---|
| `src/hooks/useEnvironments.ts` | 削除 |
| `src/components/environments/EnvironmentList.tsx` | 削除 |
| `src/components/environments/EnvironmentCard.tsx` | 削除 |
| `src/components/environments/EnvironmentForm.tsx` | 削除 |
| `src/components/environments/DeleteEnvironmentDialog.tsx` | 削除 |
| `src/components/environments/__tests__/EnvironmentCard.test.tsx` | 削除 |
| `src/components/environments/__tests__/EnvironmentList.disabled-env.test.tsx` | 削除 |
| `src/components/environments/__tests__/EnvironmentForm.disabled-host.test.tsx` | 削除 |
| `src/components/environments/__tests__/EnvironmentForm.port-volume.test.tsx` | 削除 |
| `src/components/environments/index.ts` | 変更（削除ファイルのエクスポートを除去） |

**TDD手順**

1. 削除前の調査

```bash
# 削除予定ファイルが参照されている箇所を確認
npx grep -rn "useEnvironments" src/ --include="*.ts" --include="*.tsx"
npx grep -rn "EnvironmentList\|EnvironmentCard\|EnvironmentForm\|DeleteEnvironmentDialog" src/ --include="*.tsx"
```

2. テストを先に削除してからソースを削除する方針で進める

3. テスト実行コマンド（削除後）

```bash
npm test  # 全テストが通ることを確認
npm run build:next  # TypeScript エラーがないことを確認
```

4. 実装手順

- 削除対象ファイルを参照している箇所をすべて確認・修正してからファイルを削除
- `src/components/environments/index.ts` から削除ファイルのエクスポートを除去

**受入基準**

- 削除対象ファイルが存在しない
- 削除後も全テストが通る
- TypeScript コンパイルエラーなし

**コミットメッセージ案**

```
refactor: 廃止された環境管理コンポーネント・フックを削除

useEnvironments フック、EnvironmentList/Card/Form コンポーネントを削除する。
これらは ProjectEnvironmentSection と useProjectEnvironment に置き換えられた。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-016
- docs/sdd/requirements/env-project-one-to-one.md: REQ-UI-001
```

---

### TASK-017: 結合テスト・既存テストの修正

**ステータス**: TODO

**説明**

各フェーズの実装後に残存する既存テストの失敗を修正する。
スキーマ変更・API変更・フロントエンド変更に伴い、
モック・フィクスチャ・アサーションが古い仕様に依存しているテストを更新する。

**依存タスク**: TASK-016

**対象ファイル**

失敗しているテストを調査して特定する（実装後に確定）。
主な候補:

| ファイル | 変更種別 |
|---|---|
| `src/app/api/environments/__tests__/route.test.ts` | 変更（410 対応確認） |
| `src/app/api/projects/__tests__/route.test.ts` | 変更（environment 自動作成確認） |
| `src/services/__tests__/environment-service.test.ts` | 変更（新メソッドのテスト追加） |
| その他、全テストスイートで失敗しているファイル | 変更 |

**TDD手順**

1. テスト実行と失敗一覧の確認

```bash
npm test 2>&1 | grep -E "FAIL|×" | head -50
```

2. 各失敗テストの原因分析

- スキーマ変更による型エラー → モックデータから削除済みフィールドを除去
- API レスポンス変更による期待値不一致 → レスポンス形式に合わせて更新
- 削除されたコンポーネント/フックの参照 → 新しい実装に合わせて更新

3. 修正後の確認

```bash
npm test  # 全件パス確認
npm run lint  # lint エラーなし確認
```

**受入基準**

- `npm test` が全件パス
- `npm run lint` がエラー0件
- TypeScript コンパイルエラーなし

**コミットメッセージ案**

```
test: Project-Environment 1対1化に伴うテストの修正

スキーマ変更・API変更・フロントエンド変更により失敗していたテストを修正する。

## 関連ドキュメント
- docs/sdd/tasks/env-project-one-to-one.md: TASK-017
```

---

## 実装上の注意事項

### 循環参照の解決

`projects.environment_id → executionEnvironments` と
`executionEnvironments.project_id → projects` は循環参照になる。
Drizzle ORM では前方参照に `(): AnySQLiteColumn =>` の遅延関数形式を使用する:

```typescript
import { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

// executionEnvironments 定義内
project_id: text('project_id').unique().references((): AnySQLiteColumn => projects.id, { onDelete: 'cascade' }),
```

### db:push の実行順序

1. TASK-001 完了後: `npm run db:push`（`project_id` nullable カラムを DB に追加）
2. TASK-002 完了後: `npx tsx scripts/migrate-env-project-one-to-one.ts`（データ移行）
3. TASK-003 完了後: `npm run db:push`（`notNull()` / `unique()` 制約の適用、セッションカラム削除）

### 外部リソースのクリーンアップ

マイグレーションスクリプトでの auth_dir_path コピーと Docker Volume 作成は
SQLite トランザクション外でベストエフォート実行する（失敗してもデータは整合性を保つ）。

### 後方互換性

セッション作成 API で `environment_id` が送信された場合はエラーにせず無視する。
これにより旧クライアントとの互換性を維持する。
