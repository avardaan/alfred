CREATE TABLE `call_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`type` text NOT NULL,
	`attempt_number` integer DEFAULT 1 NOT NULL,
	`elevenlabs_conversation_id` text,
	`elevenlabs_batch_call_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`failure_reason` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `call_attempts_task_id_idx` ON `call_attempts` (`task_id`);--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`originating_conversation_id` text,
	`channel` text,
	`originating_caller_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `episodes_user_id_idx` ON `episodes` (`user_id`);--> statement-breakpoint
CREATE INDEX `episodes_originating_conversation_idx` ON `episodes` (`originating_conversation_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`episode_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`details` text NOT NULL,
	`outcome` text,
	`scheduled_for` integer,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_episode_id_idx` ON `tasks` (`episode_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone_numbers` text NOT NULL,
	`primary_location` text,
	`created_at` integer NOT NULL
);
