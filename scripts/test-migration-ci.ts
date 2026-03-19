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

function createTestDb(dbPath: string) {
  // 既存ファイルをクリーンアップ
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

  // ExecutionEnvironment
  db.insert(schema.executionEnvironments).values({
    id: envId,
    name: 'test-env',
    type: 'DOCKER',
    description: 'Test environment',
    config: JSON.stringify({ image: 'test:latest' }),
    project_id: null,
    created_at: now,
    updated_at: now,
  }).run();

  // Project
  db.insert(schema.projects).values({
    id: projectId,
    name: 'test-project',
    path: '/test/project',
    remote_url: 'https://github.com/test/repo',
    claude_code_options: JSON.stringify({ model: 'opus' }),
    custom_env_vars: JSON.stringify({ FOO: 'bar' }),
    clone_location: 'docker',
    environment_id: envId,
    created_at: now,
    updated_at: now,
  }).run();

  // ExecutionEnvironment.project_id を更新
  db.update(schema.executionEnvironments)
    .set({ project_id: projectId })
    .where(eq(schema.executionEnvironments.id, envId))
    .run();

  // Session
  db.insert(schema.sessions).values({
    id: sessionId,
    project_id: projectId,
    name: 'test-session',
    status: 'running',
    worktree_path: '/test/.worktrees/test-session',
    branch_name: 'session/test-session',
    resume_session_id: 'resume-123',
    last_activity_at: now,
    active_connections: 2,
    session_state: 'ACTIVE',
    created_at: now,
    updated_at: now,
  }).run();

  // Message
  db.insert(schema.messages).values({
    id: messageId,
    session_id: sessionId,
    role: 'user',
    content: 'Hello, this is test data for migration verification',
    sub_agents: JSON.stringify(['agent1', 'agent2']),
    created_at: now,
  }).run();

  // Prompt
  db.insert(schema.prompts).values({
    id: promptId,
    content: 'Test prompt for migration check',
    used_count: 5,
    last_used_at: now,
    created_at: now,
    updated_at: now,
  }).run();

  // RunScript
  db.insert(schema.runScripts).values({
    id: scriptId,
    project_id: projectId,
    name: 'test-script',
    description: 'Test script',
    command: 'npm test',
    created_at: now,
    updated_at: now,
  }).run();

  // GitHubPAT
  db.insert(schema.githubPats).values({
    id: patId,
    name: 'test-pat',
    description: 'Test PAT',
    encrypted_token: 'encrypted-token-data',
    is_active: true,
    created_at: now,
    updated_at: now,
  }).run();

  // DeveloperSettings
  db.insert(schema.developerSettings).values({
    id: devSettingsId,
    scope: 'GLOBAL',
    git_username: 'test-user',
    git_email: 'test@example.com',
    created_at: now,
    updated_at: now,
  }).run();

  // SshKey
  db.insert(schema.sshKeys).values({
    id: sshKeyId,
    name: 'test-key',
    public_key: 'ssh-rsa AAAA...',
    private_key_encrypted: 'encrypted-private-key',
    encryption_iv: 'test-iv-value',
    has_passphrase: false,
    created_at: now,
    updated_at: now,
  }).run();

  // NetworkFilterConfig
  db.insert(schema.networkFilterConfigs).values({
    id: nfConfigId,
    environment_id: envId,
    enabled: true,
    created_at: now,
    updated_at: now,
  }).run();

  // NetworkFilterRule
  db.insert(schema.networkFilterRules).values({
    id: nfRuleId,
    environment_id: envId,
    target: '*.example.com',
    port: 443,
    description: 'Allow example.com',
    enabled: true,
    created_at: now,
    updated_at: now,
  }).run();

  return {
    envId, projectId, sessionId, messageId, promptId,
    scriptId, patId, devSettingsId, sshKeyId, nfConfigId, nfRuleId,
  };
}

