ALTER TABLE bookings ADD source TEXT NOT NULL DEFAULT 'reservation' CHECK(source IN ('reservation','self'));
--> statement-breakpoint
ALTER TABLE bookings ADD calories INTEGER CHECK(calories IS NULL OR (calories BETWEEN 1 AND 100000 AND calories=CAST(calories AS INTEGER)));
--> statement-breakpoint
ALTER TABLE notices ADD booking_id TEXT;
--> statement-breakpoint
CREATE TABLE mail_outbox(id INTEGER PRIMARY KEY AUTOINCREMENT,notice_id INTEGER NOT NULL UNIQUE REFERENCES notices(id),recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,first_attempt INTEGER,lease_token TEXT,lease_until INTEGER,last_error TEXT,sent_at TEXT);
--> statement-breakpoint
CREATE INDEX mail_outbox_due ON mail_outbox(status,next_attempt,lease_until);
--> statement-breakpoint
CREATE INDEX bookings_meal_records ON bookings(status,meal_at);
--> statement-breakpoint
CREATE TRIGGER notice_mail AFTER INSERT ON notices BEGIN
 INSERT INTO mail_outbox(notice_id,recipient,subject,body,status)
 SELECT NEW.id,email,'王亦达放纵餐预约 · 新消息',NEW.message, CASE  WHEN email LIKE '%@%.%' AND email NOT LIKE '%@internal.invalid' AND disabled=0 THEN 'pending' ELSE 'skipped'  END  FROM users WHERE id=NEW.user_id;
 END ;
--> statement-breakpoint
DROP TRIGGER booking_quota_guard;
--> statement-breakpoint
CREATE TRIGGER booking_quota_guard BEFORE INSERT ON bookings WHEN NEW.source='reservation' BEGIN
 SELECT  CASE  WHEN (SELECT count(*) FROM approvals WHERE week=NEW.week)>=COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=NEW.week),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2) THEN RAISE(ABORT,'QUOTA_FULL')  END ;
 SELECT  CASE  WHEN EXISTS(SELECT 1 FROM bookings WHERE user_id=NEW.user_id AND status IN ('pending','approved')) THEN RAISE(ABORT,'ACTIVE_BOOKING')  END ;
 END ;
--> statement-breakpoint
CREATE TRIGGER self_record_guard BEFORE INSERT ON bookings WHEN NEW.source='self' BEGIN
 SELECT  CASE  WHEN NEW.user_id!='wang-yida' OR NEW.status!='completed' OR NEW.calories IS NULL THEN RAISE(ABORT,'INVALID_SELF_RECORD')  END ;
 END ;
--> statement-breakpoint
CREATE TRIGGER self_record_quota AFTER INSERT ON bookings WHEN NEW.source='self' BEGIN
 INSERT INTO approvals(booking_id,week,slot) VALUES(NEW.id,NEW.week,COALESCE((SELECT max(slot)+1 FROM approvals WHERE week=NEW.week),1));
 END ;
--> statement-breakpoint
DROP TRIGGER approval_limit_guard;
--> statement-breakpoint
CREATE TRIGGER approval_limit_guard BEFORE INSERT ON approvals WHEN (SELECT source FROM bookings WHERE id=NEW.booking_id)!='self' BEGIN
 SELECT  CASE  WHEN (SELECT count(*) FROM approvals WHERE week=NEW.week)>=COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=NEW.week),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2) THEN RAISE(ABORT,'QUOTA_FULL')  END ;
 END ;
