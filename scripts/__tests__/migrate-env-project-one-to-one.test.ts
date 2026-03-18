import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigration } from '../migrate-env-project-one-to-one';

// テスト用ヘルパー関数

function setupTestSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Project (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      remote_url TEXT,
      claude_code_options TEXT NOT NULL DEFAULT '{}',
      custom_env_vars TEXT NOT NULL DEFAULT '{}',
      clone_location TEXT DEFAULT 'docker',
      docker_volume_id TEXT,
      environment_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ExecutionEnvironment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      config TEXT NOT NULL,
      auth_dir_path TEXT,
      project_id TEXT UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS NetworkFilterConfig (
      id TEXT PRIMARY KEY,
      environment_id TEXT NOT NULL UNIQUE REFERENCES ExecutionEnvironment(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS NetworkFilterRule (
      id TEXT PRIMARY KEY,
      environment_id TEXT NOT NULL REFERENCES ExecutionEnvironment(id) ON DELETE CASCADE,
      target TEXT NOT NULL,
      port INTEGER,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

let envCounter = 0;
let projCounter = 0;

function insertTestEnv(db: Database.Database, opts: {
  name?: string;
  type?: string;
  config?: string;
  auth_dir_path?: string | null;
}): string {
  const id = `env-${++envCounter}`;
  db.prepare(`
    INSERT INTO ExecutionEnvironment (id, name, type, config, auth_dir_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    opts.name ?? 'Test Env',
    opts.type ?? 'DOCKER',
    opts.config ?? '{}',
    opts.auth_dir_path ?? null,
    Date.now(),
    Date.now(),
  );
  return id;
}

function insertTestProject(db: Database.Database, opts: {
  name?: string;
  environment_id?: string | null;
}): string {
  const id = `proj-${++projCounter}`;
  const name = opts.name ?? `Project ${projCounter}`;
  db.prepare(`
    INSERT INTO Project (id, name, path, environment_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    `/path/${id}`,
    opts.environment_id ?? null,
    Date.now(),
    Date.now(),
  );
  return id;
}

function insertNetworkFilterConfig(db: Database.Database, opts: {
  environment_id: string;
  enabled?: boolean;
}): void {
  const id = `nfc-${Math.random()}`;
  db.prepare(`
    INSERT INTO NetworkFilterConfig (id, environment_id, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, opts.environment_id, opts.enabled ? 1 : 0, Date.now(), Date.now());
}

function insertNetworkFilterRule(db: Database.Database, opts: {
  environment_id: string;
  target: string;
  port?: number | null;
  description?: string | null;
  enabled?: boolean;
}): void {
  const id = `nfr-${Math.random()}`;
  db.prepare(`
    INSERT INTO NetworkFilterRule (id, environment_id, target, port, description, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    opts.environment_id,
    opts.target,
    opts.port ?? null,
    opts.description ?? null,
    opts.enabled === false ? 0 : 1,
    Date.now(),
    Date.now(),
  );
}

function getProjectEnvId(db: Database.Database, projectId: string): string {
  const row = db.prepare('SELECT environment_id FROM Project WHERE id = ?').get(projectId) as { environment_id: string };
  return row.environment_id;
}

describe('migrate-env-project-one-to-one', () => {
  let db: Database.Database;

  beforeEach(() => {
    envCounter = 0;
    projCounter = 0;
    db = new Database(':memory:');
    setupTestSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('共有環境の複製 (REQ-MIG-001)', () => {
    it('1環境を2プロジェクトで共有している場合、それぞれ独立した環境が作成される', async () => {
      const envId = insertTestEnv(db, { name: 'shared', type: 'DOCKER' });
      const projA = insertTestProject(db, { name: 'A', environment_id: envId });
      const projB = insertTestProject(db, { name: 'B', environment_id: envId });

      await runMigration(db);

      const projAAfter = db.prepare('SELECT environment_id FROM Project WHERE id = ?').get(projA) as { environment_id: string };
      const projBAfter = db.prepare('SELECT environment_id FROM Project WHERE id = ?').get(projB) as { environment_id: string };

      expect(projAAfter.environment_id).not.toBeNull();
      expect(projBAfter.environment_id).not.toBeNull();
      expect(projAAfter.environment_id).not.toBe(projBAfter.environment_id);
    });

    it('複製された環境の name, type, config が元の環境と一致する', async () => {
      const envId = insertTestEnv(db, { name: 'original', type: 'DOCKER', config: '{"imageName":"test"}' });
      const _projA = insertTestProject(db, { environment_id: envId });
      const projB = insertTestProject(db, { environment_id: envId });

      await runMigration(db);

      const projBEnvId = getProjectEnvId(db, projB);
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
      const _projA = insertTestProject(db, { environment_id: envId });
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
      const _projA = insertTestProject(db, { environment_id: envId });
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
      const _projA = insertTestProject(db, { environment_id: envId });
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