/** 挿入したデータが保全されているか検証する */
function verifyTestData(
  db: ReturnType<typeof drizzle<typeof schema>>,
  ids: ReturnType<typeof insertTestData>,
): void {
  // Project
  const project = db.select().from(schema.projects)
    .where(eq(schema.projects.id, ids.projectId)).get();
  assert(!!project, 'Project レコード存在');
  assert(project?.name === 'test-project', 'Project.name 保全');
  assert(project?.remote_url === 'https://github.com/test/repo', 'Project.remote_url 保全');
  assert(project?.environment_id === ids.envId, 'Project.environment_id 保全');
  assert(project?.clone_location === 'docker', 'Project.clone_location 保全');
  const opts = JSON.parse(project?.claude_code_options || '{}');
  assert(opts.model === 'opus', 'Project.claude_code_options JSON保全');

  // ExecutionEnvironment
  const env = db.select().from(schema.executionEnvironments)
    .where(eq(schema.executionEnvironments.id, ids.envId)).get();
  assert(!!env, 'ExecutionEnvironment レコード存在');
  assert(env?.type === 'DOCKER', 'ExecutionEnvironment.type 保全');
  assert(env?.project_id === ids.projectId, 'ExecutionEnvironment.project_id 保全');

  // Session
  const session = db.select().from(schema.sessions)
    .where(eq(schema.sessions.id, ids.sessionId)).get();
  assert(!!session, 'Session レコード存在');
  assert(session?.status === 'running', 'Session.status 保全');
  assert(session?.active_connections === 2, 'Session.active_connections 保全');
  assert(session?.session_state === 'ACTIVE', 'Session.session_state 保全');
  assert(session?.resume_session_id === 'resume-123', 'Session.resume_session_id 保全');

  // Message
  const message = db.select().from(schema.messages)
    .where(eq(schema.messages.id, ids.messageId)).get();
  assert(!!message, 'Message レコード存在');
  assert(message?.content?.includes('migration verification'), 'Message.content 保全');
  const subAgents = JSON.parse(message?.sub_agents || '[]');
  assert(subAgents.length === 2, 'Message.sub_agents JSON保全');

  // Prompt
  const prompt = db.select().from(schema.prompts)
    .where(eq(schema.prompts.id, ids.promptId)).get();
  assert(!!prompt, 'Prompt レコード存在');
  assert(prompt?.used_count === 5, 'Prompt.used_count 保全');

  // RunScript
  const script = db.select().from(schema.runScripts)
    .where(eq(schema.runScripts.id, ids.scriptId)).get();
  assert(!!script, 'RunScript レコード存在');
  assert(script?.command === 'npm test', 'RunScript.command 保全');

  // GitHubPAT
  const pat = db.select().from(schema.githubPats)
    .where(eq(schema.githubPats.id, ids.patId)).get();
  assert(!!pat, 'GitHubPAT レコード存在');
  assert(pat?.is_active === true, 'GitHubPAT.is_active 保全');
  assert(pat?.encrypted_token === 'encrypted-token-data', 'GitHubPAT.encrypted_token 保全');

  // DeveloperSettings
  const devSettings = db.select().from(schema.developerSettings)
    .where(eq(schema.developerSettings.id, ids.devSettingsId)).get();
  assert(!!devSettings, 'DeveloperSettings レコード存在');
  assert(devSettings?.git_username === 'test-user', 'DeveloperSettings.git_username 保全');
  assert(devSettings?.scope === 'GLOBAL', 'DeveloperSettings.scope 保全');

  // SshKey
  const sshKey = db.select().from(schema.sshKeys)
    .where(eq(schema.sshKeys.id, ids.sshKeyId)).get();
  assert(!!sshKey, 'SshKey レコード存在');
  assert(sshKey?.public_key === 'ssh-rsa AAAA...', 'SshKey.public_key 保全');

  // NetworkFilterConfig
  const nfConfig = db.select().from(schema.networkFilterConfigs)
    .where(eq(schema.networkFilterConfigs.id, ids.nfConfigId)).get();
  assert(!!nfConfig, 'NetworkFilterConfig レコード存在');
  assert(nfConfig?.enabled === true, `NetworkFilterConfig.enabled 保全 (${nfConfig?.enabled})`);

  // NetworkFilterRule
  const nfRule = db.select().from(schema.networkFilterRules)
    .where(eq(schema.networkFilterRules.id, ids.nfRuleId)).get();
  assert(!!nfRule, 'NetworkFilterRule レコード存在');
  assert(nfRule?.target === '*.example.com', 'NetworkFilterRule.target 保全');
  assert(nfRule?.port === 443, 'NetworkFilterRule.port 保全');
}

// ============================================================
// シナリオ1: 新規DB
// ============================================================

console.log('\n=== シナリオ1: 新規DB -> migrate() -> データ挿入 -> 読み取り確認 ===');
{
  const dbPath = '/tmp/test-migration-ci-1.db';
  const { sqlite, db } = createTestDb(dbPath);

  // マイグレーション実行
  try {
    migrate(db, { migrationsFolder });
    assert(true, 'migrate() 成功');
  } catch (e) {
    assert(false, `migrate() 失敗: ${e}`);
    process.exit(1);
  }

  // スキーマ整合性チェック
  const schemaResult = validateSchemaIntegrity(sqlite);
  assert(schemaResult.valid, `スキーマ整合性 (${schemaResult.checkedTables.length}テーブル)`);

  // データ挿入
  const ids = insertTestData(db);
  assert(true, 'データ挿入成功');

  // データ読み取り確認
  verifyTestData(db, ids);

  sqlite.close();
  cleanupDb(dbPath);
}

// ============================================================
// シナリオ2: 既存DB(データ入り) -> migrate() -> データ保全確認
// ============================================================