--> statement-breakpoint
DROP TRIGGER release_cancelled_quota;
--> statement-breakpoint
CREATE TRIGGER release_cancelled_quota AFTER UPDATE OF status ON bookings WHEN NEW.status='cancelled' AND OLD.status!='cancelled' BEGIN DELETE FROM approvals WHERE booking_id=NEW.id;  END ;
--> statement-breakpoint
DROP TRIGGER reject_pending_after_approval;
--> statement-breakpoint
CREATE TRIGGER reject_pending_after_approval AFTER INSERT ON approvals BEGIN UPDATE bookings SET status='rejected',reason='所选用餐周的放纵餐名额已满，请选择其他周。' WHERE week=NEW.week AND status='pending' AND id!=NEW.booking_id AND (SELECT count(*) FROM approvals WHERE week=NEW.week)>=COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=NEW.week),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2);  END ;
--> statement-breakpoint
DROP TRIGGER limit_guard_insert;
--> statement-breakpoint
DROP TRIGGER limit_guard_update;
--> statement-breakpoint
CREATE TRIGGER limit_guard_insert BEFORE INSERT ON weekly_limits BEGIN
 SELECT  CASE  WHEN NEW.meal_limit<0 OR NEW.meal_limit>100 OR EXISTS(SELECT 1 FROM approvals a WHERE (NEW.week=a.week OR (NEW.week='default' AND NOT EXISTS(SELECT 1 FROM weekly_limits l WHERE l.week=a.week))) AND NEW.meal_limit<COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=a.week),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2) GROUP BY a.week HAVING count(*)>NEW.meal_limit) THEN RAISE(ABORT,'QUOTA_BELOW_USED')  END ;
 END ;
--> statement-breakpoint
CREATE TRIGGER limit_guard_update BEFORE UPDATE ON weekly_limits BEGIN
 SELECT  CASE  WHEN NEW.meal_limit<0 OR NEW.meal_limit>100 OR EXISTS(SELECT 1 FROM approvals a WHERE (NEW.week=a.week OR (NEW.week='default' AND NOT EXISTS(SELECT 1 FROM weekly_limits l WHERE l.week=a.week))) AND NEW.meal_limit<COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=a.week),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2) GROUP BY a.week HAVING count(*)>NEW.meal_limit) THEN RAISE(ABORT,'QUOTA_BELOW_USED')  END ;
 END ;
