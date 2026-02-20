DROP INDEX `developer_settings_scope_project_id_key`;--> statement-breakpoint
CREATE UNIQUE INDEX `developer_settings_global_unique` ON `DeveloperSettings` (`scope`) WHERE scope = 'GLOBAL';--> statement-breakpoint
CREATE UNIQUE INDEX `developer_settings_project_unique` ON `DeveloperSettings` (`project_id`) WHERE scope = 'PROJECT' AND project_id IS NOT NULL;