console.log('\n=== シナリオ2: 既存DB(データ入り) -> migrate() -> データ保全確認 ===');
{
  const dbPath = '/tmp/test-migration-ci-2.db';
  const { sqlite, db } = createTestDb(dbPath);

  // 最新スキーマでテーブル作成（db:push相当）
  // drizzle-kit pushと同等の結果を得るため、マイグレーションSQLを直接実行
  const migrationSql = fs.readFileSync(
    path.join(migrationsFolder, '0000_condemned_namora.sql'),
    'utf-8',
  );
  // --> statement-breakpoint で分割して実行
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  for (const stmt of statements) {
    sqlite.exec(stmt);
  }
  assert(true, 'テーブル手動作成成功');

  // __drizzle_migrationsは存在しない状態を確認
  const hasDrizzleTable = sqlite.prepare(
    "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
  ).get() as { cnt: number };
  assert(hasDrizzleTable.cnt === 0, '__drizzle_migrations 未作成（既存DB状態）');

  // データ挿入
  const ids = insertTestData(db);
  assert(true, 'データ挿入成功');

  // レコード数を記録
  const countBefore = {
    projects: (sqlite.prepare('SELECT count(*) as cnt FROM Project').get() as { cnt: number }).cnt,
    sessions: (sqlite.prepare('SELECT count(*) as cnt FROM Session').get() as { cnt: number }).cnt,
    messages: (sqlite.prepare('SELECT count(*) as cnt FROM Message').get() as { cnt: number }).cnt,
    environments: (sqlite.prepare('SELECT count(*) as cnt FROM ExecutionEnvironment').get() as { cnt: number }).cnt,
  };

  // マイグレーション実行（既存テーブル+データあり）
  try {
    migrate(db, { migrationsFolder });
    assert(true, 'migrate() 成功（既存テーブル+データあり）');
  } catch (e) {
    assert(false, `migrate() 失敗: ${e}`);
    process.exit(1);
  }

  // __drizzle_migrationsが作成された
  const migrations = sqlite.prepare("SELECT * FROM __drizzle_migrations").all();
  assert(migrations.length === 1, `__drizzle_migrations: ${migrations.length}エントリ`);

  // スキーマ整合性チェック
  const schemaResult = validateSchemaIntegrity(sqlite);
  assert(schemaResult.valid, `スキーマ整合性 (${schemaResult.checkedTables.length}テーブル)`);

  // レコード数が変わっていないことを確認
  const countAfter = {
    projects: (sqlite.prepare('SELECT count(*) as cnt FROM Project').get() as { cnt: number }).cnt,
    sessions: (sqlite.prepare('SELECT count(*) as cnt FROM Session').get() as { cnt: number }).cnt,
    messages: (sqlite.prepare('SELECT count(*) as cnt FROM Message').get() as { cnt: number }).cnt,
    environments: (sqlite.prepare('SELECT count(*) as cnt FROM ExecutionEnvironment').get() as { cnt: number }).cnt,
  };
  assert(countBefore.projects === countAfter.projects, `Project件数保全 (${countAfter.projects})`);
  assert(countBefore.sessions === countAfter.sessions, `Session件数保全 (${countAfter.sessions})`);
  assert(countBefore.messages === countAfter.messages, `Message件数保全 (${countAfter.messages})`);
  assert(countBefore.environments === countAfter.environments, `ExecutionEnvironment件数保全 (${countAfter.environments})`);

  // データ内容の保全確認
  verifyTestData(db, ids);

  sqlite.close();
  cleanupDb(dbPath);
}

// ============================================================
// シナリオ3: 冪等性（2回目のmigrate()でデータが壊れないこと）
// ============================================================

console.log('\n=== シナリオ3: 冪等性 -> migrate()を2回実行 -> データ保全確認 ===');
{
  const dbPath = '/tmp/test-migration-ci-3.db';
  const { sqlite, db } = createTestDb(dbPath);

  // 1回目のマイグレーション
  migrate(db, { migrationsFolder });

  // データ挿入
  const ids = insertTestData(db);

  // 2回目のマイグレーション
  try {
    migrate(db, { migrationsFolder });
    assert(true, 'migrate() 2回目成功');
  } catch (e) {
    assert(false, `migrate() 2回目失敗: ${e}`);
  }

  // __drizzle_migrationsのエントリ数が変わっていない
  const migrations = sqlite.prepare("SELECT * FROM __drizzle_migrations").all();
  assert(migrations.length === 1, `__drizzle_migrations: ${migrations.length}エントリ（変化なし）`);

  // スキーマ整合性チェック
  const schemaResult = validateSchemaIntegrity(sqlite);
  assert(schemaResult.valid, 'スキーマ整合性');

  // データ保全確認
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
