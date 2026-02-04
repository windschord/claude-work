CREATE TABLE `ExecutionEnvironment` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`config` text NOT NULL,
	`auth_dir_path` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Message` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`sub_agents` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `Session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Project` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`remote_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Project_path_unique` ON `Project` (`path`);--> statement-breakpoint
CREATE TABLE `Prompt` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`used_count` integer DEFAULT 1 NOT NULL,
	`last_used_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Prompt_content_unique` ON `Prompt` (`content`);--> statement-breakpoint
CREATE TABLE `RunScript` (
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
CREATE INDEX `run_scripts_project_id_idx` ON `RunScript` (`project_id`);--> statement-breakpoint
CREATE TABLE `Session` (
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
	`environment_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `Project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `ExecutionEnvironment`(`id`) ON UPDATE no action ON DELETE set null
);
