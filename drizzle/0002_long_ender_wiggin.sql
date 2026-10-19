CREATE TABLE `final_exam_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`questions` text NOT NULL,
	`answers` text DEFAULT '{}' NOT NULL,
	`assessments` text DEFAULT '{}' NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
