ALTER TABLE `bookings` ADD `coordinate_system` text DEFAULT 'wgs84' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `nickname` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_key` text;