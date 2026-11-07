ALTER TABLE users ADD COLUMN can_manage INTEGER NOT NULL DEFAULT 0 CHECK(can_manage IN (0,1));
ALTER TABLE bookings ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;

-- Keep the old push tables for migration history, but stop queuing deliveries.
DROP TRIGGER notice_push;
DROP TRIGGER push_session_revoked;

DROP TRIGGER booking_quota_guard;
CREATE TRIGGER booking_quota_guard BEFORE INSERT ON bookings WHEN NEW.source='reservation' BEGIN
 SELECT CASE WHEN (SELECT count(*) FROM approvals WHERE week=NEW.week)>=
  COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=NEW.week),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2)
  THEN RAISE(ABORT,'QUOTA_FULL') END;
 SELECT CASE WHEN NEW.status IN ('pending','approved') AND EXISTS(
  SELECT 1 FROM bookings WHERE user_id=NEW.user_id AND status IN ('pending','approved'))
  THEN RAISE(ABORT,'ACTIVE_BOOKING') END;
END;

CREATE TABLE meal_reviews (
 id TEXT PRIMARY KEY NOT NULL,
 requester_id TEXT NOT NULL REFERENCES users(id),
 food TEXT NOT NULL,
 calories INTEGER NOT NULL CHECK(calories BETWEEN 1 AND 100000),
 deadline INTEGER NOT NULL,
 created TEXT NOT NULL,
 result TEXT NOT NULL DEFAULT 'open' CHECK(result IN ('open','allowed','denied'))
);
CREATE INDEX meal_reviews_due ON meal_reviews(result,deadline);

CREATE TABLE meal_review_votes (
 review_id TEXT NOT NULL REFERENCES meal_reviews(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 choice TEXT NOT NULL CHECK(choice IN ('yes','no')),
 PRIMARY KEY(review_id,user_id)
);

CREATE TABLE meal_review_comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 review_id TEXT NOT NULL REFERENCES meal_reviews(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 body TEXT NOT NULL,
 created TEXT NOT NULL
);
CREATE INDEX meal_review_comments_thread ON meal_review_comments(review_id,id);

CREATE TRIGGER meal_review_result_notice
AFTER UPDATE OF result ON meal_reviews
WHEN OLD.result='open' AND NEW.result!='open'
BEGIN
 INSERT INTO notices(user_id,message,created)
 VALUES(NEW.requester_id,'大众评审「'||NEW.food||'」已结束。结果：'||
 CASE NEW.result WHEN 'allowed' THEN '可以吃' ELSE '不可以吃' END||
 '。同意 '||(SELECT count(*) FROM meal_review_votes WHERE review_id=NEW.id AND choice='yes')||
 ' 票，反对 '||(SELECT count(*) FROM meal_review_votes WHERE review_id=NEW.id AND choice='no')||' 票。',
 strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

DROP TRIGGER invitation_notice;
--> statement-breakpoint
CREATE TRIGGER invitation_notice AFTER INSERT ON bookings WHEN NEW.source='reservation' AND NEW.status='pending' BEGIN
 INSERT INTO notices(user_id,booking_id,message,created) SELECT id,NEW.id,'收到新的放纵餐预约邀请，请登录审批。'||char(10)||'姓名：'||NEW.name||char(10)||'餐厅：'||NEW.restaurant||char(10)||'用餐时间（北京时间）：'||strftime('%Y/%m/%d %H:%M',NEW.meal_at,'+8 hours')||char(10)||'餐次：'|| CASE  NEW.meal_type WHEN 'lunch' THEN '午餐' WHEN 'dinner' THEN '晚餐' WHEN 'late' THEN '夜宵' ELSE '未注明'  END ||char(10)||'人数：'||NEW.party_size||char(10)||'同行人：'||COALESCE(NULLIF(NEW.companions,''),'未填写')||char(10)||'联系方式：'||COALESCE(NULLIF(NEW.contact,''),'未填写')||char(10)||'地址：'||COALESCE(NULLIF(NEW.address,''),'未填写')||char(10)||'备注：'||COALESCE(NULLIF(NEW.notes,''),'无')||char(10)||'王亦达摄入热量：'|| CASE  WHEN NEW.calories IS NULL THEN '待补填' ELSE NEW.calories||' 千卡'  END ||char(10)||'交通方式：'|| CASE NEW.transport_mode WHEN 'walking' THEN '步行' WHEN 'bicycle' THEN '骑行' WHEN 'ebike' THEN '电动车' WHEN 'public_transit' THEN '公共交通' WHEN 'car' THEN '自驾' WHEN 'taxi' THEN '打车' WHEN 'other' THEN '其他' ELSE '未填写' END ||char(10)||'预估人均消费：'|| CASE WHEN NEW.estimated_cost_cents IS NULL THEN '未填写' ELSE printf('%.2f 元/人',NEW.estimated_cost_cents/100.0) END ,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM users WHERE disabled=0 AND (
  (NEW.user_id!='wang-yida' AND id='wang-yida') OR
  (NEW.user_id='wang-yida' AND (role='manager' OR (role='user' AND can_manage=1)))
 );
 END ;
--> statement-breakpoint
