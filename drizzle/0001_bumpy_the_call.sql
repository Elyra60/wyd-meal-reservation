ALTER TABLE `bookings` ADD `cancelled_by` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `completed_at` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `completion_method` text;--> statement-breakpoint
CREATE TRIGGER release_cancelled_quota AFTER UPDATE OF status ON bookings WHEN NEW.status='cancelled' AND OLD.status IN ('pending','approved') BEGIN
 DELETE FROM approvals WHERE booking_id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER cancellation_notice AFTER UPDATE OF status ON bookings WHEN OLD.status='approved' AND NEW.status='cancelled' BEGIN
 INSERT INTO notices(user_id,message,created) SELECT id,'预约人 ' || NEW.name || ' 已取消获批预约：' || NEW.restaurant || '。原预约周名额已返还。',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM users WHERE role='admin' AND NEW.cancelled_by=NEW.user_id;
 INSERT INTO notices(user_id,message,created) SELECT NEW.user_id,'王亦达已取消你的获批预约：' || NEW.restaurant || '。原预约周名额已返还，可重新预约。',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE NEW.cancelled_by IN (SELECT id FROM users WHERE role='admin');
END;
--> statement-breakpoint
CREATE TRIGGER completion_notice AFTER UPDATE OF status ON bookings WHEN NEW.status='completed' AND OLD.status='approved' BEGIN
 INSERT INTO notices(user_id,message,created) VALUES(NEW.user_id, CASE WHEN NEW.completion_method='auto' THEN '预约时间已超过24小时，系统已自动完成用餐：' ELSE '王亦达已确认完成用餐：' END || NEW.restaurant || '。已扣除用餐日期所在周的1次额度。',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
