CREATE TABLE `DeveloperSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`project_id` text,
	`git_username` text,
	`git_email` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `developer_settings_scope_project_id_idx` ON `DeveloperSettings` (`scope`,`project_id`);--> statement-breakpoint
CREATE TABLE `GitHubPAT` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`encrypted_token` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `SshKey` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`public_key` text NOT NULL,
	`private_key_encrypted` text NOT NULL,
	`encryption_iv` text NOT NULL,
	`has_passphrase` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `SshKey_name_unique` ON `SshKey` (`name`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Session` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`worktree_path` text NOT NULL,
	`branch_name` text NOT NULL,
	`resume_session_id` text,
	`last_activity_at` integer,
	`pr_url` text,
	`pr_number` integer,
	`pr_status` text,
	`pr_updated_at` integer,
	`docker_mode` integer DEFAULT false NOT NULL,
	`container_id` text,
	`claude_code_options` text,
	`custom_env_vars` text,
	`active_connections` integer DEFAULT 0 NOT NULL,
	`destroy_at` integer,
	`session_state` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Session`("id", "project_id", "name", "status", "worktree_path", "branch_name", "resume_session_id", "last_activity_at", "pr_url", "pr_number", "pr_status", "pr_updated_at", "docker_mode", "container_id", "claude_code_options", "custom_env_vars", "active_connections", "destroy_at", "session_state", "created_at", "updated_at") SELECT "id", "project_id", "name", "status", "worktree_path", "branch_name", "resume_session_id", "last_activity_at", "pr_url", "pr_number", "pr_status", "pr_updated_at", "docker_mode", "container_id", "claude_code_options", "custom_env_vars", "active_connections", "destroy_at", "session_state", "created_at", "updated_at" FROM `Session`;--> statement-breakpoint
DROP TABLE `Session`;--> statement-breakpoint
ALTER TABLE `__new_Session` RENAME TO `Session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sessions_session_state_idx` ON `Session` (`session_state`);--> statement-breakpoint
CREATE INDEX `sessions_destroy_at_idx` ON `Session` (`destroy_at`);--> statement-breakpoint
CREATE INDEX `sessions_last_activity_at_idx` ON `Session` (`last_activity_at`);--> statement-breakpoint
ALTER TABLE `Project` ADD `environment_id` text REFERENCES ExecutionEnvironment(id);