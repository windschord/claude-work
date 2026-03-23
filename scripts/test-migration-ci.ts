/**
 * マイグレーション検証スクリプト (CI用)
 *
 * データが入っているテーブルに対してDrizzle migrate()を実行し、
 * スキーマ整合性とデータ保全を検証する。
 *
 * シナリオ:
 *   1. 新規DB: migrate()でテーブル作成 -> データ挿入 -> 読み取り確認
 *   2. 既存DB(データ入り): テーブル+データ作成 -> migrate() -> データ保全確認
 *   3. 冪等性: migrate()を2回実行 -> データ保全確認
 *
 * 使用方法:
 *   npx ts-node -r tsconfig-paths/register --project tsconfig.server.json scripts/test-migration-ci.ts
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { validateSchemaIntegrity } from '@/lib/schema-check';
import path from 'path';
import fs from 'fs';
import os from 'os';

type TestDb = BetterSQLite3Database<typeof schema>;

// ============================================================
// ヘルパー
// ============================================================

const migrationsFolder = path.resolve(__dirname, '..', 'drizzle');
let totalAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean | undefined | null, message: string): void {
  totalAssertions++;
  if (condition) {
    console.log(`  OK: ${message}`);
  } else {
    console.error(`  NG: ${message}`);
    failedAssertions++;
  }
}

function makeTempDbPath(suffix: string): string {
  return path.join(os.tmpdir(), `test-migration-ci-${suffix}-${process.pid}.db`);
}

function createTestDb(dbPath: string) {
  for (const ext of ['', '-wal', '-shm']) {
    const f = dbPath + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

function cleanupDb(dbPath: string): void {
  for (const ext of ['', '-wal', '-shm']) {
    const f = dbPath + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

function readJournal(): { version: string; dialect: string; entries: JournalEntry[] } {
  return JSON.parse(
    fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf-8'),
  );
}

/** _journal.jsonからマイグレーションエントリ数を取得する */
function getMigrationEntryCount(): number {
  return readJournal().entries.length;
}

/**
 * 全マイグレーションSQLを順番に実行してテーブルを作成する（__drizzle_migrationsなし）
 * Drizzle migrate()を通さず、SQLを直接実行してテーブルだけを作る
 */
/**
 * 初期マイグレーションSQL(CREATE TABLE)のみ直接実行してテーブルを作成する（__drizzle_migrationsなし）
 *
 * 旧カスタムマイグレーション済みDBを再現する。
 * CREATE TABLE IF NOT EXISTS のみを含む初期マイグレーション(0000)を適用し、
 * ALTER TABLE を含む増分マイグレーション(0001〜)は migrate() に任せる。
 * これにより、実運用と同じアップグレードパス（旧DB -> Drizzle migrate()）を検証できる。
 */
function applyInitialMigrationSqlDirectly(sqlite: InstanceType<typeof Database>): void {
  const journal = readJournal();
  const initialEntry = journal.entries[0];
  if (!initialEntry) {
    throw new Error('No initial migration entry found in journal');
  }
  sqlite.transaction(() => {
    const sqlFile = path.join(migrationsFolder, `${initialEntry.tag}.sql`);
    const migrationSql = fs.readFileSync(sqlFile, 'utf-8');
    const statements = migrationSql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const stmt of statements) {
      sqlite.exec(stmt);
    }
  })();
}

/** 全テーブルのレコード数を取得する */
const allTableNames = [
  'Project', 'ExecutionEnvironment', 'Session', 'Message', 'Prompt',
  'RunScript', 'GitHubPAT', 'DeveloperSettings', 'SshKey',
  'NetworkFilterConfig', 'NetworkFilterRule',
];

function getRowCounts(sqlite: InstanceType<typeof Database>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const table of allTableNames) {
    const row = sqlite.prepare(`SELECT count(*) as cnt FROM "${table}"`).get() as { cnt: number };
    counts[table] = row.cnt;
  }
  return counts;
}

