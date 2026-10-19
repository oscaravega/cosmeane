CREATE TABLE `study_lessons` (
	`lesson_id` text PRIMARY KEY NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
