ALTER TABLE `bookings` ADD `meal_type` text DEFAULT 'unspecified' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `party_size` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `companions` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `contact` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `address` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `bookings` ADD `longitude` real;