/** テスト用のサンプルデータを全テーブルに挿入し、挿入ペイロードを返す */
function insertTestData(db: TestDb) {
  // SQLiteのinteger型はDateを秒精度で保存するため、ミリ秒を切り捨てて期待値と一致させる
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  const envId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const promptId = crypto.randomUUID();
  const scriptId = crypto.randomUUID();
  const patId = crypto.randomUUID();
  const devSettingsId = crypto.randomUUID();
  const sshKeyId = crypto.randomUUID();
  const nfConfigId = crypto.randomUUID();
  const nfRuleId = crypto.randomUUID();

  const environmentPayload = {
    id: envId, name: 'test-env', type: 'DOCKER', description: 'Test environment',
    config: JSON.stringify({ image: 'test:latest' }), auth_dir_path: null, project_id: null,
    created_at: now, updated_at: now,
  };
  db.insert(schema.executionEnvironments).values(environmentPayload).run();

  const projectPayload = {
    id: projectId, name: 'test-project', path: '/test/project',
    remote_url: 'https://github.com/test/repo',
    claude_code_options: JSON.stringify({ model: 'opus' }),
    custom_env_vars: JSON.stringify({ FOO: 'bar' }),
    clone_location: 'docker', docker_volume_id: 'vol-123',
    environment_id: envId, created_at: now, updated_at: now,
  };
  db.insert(schema.projects).values(projectPayload).run();

  // ExecutionEnvironment.project_id を更新
  db.update(schema.executionEnvironments)
    .set({ project_id: projectId })
    .where(eq(schema.executionEnvironments.id, envId)).run();
  (environmentPayload as Record<string, unknown>).project_id = projectId;

  const sessionPayload = {
    id: sessionId, project_id: projectId, name: 'test-session', status: 'running',
    worktree_path: '/test/.worktrees/test-session', branch_name: 'session/test-session',
    resume_session_id: 'resume-123', last_activity_at: now,
    pr_url: 'https://github.com/test/repo/pull/1', pr_number: 1, pr_status: 'open',
    pr_updated_at: null, container_id: 'container-abc',
    claude_code_options: JSON.stringify({ allowedTools: ['bash'] }),
    custom_env_vars: JSON.stringify({ CI: 'true' }),
    active_connections: 2, destroy_at: null, session_state: 'ACTIVE',
    created_at: now, updated_at: now,
  };
  db.insert(schema.sessions).values(sessionPayload).run();

  const messagePayload = {
    id: messageId, session_id: sessionId, role: 'user',
    content: 'Hello, this is test data for migration verification',
    sub_agents: JSON.stringify(['agent1', 'agent2']), created_at: now,
  };
  db.insert(schema.messages).values(messagePayload).run();

  const promptPayload = {
    id: promptId, content: 'Test prompt for migration check',
    used_count: 5, last_used_at: now, created_at: now, updated_at: now,
  };
  db.insert(schema.prompts).values(promptPayload).run();

  const runScriptPayload = {
    id: scriptId, project_id: projectId, name: 'test-script',
    description: 'Test script', command: 'npm test',
    created_at: now, updated_at: now,
  };
  db.insert(schema.runScripts).values(runScriptPayload).run();

  const githubPatPayload = {
    id: patId, name: 'test-pat', description: 'Test PAT',
    encrypted_token: 'encrypted-token-data', is_active: true,
    created_at: now, updated_at: now,
  };
  db.insert(schema.githubPats).values(githubPatPayload).run();

  const developerSettingsPayload = {
    id: devSettingsId, scope: 'GLOBAL', project_id: null,
    git_username: 'test-user', git_email: 'test@example.com',
    created_at: now, updated_at: now,
  };
  db.insert(schema.developerSettings).values(developerSettingsPayload).run();

  const sshKeyPayload = {
    id: sshKeyId, name: 'test-key', public_key: 'ssh-rsa AAAA...',
    private_key_encrypted: 'encrypted-private-key', encryption_iv: 'test-iv-value',
    has_passphrase: false, created_at: now, updated_at: now,
  };
  db.insert(schema.sshKeys).values(sshKeyPayload).run();

  const networkFilterConfigPayload = {
    id: nfConfigId, environment_id: envId, enabled: true,
    created_at: now, updated_at: now,
  };
  db.insert(schema.networkFilterConfigs).values(networkFilterConfigPayload).run();

  const networkFilterRulePayload = {
    id: nfRuleId, environment_id: envId, target: '*.example.com',
    port: 443, description: 'Allow example.com', enabled: true,
    created_at: now, updated_at: now,
  };
  db.insert(schema.networkFilterRules).values(networkFilterRulePayload).run();

  return {
    ids: { envId, projectId, sessionId, messageId, promptId,
           scriptId, patId, devSettingsId, sshKeyId, nfConfigId, nfRuleId },
    payloads: {
      environment: environmentPayload,
      project: projectPayload,
      session: sessionPayload,
      message: messagePayload,
      prompt: promptPayload,
      runScript: runScriptPayload,
      githubPat: githubPatPayload,
      developerSettings: developerSettingsPayload,
      sshKey: sshKeyPayload,
      networkFilterConfig: networkFilterConfigPayload,
      networkFilterRule: networkFilterRulePayload,
    },
  };
}

