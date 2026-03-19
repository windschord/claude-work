CREATE TABLE IF NOT EXISTS `DeveloperSettings` (
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
CREATE INDEX IF NOT EXISTS `developer_settings_scope_project_id_idx` ON `DeveloperSettings` (`scope`,`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `developer_settings_global_unique` ON `DeveloperSettings` (`scope`) WHERE scope = 'GLOBAL';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `developer_settings_project_unique` ON `DeveloperSettings` (`project_id`) WHERE scope = 'PROJECT' AND project_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ExecutionEnvironment` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`config` text NOT NULL,
	`auth_dir_path` text,
	`project_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ExecutionEnvironment_project_id_unique` ON `ExecutionEnvironment` (`project_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `GitHubPAT` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`encrypted_token` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Message` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`sub_agents` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `Session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `NetworkFilterConfig` (
	`id` text PRIMARY KEY NOT NULL,
	`environment_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`environment_id`) REFERENCES `ExecutionEnvironment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `NetworkFilterConfig_environment_id_unique` ON `NetworkFilterConfig` (`environment_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `NetworkFilterRule` (
	`id` text PRIMARY KEY NOT NULL,
	`environment_id` text NOT NULL,
	`target` text NOT NULL,
	`port` integer,
	`description` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`environment_id`) REFERENCES `ExecutionEnvironment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Project` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`remote_url` text,
	`claude_code_options` text DEFAULT '{}' NOT NULL,
	`custom_env_vars` text DEFAULT '{}' NOT NULL,
	`clone_location` text DEFAULT 'docker',
	`docker_volume_id` text,
	`environment_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`environment_id`) REFERENCES `ExecutionEnvironment`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `Project_path_unique` ON `Project` (`path`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `Project_environment_id_unique` ON `Project` (`environment_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Prompt` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`used_count` integer DEFAULT 1 NOT NULL,
	`last_used_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `Prompt_content_unique` ON `Prompt` (`content`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `RunScript` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`command` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `run_scripts_project_id_idx` ON `RunScript` (`project_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Session` (
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
CREATE INDEX IF NOT EXISTS `sessions_session_state_idx` ON `Session` (`session_state`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sessions_destroy_at_idx` ON `Session` (`destroy_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sessions_last_activity_at_idx` ON `Session` (`last_activity_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `SshKey` (
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
CREATE UNIQUE INDEX IF NOT EXISTS `SshKey_name_unique` ON `SshKey` (`name`);