--> statement-breakpoint
DROP TRIGGER booking_notice;
--> statement-breakpoint
CREATE TRIGGER booking_notice AFTER UPDATE OF status ON bookings WHEN NEW.status IN ('approved','rejected') AND OLD.status!=NEW.status BEGIN
 INSERT INTO notices(user_id,booking_id,message,created) VALUES(NEW.user_id,NEW.id,( CASE  WHEN NEW.status='approved' THEN '你的预约已批准。' ELSE '你的预约已拒绝。拒绝理由：'||COALESCE(NULLIF(NEW.reason,''),'未填写理由')  END )||char(10)||'姓名：'||NEW.name||char(10)||'餐厅：'||NEW.restaurant||char(10)||'用餐时间（北京时间）：'||strftime('%Y/%m/%d %H:%M',NEW.meal_at,'+8 hours')||char(10)||'餐次：'|| CASE  NEW.meal_type WHEN 'lunch' THEN '午餐' WHEN 'dinner' THEN '晚餐' WHEN 'late' THEN '夜宵' ELSE '未注明'  END ||char(10)||'人数：'||NEW.party_size||char(10)||'同行人：'||COALESCE(NULLIF(NEW.companions,''),'未填写')||char(10)||'联系方式：'||COALESCE(NULLIF(NEW.contact,''),'未填写')||char(10)||'地址：'||COALESCE(NULLIF(NEW.address,''),'未填写')||char(10)||'备注：'||COALESCE(NULLIF(NEW.notes,''),'无')||char(10)||'王亦达摄入热量：'|| CASE  WHEN NEW.calories IS NULL THEN '待补填' ELSE NEW.calories||' 千卡'  END ,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 END ;
--> statement-breakpoint
CREATE TRIGGER invitation_notice AFTER INSERT ON bookings WHEN NEW.source='reservation' AND NEW.status='pending' BEGIN
 INSERT INTO notices(user_id,booking_id,message,created) SELECT id,NEW.id,'收到新的放纵餐预约邀请，请登录审批。'||char(10)||'姓名：'||NEW.name||char(10)||'餐厅：'||NEW.restaurant||char(10)||'用餐时间（北京时间）：'||strftime('%Y/%m/%d %H:%M',NEW.meal_at,'+8 hours')||char(10)||'餐次：'|| CASE  NEW.meal_type WHEN 'lunch' THEN '午餐' WHEN 'dinner' THEN '晚餐' WHEN 'late' THEN '夜宵' ELSE '未注明'  END ||char(10)||'人数：'||NEW.party_size||char(10)||'同行人：'||COALESCE(NULLIF(NEW.companions,''),'未填写')||char(10)||'联系方式：'||COALESCE(NULLIF(NEW.contact,''),'未填写')||char(10)||'地址：'||COALESCE(NULLIF(NEW.address,''),'未填写')||char(10)||'备注：'||COALESCE(NULLIF(NEW.notes,''),'无')||char(10)||'王亦达摄入热量：'|| CASE  WHEN NEW.calories IS NULL THEN '待补填' ELSE NEW.calories||' 千卡'  END ,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM users WHERE id='wang-yida';
 END ;
--> statement-breakpoint
DROP TRIGGER cancellation_notice;
--> statement-breakpoint
CREATE TRIGGER cancellation_notice AFTER UPDATE OF status ON bookings WHEN OLD.status='approved' AND NEW.status='cancelled' BEGIN
 INSERT INTO notices(user_id,booking_id,message,created) SELECT id,NEW.id,'预约人已取消获批预约，原预约周名额已返还。'||char(10)||'姓名：'||NEW.name||char(10)||'餐厅：'||NEW.restaurant||char(10)||'用餐时间（北京时间）：'||strftime('%Y/%m/%d %H:%M',NEW.meal_at,'+8 hours')||char(10)||'餐次：'|| CASE  NEW.meal_type WHEN 'lunch' THEN '午餐' WHEN 'dinner' THEN '晚餐' WHEN 'late' THEN '夜宵' ELSE '未注明'  END ||char(10)||'人数：'||NEW.party_size||char(10)||'同行人：'||COALESCE(NULLIF(NEW.companions,''),'未填写')||char(10)||'联系方式：'||COALESCE(NULLIF(NEW.contact,''),'未填写')||char(10)||'地址：'||COALESCE(NULLIF(NEW.address,''),'未填写')||char(10)||'备注：'||COALESCE(NULLIF(NEW.notes,''),'无')||char(10)||'王亦达摄入热量：'|| CASE  WHEN NEW.calories IS NULL THEN '待补填' ELSE NEW.calories||' 千卡'  END ,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM users WHERE role='admin' AND NEW.cancelled_by=NEW.user_id;
 INSERT INTO notices(user_id,booking_id,message,created) SELECT NEW.user_id,NEW.id,'王亦达已取消你的获批预约，原预约周名额已返还。'||char(10)||'姓名：'||NEW.name||char(10)||'餐厅：'||NEW.restaurant||char(10)||'用餐时间（北京时间）：'||strftime('%Y/%m/%d %H:%M',NEW.meal_at,'+8 hours')||char(10)||'餐次：'|| CASE  NEW.meal_type WHEN 'lunch' THEN '午餐' WHEN 'dinner' THEN '晚餐' WHEN 'late' THEN '夜宵' ELSE '未注明'  END ||char(10)||'人数：'||NEW.party_size||char(10)||'同行人：'||COALESCE(NULLIF(NEW.companions,''),'未填写')||char(10)||'联系方式：'||COALESCE(NULLIF(NEW.contact,''),'未填写')||char(10)||'地址：'||COALESCE(NULLIF(NEW.address,''),'未填写')||char(10)||'备注：'||COALESCE(NULLIF(NEW.notes,''),'无')||char(10)||'王亦达摄入热量：'|| CASE  WHEN NEW.calories IS NULL THEN '待补填' ELSE NEW.calories||' 千卡'  END ,strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE NEW.cancelled_by IN (SELECT id FROM users WHERE role='admin');
 END ;
--> statement-breakpoint
DROP TRIGGER completion_notice;
--> statement-breakpoint
CREATE TRIGGER completion_notice AFTER UPDATE OF status ON bookings WHEN NEW.status='completed' AND OLD.status='approved' BEGIN
 INSERT INTO notices(user_id,booking_id,message,created) VALUES(NEW.user_id,NEW.id,( CASE  WHEN NEW.completion_method='auto' THEN '预约时间已超过24小时，系统已自动完成用餐。' ELSE '王亦达已确认完成用餐。'  END )||'已扣除用餐日期所在周的1次额度。'||char(10)||'姓名：'||NEW.name||char(10)||'餐厅：'||NEW.restaurant||char(10)||'用餐时间（北京时间）：'||strftime('%Y/%m/%d %H:%M',NEW.meal_at,'+8 hours')||char(10)||'餐次：'|| CASE  NEW.meal_type WHEN 'lunch' THEN '午餐' WHEN 'dinner' THEN '晚餐' WHEN 'late' THEN '夜宵' ELSE '未注明'  END ||char(10)||'人数：'||NEW.party_size||char(10)||'同行人：'||COALESCE(NULLIF(NEW.companions,''),'未填写')||char(10)||'联系方式：'||COALESCE(NULLIF(NEW.contact,''),'未填写')||char(10)||'地址：'||COALESCE(NULLIF(NEW.address,''),'未填写')||char(10)||'备注：'||COALESCE(NULLIF(NEW.notes,''),'无')||char(10)||'王亦达摄入热量：'|| CASE  WHEN NEW.calories IS NULL THEN '待补填' ELSE NEW.calories||' 千卡'  END ,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 INSERT INTO notices(user_id,booking_id,message,created) SELECT id,NEW.id,'这次用餐已自动完成，请补填本次摄入的热量。'||char(10)||'姓名：'||NEW.name||char(10)||'餐厅：'||NEW.restaurant||char(10)||'用餐时间（北京时间）：'||strftime('%Y/%m/%d %H:%M',NEW.meal_at,'+8 hours')||char(10)||'餐次：'|| CASE  NEW.meal_type WHEN 'lunch' THEN '午餐' WHEN 'dinner' THEN '晚餐' WHEN 'late' THEN '夜宵' ELSE '未注明'  END ||char(10)||'人数：'||NEW.party_size||char(10)||'同行人：'||COALESCE(NULLIF(NEW.companions,''),'未填写')||char(10)||'联系方式：'||COALESCE(NULLIF(NEW.contact,''),'未填写')||char(10)||'地址：'||COALESCE(NULLIF(NEW.address,''),'未填写')||char(10)||'备注：'||COALESCE(NULLIF(NEW.notes,''),'无')||char(10)||'王亦达摄入热量：'|| CASE  WHEN NEW.calories IS NULL THEN '待补填' ELSE NEW.calories||' 千卡'  END ,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM users WHERE id='wang-yida' AND NEW.calories IS NULL;
 END ;
--> statement-breakpoint
DROP TRIGGER manager_cancel_notice;
--> statement-breakpoint
CREATE TRIGGER manager_cancel_notice AFTER UPDATE OF status ON bookings WHEN NEW.status='cancelled' AND OLD.status!='cancelled' AND NEW.cancelled_by IN (SELECT id FROM users WHERE role='manager') BEGIN
 INSERT INTO notices(user_id,booking_id,message,created) VALUES(NEW.user_id,NEW.id,'管理员已取消这份预约／用餐记录。原因：'||COALESCE(NEW.reason,'管理调整')||char(10)||'姓名：'||NEW.name||char(10)||'餐厅：'||NEW.restaurant||char(10)||'用餐时间（北京时间）：'||strftime('%Y/%m/%d %H:%M',NEW.meal_at,'+8 hours')||char(10)||'餐次：'|| CASE  NEW.meal_type WHEN 'lunch' THEN '午餐' WHEN 'dinner' THEN '晚餐' WHEN 'late' THEN '夜宵' ELSE '未注明'  END ||char(10)||'人数：'||NEW.party_size||char(10)||'同行人：'||COALESCE(NULLIF(NEW.companions,''),'未填写')||char(10)||'联系方式：'||COALESCE(NULLIF(NEW.contact,''),'未填写')||char(10)||'地址：'||COALESCE(NULLIF(NEW.address,''),'未填写')||char(10)||'备注：'||COALESCE(NULLIF(NEW.notes,''),'无')||char(10)||'王亦达摄入热量：'|| CASE  WHEN NEW.calories IS NULL THEN '待补填' ELSE NEW.calories||' 千卡'  END ,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 INSERT INTO notices(user_id,booking_id,message,created) SELECT id,NEW.id,'管理员取消了用餐安排，名额已返还。'||char(10)||'姓名：'||NEW.name||char(10)||'餐厅：'||NEW.restaurant||char(10)||'用餐时间（北京时间）：'||strftime('%Y/%m/%d %H:%M',NEW.meal_at,'+8 hours')||char(10)||'餐次：'|| CASE  NEW.meal_type WHEN 'lunch' THEN '午餐' WHEN 'dinner' THEN '晚餐' WHEN 'late' THEN '夜宵' ELSE '未注明'  END ||char(10)||'人数：'||NEW.party_size||char(10)||'同行人：'||COALESCE(NULLIF(NEW.companions,''),'未填写')||char(10)||'联系方式：'||COALESCE(NULLIF(NEW.contact,''),'未填写')||char(10)||'地址：'||COALESCE(NULLIF(NEW.address,''),'未填写')||char(10)||'备注：'||COALESCE(NULLIF(NEW.notes,''),'无')||char(10)||'王亦达摄入热量：'|| CASE  WHEN NEW.calories IS NULL THEN '待补填' ELSE NEW.calories||' 千卡'  END ,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM users WHERE id='wang-yida' AND OLD.status='approved' AND NEW.user_id!=id;
 END ;
--> statement-breakpoint
CREATE TRIGGER manager_edit_notice AFTER UPDATE OF name,restaurant,meal_at,meal_type,party_size,companions,contact,notes,address,calories ON bookings
 WHEN OLD.name IS NOT NEW.name OR OLD.restaurant IS NOT NEW.restaurant OR OLD.meal_at IS NOT NEW.meal_at OR OLD.meal_type IS NOT NEW.meal_type OR OLD.party_size IS NOT NEW.party_size OR OLD.companions IS NOT NEW.companions OR OLD.contact IS NOT NEW.contact OR OLD.notes IS NOT NEW.notes OR OLD.address IS NOT NEW.address OR (OLD.status='completed' AND OLD.calories IS NOT NEW.calories) BEGIN
 INSERT INTO notices(user_id,booking_id,message,created) VALUES(NEW.user_id,NEW.id,'用餐信息已更新，请查看最新记录。'||char(10)||'姓名：'||NEW.name||char(10)||'餐厅：'||NEW.restaurant||char(10)||'用餐时间（北京时间）：'||strftime('%Y/%m/%d %H:%M',NEW.meal_at,'+8 hours')||char(10)||'餐次：'|| CASE  NEW.meal_type WHEN 'lunch' THEN '午餐' WHEN 'dinner' THEN '晚餐' WHEN 'late' THEN '夜宵' ELSE '未注明'  END ||char(10)||'人数：'||NEW.party_size||char(10)||'同行人：'||COALESCE(NULLIF(NEW.companions,''),'未填写')||char(10)||'联系方式：'||COALESCE(NULLIF(NEW.contact,''),'未填写')||char(10)||'地址：'||COALESCE(NULLIF(NEW.address,''),'未填写')||char(10)||'备注：'||COALESCE(NULLIF(NEW.notes,''),'无')||char(10)||'王亦达摄入热量：'|| CASE  WHEN NEW.calories IS NULL THEN '待补填' ELSE NEW.calories||' 千卡'  END ,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 END ;