/**
 * レコードの全フィールドを厳密比較する
 * Drizzle ORMのtimestamp型はDate<->integer変換されるため、JSON.stringifyで比較する
 */
function assertRowEquals(tableName: string, actual: Record<string, unknown> | undefined, expected: Record<string, unknown>): void {
  assert(!!actual, `${tableName} レコード存在`);
  if (!actual) return;

  for (const [key, expectedVal] of Object.entries(expected)) {
    const actualVal = actual[key];
    const match = JSON.stringify(actualVal) === JSON.stringify(expectedVal);
    assert(match, `${tableName}.${key} 保全${match ? '' : ` (expected=${JSON.stringify(expectedVal)}, actual=${JSON.stringify(actualVal)})`}`);
  }
}

/** 挿入したデータが全フィールド保全されているか検証する */
function verifyTestData(
  db: TestDb,
  data: ReturnType<typeof insertTestData>,
): void {
  const { payloads, ids } = data;

  assertRowEquals('Project',
    db.select().from(schema.projects).where(eq(schema.projects.id, ids.projectId)).get(),
    payloads.project);

  assertRowEquals('ExecutionEnvironment',
    db.select().from(schema.executionEnvironments).where(eq(schema.executionEnvironments.id, ids.envId)).get(),
    payloads.environment);

  assertRowEquals('Session',
    db.select().from(schema.sessions).where(eq(schema.sessions.id, ids.sessionId)).get(),
    payloads.session);

  assertRowEquals('Message',
    db.select().from(schema.messages).where(eq(schema.messages.id, ids.messageId)).get(),
    payloads.message);

  assertRowEquals('Prompt',
    db.select().from(schema.prompts).where(eq(schema.prompts.id, ids.promptId)).get(),
    payloads.prompt);

  assertRowEquals('RunScript',
    db.select().from(schema.runScripts).where(eq(schema.runScripts.id, ids.scriptId)).get(),
    payloads.runScript);

  assertRowEquals('GitHubPAT',
    db.select().from(schema.githubPats).where(eq(schema.githubPats.id, ids.patId)).get(),
    payloads.githubPat);

  assertRowEquals('DeveloperSettings',
    db.select().from(schema.developerSettings).where(eq(schema.developerSettings.id, ids.devSettingsId)).get(),
    payloads.developerSettings);

  assertRowEquals('SshKey',
    db.select().from(schema.sshKeys).where(eq(schema.sshKeys.id, ids.sshKeyId)).get(),
    payloads.sshKey);

  assertRowEquals('NetworkFilterConfig',
    db.select().from(schema.networkFilterConfigs).where(eq(schema.networkFilterConfigs.id, ids.nfConfigId)).get(),
    payloads.networkFilterConfig);

  assertRowEquals('NetworkFilterRule',
    db.select().from(schema.networkFilterRules).where(eq(schema.networkFilterRules.id, ids.nfRuleId)).get(),
    payloads.networkFilterRule);
}

