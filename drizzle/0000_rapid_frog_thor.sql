CREATE TABLE `approvals` (
	`booking_id` text PRIMARY KEY NOT NULL,
	`week` text NOT NULL,
	`slot` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `week_slot` ON `approvals` (`week`,`slot`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`restaurant` text NOT NULL,
	`meal_at` text NOT NULL,
	`week` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`created` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `challenges` (
	`email` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`purpose` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`message` text NOT NULL,
	`created` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rates` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`must_change` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX one_active_booking ON bookings(user_id) WHERE status IN ('pending','approved');
--> statement-breakpoint
CREATE INDEX bookings_week_status ON bookings(week,status);
--> statement-breakpoint
CREATE INDEX notices_user ON notices(user_id,id);
--> statement-breakpoint
CREATE TRIGGER booking_quota_guard BEFORE INSERT ON bookings BEGIN
 SELECT CASE WHEN (SELECT count(*) FROM approvals WHERE week=NEW.week)>=2 OR (SELECT count(*) FROM approvals WHERE week=date('now','+8 hours','-' || ((CAST(strftime('%w','now','+8 hours') AS INTEGER)+6)%7) || ' days'))>=2 THEN RAISE(ABORT,'QUOTA_FULL') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings WHERE user_id=NEW.user_id AND status IN ('pending','approved')) THEN RAISE(ABORT,'ACTIVE_BOOKING') END;
END;
--> statement-breakpoint
CREATE TRIGGER booking_notice AFTER UPDATE OF status ON bookings WHEN NEW.status IN ('approved','rejected') AND OLD.status != NEW.status BEGIN
 INSERT INTO notices(user_id,message,created) VALUES(NEW.user_id,CASE WHEN NEW.status='approved' THEN '你的预约已批准：' || NEW.restaurant || '。请按约定时间赴约。' ELSE '你的预约已拒绝：' || NEW.restaurant || '。拒绝理由：' || COALESCE(NULLIF(NEW.reason,''),'未填写理由') END,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
