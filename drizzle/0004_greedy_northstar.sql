ALTER TABLE `users` ADD `username` text;--> statement-breakpoint
ALTER TABLE `users` ADD `username_changed_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);