const expectedMigrationEntries = getMigrationEntryCount();

// ============================================================
// シナリオ1: 新規DB
// ============================================================

console.log('\n=== シナリオ1: 新規DB -> migrate() -> データ挿入 -> 読み取り確認 ===');
{
  const dbPath = makeTempDbPath('1');
  const { sqlite, db } = createTestDb(dbPath);

  try {
    try {
      migrate(db, { migrationsFolder });
      assert(true, 'migrate() 成功');
    } catch (e) {
      assert(false, `migrate() 失敗: ${e}`);
      throw e;
    }

    const schemaResult = validateSchemaIntegrity(sqlite);
    assert(schemaResult.valid, `スキーマ整合性 (${schemaResult.checkedTables.length}テーブル)`);

    const ids = insertTestData(db);
    assert(true, 'データ挿入成功');

    verifyTestData(db, ids);
  } finally {
    sqlite.close();
    cleanupDb(dbPath);
  }
}

// ============================================================
// シナリオ2: 既存DB(データ入り) -> migrate() -> データ保全確認
// ============================================================

console.log('\n=== シナリオ2: 既存DB(データ入り、__drizzle_migrationsなし) -> migrate() -> データ保全確認 ===');
console.log('  (旧カスタムマイグレーション済みDBからの移行シナリオ)');
{
  const dbPath = makeTempDbPath('2');
  const { sqlite, db } = createTestDb(dbPath);

  try {
    // 初期マイグレーション(CREATE TABLE IF NOT EXISTS)のみ直接実行してテーブルを作成する
    // __drizzle_migrationsは作成しない（旧カスタムマイグレーション済みDBを再現）
    // ALTER TABLEを含む増分マイグレーションはmigrate()で適用される
    try {
      applyInitialMigrationSqlDirectly(sqlite);
      assert(true, 'テーブル手動作成成功（初期マイグレーションのみ）');
    } catch (e) {
      assert(false, `テーブル作成失敗: ${e}`);
      throw e;
    }

    const hasDrizzleTable = (sqlite.prepare(
      "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
    ).get() as { cnt: number }).cnt;
    assert(hasDrizzleTable === 0, '__drizzle_migrations 未作成（旧DB状態）');

    // 初期スキーマ（ALTER TABLE前）でデータを生SQLで挿入
    // Drizzle ORMは最新スキーマのカラム全てをINSERTに含むため、旧スキーマでは使えない
    const preMigrationSessionId = crypto.randomUUID();
    const preMigrationProjectId = crypto.randomUUID();
    const preMigrationEnvId = crypto.randomUUID();
    sqlite.exec(`INSERT INTO ExecutionEnvironment (id, name, type, config, created_at, updated_at) VALUES ('${preMigrationEnvId}', 'pre-env', 'DOCKER', '{}', 1000000, 1000000)`);
    sqlite.exec(`INSERT INTO Project (id, name, path, environment_id, created_at, updated_at) VALUES ('${preMigrationProjectId}', 'pre-project', '/pre', '${preMigrationEnvId}', 1000000, 1000000)`);
    sqlite.exec(`INSERT INTO Session (id, project_id, name, status, worktree_path, branch_name, session_state, created_at, updated_at) VALUES ('${preMigrationSessionId}', '${preMigrationProjectId}', 'pre-session', 'stopped', '/pre/.worktrees/pre', 'session/pre', 'ACTIVE', 1000000, 1000000)`);
    assert(true, 'データ挿入成功（旧スキーマ、生SQL）');

    // 全テーブルのレコード数を記録
    const countBefore = getRowCounts(sqlite);

    // migrate()実行: CREATE TABLE IF NOT EXISTSにより既存テーブルはスキップされ、
    // ALTER TABLE ADD COLUMNで新カラムが追加され、
    // __drizzle_migrationsが新規作成されてマイグレーションが記録される
    try {
      migrate(db, { migrationsFolder });
      assert(true, 'migrate() 成功（既存テーブル+データあり、__drizzle_migrationsなし）');
    } catch (e) {
      assert(false, `migrate() 失敗: ${e}`);
      throw e;
    }

    // __drizzle_migrationsが作成されマイグレーションが記録された
    const migrationsAfter = sqlite.prepare("SELECT * FROM __drizzle_migrations").all();
    assert(migrationsAfter.length === expectedMigrationEntries,
      `__drizzle_migrations: ${migrationsAfter.length}エントリ（新規作成）`);

    const schemaResult = validateSchemaIntegrity(sqlite);
    assert(schemaResult.valid, `スキーマ整合性 (${schemaResult.checkedTables.length}テーブル)`);

    // 全テーブルのレコード数保全確認
    const countAfter = getRowCounts(sqlite);
    for (const table of allTableNames) {
      assert(countBefore[table] === countAfter[table], `${table} 件数保全 (${countAfter[table]})`);
    }

    // migrate()後は最新スキーマ。Drizzle ORMでデータ挿入・検証が可能
    const ids = insertTestData(db);
    verifyTestData(db, ids);

    // 旧データの新カラムがNULLであることを確認
    const preSession = sqlite.prepare(`SELECT chrome_container_id, chrome_debug_port FROM Session WHERE id = '${preMigrationSessionId}'`).get() as Record<string, unknown>;
    assert(preSession.chrome_container_id === null, 'migrate()後の旧セッション: chrome_container_id = NULL');
    assert(preSession.chrome_debug_port === null, 'migrate()後の旧セッション: chrome_debug_port = NULL');
  } finally {
    sqlite.close();
    cleanupDb(dbPath);
  }
}

