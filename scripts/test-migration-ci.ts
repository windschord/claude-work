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
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { validateSchemaIntegrity } from '@/lib/schema-check';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

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

/** drizzle/内の最初のマイグレーションSQLファイルを動的に取得する */
function getBaselineMigrationSql(): string {
  const journal = JSON.parse(
    fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf-8'),
  );
  const firstEntry = journal.entries[0];
  if (!firstEntry) {
    throw new Error('No migration entries found in _journal.json');
  }
  const sqlFile = path.join(migrationsFolder, `${firstEntry.tag}.sql`);
  return fs.readFileSync(sqlFile, 'utf-8');
}

/** _journal.jsonからマイグレーションエントリ数を取得する */
function getMigrationEntryCount(): number {
  const journal = JSON.parse(
    fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf-8'),
  );
  return journal.entries.length;
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

/** テスト用のサンプルデータを全テーブルに挿入する */
function insertTestData(db: ReturnType<typeof drizzle<typeof schema>>) {
  const now = new Date();
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

  db.insert(schema.executionEnvironments).values({
    id: envId, name: 'test-env', type: 'DOCKER', description: 'Test environment',
    config: JSON.stringify({ image: 'test:latest' }), project_id: null,
    created_at: now, updated_at: now,
  }).run();

  db.insert(schema.projects).values({
    id: projectId, name: 'test-project', path: '/test/project',
    remote_url: 'https://github.com/test/repo',
    claude_code_options: JSON.stringify({ model: 'opus' }),
    custom_env_vars: JSON.stringify({ FOO: 'bar' }),
    clone_location: 'docker', docker_volume_id: 'vol-123',
    environment_id: envId, created_at: now, updated_at: now,
  }).run();

  db.update(schema.executionEnvironments)
    .set({ project_id: projectId })
    .where(eq(schema.executionEnvironments.id, envId)).run();

  db.insert(schema.sessions).values({
    id: sessionId, project_id: projectId, name: 'test-session', status: 'running',
    worktree_path: '/test/.worktrees/test-session', branch_name: 'session/test-session',
    resume_session_id: 'resume-123', last_activity_at: now,
    pr_url: 'https://github.com/test/repo/pull/1', pr_number: 1, pr_status: 'open',
    container_id: 'container-abc',
    claude_code_options: JSON.stringify({ allowedTools: ['bash'] }),
    custom_env_vars: JSON.stringify({ CI: 'true' }),
    active_connections: 2, session_state: 'ACTIVE',
    created_at: now, updated_at: now,
  }).run();

  db.insert(schema.messages).values({
    id: messageId, session_id: sessionId, role: 'user',
    content: 'Hello, this is test data for migration verification',
    sub_agents: JSON.stringify(['agent1', 'agent2']), created_at: now,
  }).run();

  db.insert(schema.prompts).values({
    id: promptId, content: 'Test prompt for migration check',
    used_count: 5, last_used_at: now, created_at: now, updated_at: now,
  }).run();

  db.insert(schema.runScripts).values({
    id: scriptId, project_id: projectId, name: 'test-script',
    description: 'Test script', command: 'npm test',
    created_at: now, updated_at: now,
  }).run();

  db.insert(schema.githubPats).values({
    id: patId, name: 'test-pat', description: 'Test PAT',
    encrypted_token: 'encrypted-token-data', is_active: true,
    created_at: now, updated_at: now,
  }).run();

  db.insert(schema.developerSettings).values({
    id: devSettingsId, scope: 'GLOBAL',
    git_username: 'test-user', git_email: 'test@example.com',
    created_at: now, updated_at: now,
  }).run();

  db.insert(schema.sshKeys).values({
    id: sshKeyId, name: 'test-key', public_key: 'ssh-rsa AAAA...',
    private_key_encrypted: 'encrypted-private-key', encryption_iv: 'test-iv-value',
    has_passphrase: false, created_at: now, updated_at: now,
  }).run();

  db.insert(schema.networkFilterConfigs).values({
    id: nfConfigId, environment_id: envId, enabled: true,
    created_at: now, updated_at: now,
  }).run();

  db.insert(schema.networkFilterRules).values({
    id: nfRuleId, environment_id: envId, target: '*.example.com',
    port: 443, description: 'Allow example.com', enabled: true,
    created_at: now, updated_at: now,
  }).run();

  return {
    envId, projectId, sessionId, messageId, promptId,
    scriptId, patId, devSettingsId, sshKeyId, nfConfigId, nfRuleId,
  };
}

/** 挿入したデータが保全されているか全カラム検証する */
function verifyTestData(
  db: ReturnType<typeof drizzle<typeof schema>>,
  ids: ReturnType<typeof insertTestData>,
): void {
  // Project - 全カラム検証
  const project = db.select().from(schema.projects)
    .where(eq(schema.projects.id, ids.projectId)).get();
  assert(!!project, 'Project レコード存在');
  assert(project?.name === 'test-project', 'Project.name 保全');
  assert(project?.path === '/test/project', 'Project.path 保全');
  assert(project?.remote_url === 'https://github.com/test/repo', 'Project.remote_url 保全');
  assert(project?.environment_id === ids.envId, 'Project.environment_id 保全');
  assert(project?.clone_location === 'docker', 'Project.clone_location 保全');
  assert(project?.docker_volume_id === 'vol-123', 'Project.docker_volume_id 保全');
  assert(JSON.parse(project?.claude_code_options || '{}').model === 'opus', 'Project.claude_code_options JSON保全');
  assert(JSON.parse(project?.custom_env_vars || '{}').FOO === 'bar', 'Project.custom_env_vars JSON保全');

  // ExecutionEnvironment - 全カラム検証
  const env = db.select().from(schema.executionEnvironments)
    .where(eq(schema.executionEnvironments.id, ids.envId)).get();
  assert(!!env, 'ExecutionEnvironment レコード存在');
  assert(env?.name === 'test-env', 'ExecutionEnvironment.name 保全');
  assert(env?.type === 'DOCKER', 'ExecutionEnvironment.type 保全');
  assert(env?.description === 'Test environment', 'ExecutionEnvironment.description 保全');
  assert(env?.project_id === ids.projectId, 'ExecutionEnvironment.project_id 保全');
  assert(JSON.parse(env?.config || '{}').image === 'test:latest', 'ExecutionEnvironment.config JSON保全');

  // Session - 全カラム検証
  const session = db.select().from(schema.sessions)
    .where(eq(schema.sessions.id, ids.sessionId)).get();
  assert(!!session, 'Session レコード存在');
  assert(session?.name === 'test-session', 'Session.name 保全');
  assert(session?.status === 'running', 'Session.status 保全');
  assert(session?.worktree_path === '/test/.worktrees/test-session', 'Session.worktree_path 保全');
  assert(session?.branch_name === 'session/test-session', 'Session.branch_name 保全');
  assert(session?.resume_session_id === 'resume-123', 'Session.resume_session_id 保全');
  assert(session?.pr_url === 'https://github.com/test/repo/pull/1', 'Session.pr_url 保全');
  assert(session?.pr_number === 1, 'Session.pr_number 保全');
  assert(session?.pr_status === 'open', 'Session.pr_status 保全');
  assert(session?.container_id === 'container-abc', 'Session.container_id 保全');
  assert(session?.active_connections === 2, 'Session.active_connections 保全');
  assert(session?.session_state === 'ACTIVE', 'Session.session_state 保全');
  assert(JSON.parse(session?.claude_code_options || '{}').allowedTools?.[0] === 'bash', 'Session.claude_code_options JSON保全');
  assert(JSON.parse(session?.custom_env_vars || '{}').CI === 'true', 'Session.custom_env_vars JSON保全');

  // Message - 全カラム検証
  const message = db.select().from(schema.messages)
    .where(eq(schema.messages.id, ids.messageId)).get();
  assert(!!message, 'Message レコード存在');
  assert(message?.role === 'user', 'Message.role 保全');
  assert(message?.content?.includes('migration verification'), 'Message.content 保全');
  assert(JSON.parse(message?.sub_agents || '[]').length === 2, 'Message.sub_agents JSON保全');

  // Prompt - 全カラム検証
  const prompt = db.select().from(schema.prompts)
    .where(eq(schema.prompts.id, ids.promptId)).get();
  assert(!!prompt, 'Prompt レコード存在');
  assert(prompt?.content === 'Test prompt for migration check', 'Prompt.content 保全');
  assert(prompt?.used_count === 5, 'Prompt.used_count 保全');

  // RunScript - 全カラム検証
  const script = db.select().from(schema.runScripts)
    .where(eq(schema.runScripts.id, ids.scriptId)).get();
  assert(!!script, 'RunScript レコード存在');
  assert(script?.name === 'test-script', 'RunScript.name 保全');
  assert(script?.description === 'Test script', 'RunScript.description 保全');
  assert(script?.command === 'npm test', 'RunScript.command 保全');

  // GitHubPAT - 全カラム検証
  const pat = db.select().from(schema.githubPats)
    .where(eq(schema.githubPats.id, ids.patId)).get();
  assert(!!pat, 'GitHubPAT レコード存在');
  assert(pat?.name === 'test-pat', 'GitHubPAT.name 保全');
  assert(pat?.description === 'Test PAT', 'GitHubPAT.description 保全');
  assert(pat?.encrypted_token === 'encrypted-token-data', 'GitHubPAT.encrypted_token 保全');
  assert(pat?.is_active === true, 'GitHubPAT.is_active 保全');

  // DeveloperSettings - 全カラム検証
  const devSettings = db.select().from(schema.developerSettings)
    .where(eq(schema.developerSettings.id, ids.devSettingsId)).get();
  assert(!!devSettings, 'DeveloperSettings レコード存在');
  assert(devSettings?.scope === 'GLOBAL', 'DeveloperSettings.scope 保全');
  assert(devSettings?.git_username === 'test-user', 'DeveloperSettings.git_username 保全');
  assert(devSettings?.git_email === 'test@example.com', 'DeveloperSettings.git_email 保全');

  // SshKey - 全カラム検証
  const sshKey = db.select().from(schema.sshKeys)
    .where(eq(schema.sshKeys.id, ids.sshKeyId)).get();
  assert(!!sshKey, 'SshKey レコード存在');
  assert(sshKey?.name === 'test-key', 'SshKey.name 保全');
  assert(sshKey?.public_key === 'ssh-rsa AAAA...', 'SshKey.public_key 保全');
  assert(sshKey?.private_key_encrypted === 'encrypted-private-key', 'SshKey.private_key_encrypted 保全');
  assert(sshKey?.encryption_iv === 'test-iv-value', 'SshKey.encryption_iv 保全');
  assert(sshKey?.has_passphrase === false, 'SshKey.has_passphrase 保全');

  // NetworkFilterConfig - 全カラム検証
  const nfConfig = db.select().from(schema.networkFilterConfigs)
    .where(eq(schema.networkFilterConfigs.id, ids.nfConfigId)).get();
  assert(!!nfConfig, 'NetworkFilterConfig レコード存在');
  assert(nfConfig?.environment_id === ids.envId, 'NetworkFilterConfig.environment_id 保全');
  assert(nfConfig?.enabled === true, 'NetworkFilterConfig.enabled 保全');

  // NetworkFilterRule - 全カラム検証
  const nfRule = db.select().from(schema.networkFilterRules)
    .where(eq(schema.networkFilterRules.id, ids.nfRuleId)).get();
  assert(!!nfRule, 'NetworkFilterRule レコード存在');
  assert(nfRule?.environment_id === ids.envId, 'NetworkFilterRule.environment_id 保全');
  assert(nfRule?.target === '*.example.com', 'NetworkFilterRule.target 保全');
  assert(nfRule?.port === 443, 'NetworkFilterRule.port 保全');
  assert(nfRule?.description === 'Allow example.com', 'NetworkFilterRule.description 保全');
  assert(nfRule?.enabled === true, 'NetworkFilterRule.enabled 保全');
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
    migrate(db, { migrationsFolder });
    assert(true, 'migrate() 成功');
  } catch (e) {
    assert(false, `migrate() 失敗: ${e}`);
    process.exit(1);
  }

  const schemaResult = validateSchemaIntegrity(sqlite);
  assert(schemaResult.valid, `スキーマ整合性 (${schemaResult.checkedTables.length}テーブル)`);

  const ids = insertTestData(db);
  assert(true, 'データ挿入成功');

  verifyTestData(db, ids);

  sqlite.close();
  cleanupDb(dbPath);
}

