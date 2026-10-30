CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`details` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_limits` (
	`week` text PRIMARY KEY NOT NULL,
	`meal_limit` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `disabled` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DROP TRIGGER booking_quota_guard;
--> statement-breakpoint
CREATE TRIGGER booking_quota_guard BEFORE INSERT ON bookings BEGIN
 SELECT CASE WHEN (SELECT count(*) FROM approvals WHERE week=NEW.week)>=COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=NEW.week),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2) OR (SELECT count(*) FROM approvals WHERE week=date('now','+8 hours','-' || ((CAST(strftime('%w','now','+8 hours') AS INTEGER)+6)%7) || ' days'))>=COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=date('now','+8 hours','-' || ((CAST(strftime('%w','now','+8 hours') AS INTEGER)+6)%7) || ' days')),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2) THEN RAISE(ABORT,'QUOTA_FULL') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings WHERE user_id=NEW.user_id AND status IN ('pending','approved')) THEN RAISE(ABORT,'ACTIVE_BOOKING') END;
END;
--> statement-breakpoint
CREATE TRIGGER approval_limit_guard BEFORE INSERT ON approvals BEGIN
 SELECT CASE WHEN (SELECT count(*) FROM approvals WHERE week=NEW.week)>=COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=NEW.week),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2) THEN RAISE(ABORT,'QUOTA_FULL') END;
END;

--> statement-breakpoint
CREATE TRIGGER limit_guard_insert BEFORE INSERT ON weekly_limits BEGIN
 SELECT CASE WHEN NEW.meal_limit<0 OR NEW.meal_limit>100 OR EXISTS(SELECT 1 FROM approvals a WHERE (NEW.week=a.week OR (NEW.week='default' AND NOT EXISTS(SELECT 1 FROM weekly_limits l WHERE l.week=a.week))) GROUP BY a.week HAVING count(*)>NEW.meal_limit) THEN RAISE(ABORT,'QUOTA_BELOW_USED') END;
END;
--> statement-breakpoint
CREATE TRIGGER reject_full_insert AFTER INSERT ON weekly_limits BEGIN
 UPDATE bookings SET status='rejected',reason='本周放纵餐指标已达到最大值，请下周再试。' WHERE status='pending' AND (SELECT count(*) FROM approvals WHERE week=bookings.week)>=COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=bookings.week),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2);
END;

--> statement-breakpoint
CREATE TRIGGER limit_guard_update BEFORE UPDATE ON weekly_limits BEGIN
 SELECT CASE WHEN NEW.meal_limit<0 OR NEW.meal_limit>100 OR EXISTS(SELECT 1 FROM approvals a WHERE (NEW.week=a.week OR (NEW.week='default' AND NOT EXISTS(SELECT 1 FROM weekly_limits l WHERE l.week=a.week))) GROUP BY a.week HAVING count(*)>NEW.meal_limit) THEN RAISE(ABORT,'QUOTA_BELOW_USED') END;
END;
--> statement-breakpoint
CREATE TRIGGER reject_full_update AFTER UPDATE ON weekly_limits BEGIN
 UPDATE bookings SET status='rejected',reason='本周放纵餐指标已达到最大值，请下周再试。' WHERE status='pending' AND (SELECT count(*) FROM approvals WHERE week=bookings.week)>=COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=bookings.week),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2);
END;

--> statement-breakpoint
CREATE TRIGGER manager_cancel_notice AFTER UPDATE OF status ON bookings WHEN NEW.status='cancelled' AND OLD.status IN ('pending','approved') AND NEW.cancelled_by IN (SELECT id FROM users WHERE role='manager') BEGIN
 INSERT INTO notices(user_id,message,created) VALUES(NEW.user_id,'管理员已取消你的预约：'||NEW.restaurant||'。原因：'||COALESCE(NEW.reason,'管理调整'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 INSERT INTO notices(user_id,message,created) SELECT id,'管理员取消了获批预约：'||NEW.restaurant||'。名额已返还。',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM users WHERE role='admin' AND OLD.status='approved';
END;

--> statement-breakpoint
CREATE TRIGGER reject_pending_after_approval AFTER INSERT ON approvals BEGIN
 UPDATE bookings SET status='rejected',reason='本周放纵餐指标已达到最大值，请下周再试。' WHERE week=NEW.week AND id!=NEW.booking_id AND status='pending' AND (SELECT count(*) FROM approvals WHERE week=NEW.week)>=COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=NEW.week),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2);
END;
