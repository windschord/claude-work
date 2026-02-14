import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ==================== テーブル定義 ====================

/**
 * projects テーブル
 * Gitリポジトリプロジェクトを管理
 */
export const projects = sqliteTable('Project', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  remote_url: text('remote_url'),
  claude_code_options: text('claude_code_options').notNull().default('{}'),
  custom_env_vars: text('custom_env_vars').notNull().default('{}'),

  // ハイブリッド設計: リポジトリの保存場所
  // 'host': ホスト環境（data/repos/）
  // 'docker': Docker環境（Dockerボリューム）
  // 既存プロジェクトはnullの場合、'host'として扱う
  clone_location: text('clone_location').default('docker'), // 'host' | 'docker'

  // Docker環境の場合のボリューム名
  // 形式: claude-repo-<project-id>
  // ホスト環境の場合はnull
  docker_volume_id: text('docker_volume_id'),

  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * execution_environments テーブル
 * 実行環境（HOST, DOCKER, SSH）を管理
 */
export const executionEnvironments = sqliteTable('ExecutionEnvironment', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'HOST' | 'DOCKER' | 'SSH'
  description: text('description'),
  config: text('config').notNull(),
  auth_dir_path: text('auth_dir_path'),
  is_default: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * sessions テーブル
 * Claude Codeセッションを管理
 */
export const sessions = sqliteTable('Session', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  project_id: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').notNull(), // initializing, running, waiting_input, completed, error, stopped (legacy field)
  worktree_path: text('worktree_path').notNull(),
  branch_name: text('branch_name').notNull(),
  resume_session_id: text('resume_session_id'),
  last_activity_at: integer('last_activity_at', { mode: 'timestamp' }),
  pr_url: text('pr_url'),
  pr_number: integer('pr_number'),
  pr_status: text('pr_status'),
  pr_updated_at: integer('pr_updated_at', { mode: 'timestamp' }),
  docker_mode: integer('docker_mode', { mode: 'boolean' }).notNull().default(false),
  container_id: text('container_id'),
  environment_id: text('environment_id').references(() => executionEnvironments.id, { onDelete: 'set null' }),
  claude_code_options: text('claude_code_options'),
  custom_env_vars: text('custom_env_vars'),

  // Phase 4で追加: 状態管理フィールド
  active_connections: integer('active_connections').notNull().default(0),
  destroy_at: integer('destroy_at', { mode: 'timestamp' }),
  session_state: text('session_state').notNull().default('ACTIVE'), // ACTIVE, IDLE, ERROR, TERMINATED

  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('sessions_session_state_idx').on(table.session_state),
  index('sessions_destroy_at_idx').on(table.destroy_at),
  index('sessions_last_activity_at_idx').on(table.last_activity_at),
]);

/**
 * messages テーブル
 * セッション内のチャットメッセージを管理
 */
export const messages = sqliteTable('Message', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  session_id: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  sub_agents: text('sub_agents'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * prompts テーブル
 * プロンプト履歴を管理
 */
export const prompts = sqliteTable('Prompt', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  content: text('content').notNull().unique(),
  used_count: integer('used_count').notNull().default(1),
  last_used_at: integer('last_used_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * run_scripts テーブル
 * プロジェクト固有の実行スクリプトを管理
 */
export const runScripts = sqliteTable('RunScript', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  project_id: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  command: text('command').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index('run_scripts_project_id_idx').on(table.project_id),
]);

/**
 * github_pats テーブル
 * GitHub Personal Access Tokenを管理
 */
export const githubPats = sqliteTable('GitHubPAT', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  encrypted_token: text('encrypted_token').notNull(),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ==================== リレーション定義 ====================

export const projectsRelations = relations(projects, ({ many }) => ({
  sessions: many(sessions),
  scripts: many(runScripts),
}));

export const executionEnvironmentsRelations = relations(executionEnvironments, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  project: one(projects, {
    fields: [sessions.project_id],
    references: [projects.id],
  }),
  environment: one(executionEnvironments, {
    fields: [sessions.environment_id],
    references: [executionEnvironments.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, {
    fields: [messages.session_id],
    references: [sessions.id],
  }),
}));

export const promptsRelations = relations(prompts, () => ({}));

export const githubPatsRelations = relations(githubPats, () => ({}));

export const runScriptsRelations = relations(runScripts, ({ one }) => ({
  project: one(projects, {
    fields: [runScripts.project_id],
    references: [projects.id],
  }),
}));

// ==================== 型エクスポート ====================

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ExecutionEnvironment = typeof executionEnvironments.$inferSelect;
export type NewExecutionEnvironment = typeof executionEnvironments.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;

export type RunScript = typeof runScripts.$inferSelect;
export type NewRunScript = typeof runScripts.$inferInsert;

export type GitHubPAT = typeof githubPats.$inferSelect;
export type NewGitHubPAT = typeof githubPats.$inferInsert;