// ============================================================
// シナリオ3: 冪等性（2回目のmigrate()でデータが壊れないこと）
// ============================================================

console.log('\n=== シナリオ3: 冪等性 -> migrate()を2回実行 -> データ保全確認 ===');
{
  const dbPath = makeTempDbPath('3');
  const { sqlite, db } = createTestDb(dbPath);

  try {
    try {
      migrate(db, { migrationsFolder });
      assert(true, 'migrate() 1回目成功');
    } catch (e) {
      assert(false, `migrate() 1回目失敗: ${e}`);
      throw e;
    }

    const ids = insertTestData(db);

    try {
      migrate(db, { migrationsFolder });
      assert(true, 'migrate() 2回目成功');
    } catch (e) {
      assert(false, `migrate() 2回目失敗: ${e}`);
    }

    const migrations = sqlite.prepare("SELECT * FROM __drizzle_migrations").all();
    assert(migrations.length === expectedMigrationEntries, `__drizzle_migrations: ${migrations.length}エントリ（変化なし）`);

    const schemaResult = validateSchemaIntegrity(sqlite);
    assert(schemaResult.valid, 'スキーマ整合性');

    verifyTestData(db, ids);
  } finally {
    sqlite.close();
    cleanupDb(dbPath);
  }
}

// ============================================================
// 結果サマリー
// ============================================================

console.log('\n' + '='.repeat(60));
console.log(`結果: ${totalAssertions - failedAssertions}/${totalAssertions} アサーション通過`);
if (failedAssertions > 0) {
  console.error(`${failedAssertions}件のアサーション失敗`);
  process.exit(1);
} else {
  console.log('全シナリオ通過');
}