// ============================================================
// シナリオ2: 既存DB(データ入り) -> migrate() -> データ保全確認
// ============================================================

console.log('\n=== シナリオ2: 既存DB(データ入り) -> migrate() -> データ保全確認 ===');
{
  const dbPath = makeTempDbPath('2');
  const { sqlite, db } = createTestDb(dbPath);

  // マイグレーションSQLを動的に取得してテーブルを手動作成（__drizzle_migrationsなし）
  try {
    const migrationSql = getBaselineMigrationSql();
    const statements = migrationSql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    sqlite.transaction(() => {
      for (const stmt of statements) {
        sqlite.exec(stmt);
      }
    })();
    assert(true, 'テーブル手動作成成功');
  } catch (e) {
    assert(false, `テーブル手動作成失敗: ${e}`);
    process.exit(1);
  }

  const hasDrizzleTable = sqlite.prepare(
    "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
  ).get() as { cnt: number };
  assert(hasDrizzleTable.cnt === 0, '__drizzle_migrations 未作成（既存DB状態）');

  const ids = insertTestData(db);
  assert(true, 'データ挿入成功');

  // 全テーブルのレコード数を記録
  const countBefore = getRowCounts(sqlite);

  try {
    migrate(db, { migrationsFolder });
    assert(true, 'migrate() 成功（既存テーブル+データあり）');
  } catch (e) {
    assert(false, `migrate() 失敗: ${e}`);
    process.exit(1);
  }

  const migrations = sqlite.prepare("SELECT * FROM __drizzle_migrations").all();
  assert(migrations.length === expectedMigrationEntries, `__drizzle_migrations: ${migrations.length}エントリ`);

  const schemaResult = validateSchemaIntegrity(sqlite);
  assert(schemaResult.valid, `スキーマ整合性 (${schemaResult.checkedTables.length}テーブル)`);

  // 全テーブルのレコード数保全確認
  const countAfter = getRowCounts(sqlite);
  for (const table of allTableNames) {
    assert(countBefore[table] === countAfter[table], `${table} 件数保全 (${countAfter[table]})`);
  }

  verifyTestData(db, ids);

  sqlite.close();
  cleanupDb(dbPath);
}

// ============================================================
// シナリオ3: 冪等性（2回目のmigrate()でデータが壊れないこと）
// ============================================================

console.log('\n=== シナリオ3: 冪等性 -> migrate()を2回実行 -> データ保全確認 ===');
{
  const dbPath = makeTempDbPath('3');
  const { sqlite, db } = createTestDb(dbPath);

  try {
    migrate(db, { migrationsFolder });
    assert(true, 'migrate() 1回目成功');
  } catch (e) {
    assert(false, `migrate() 1回目失敗: ${e}`);
    process.exit(1);
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

  sqlite.close();
  cleanupDb(dbPath);
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
