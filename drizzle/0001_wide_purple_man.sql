ALTER TABLE `Project` ADD `claude_code_options` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `Project` ADD `custom_env_vars` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `Session` ADD `claude_code_options` text;--> statement-breakpoint
ALTER TABLE `Session` ADD `custom_env_vars` text;--> statement-breakpoint
ALTER TABLE `Session` ADD `active_connections` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `Session` ADD `destroy_at` integer;--> statement-breakpoint
ALTER TABLE `Session` ADD `session_state` text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
CREATE INDEX `sessions_session_state_idx` ON `Session` (`session_state`);--> statement-breakpoint
CREATE INDEX `sessions_destroy_at_idx` ON `Session` (`destroy_at`);--> statement-breakpoint
CREATE INDEX `sessions_last_activity_at_idx` ON `Session` (`last_activity_at`);
