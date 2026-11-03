-- Device proof survives logout; account and session bindings do not.
CREATE TABLE push_devices (
 registration_id TEXT PRIMARY KEY, proof_hash TEXT NOT NULL,
 user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 session_token TEXT, binding TEXT NOT NULL, updated INTEGER NOT NULL
);
CREATE INDEX push_devices_user ON push_devices(user_id);
CREATE TABLE push_outbox (
 id INTEGER PRIMARY KEY AUTOINCREMENT, notice_id INTEGER NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
 registration_id TEXT NOT NULL, binding TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER,
 cid TEXT, first_attempt INTEGER, last_error TEXT, sent_at INTEGER,
 UNIQUE(notice_id,registration_id,binding)
);
CREATE INDEX push_outbox_pending ON push_outbox(status,next_attempt);
CREATE TRIGGER notice_push AFTER INSERT ON notices BEGIN
 INSERT INTO push_outbox(notice_id,registration_id,binding)
 SELECT NEW.id,d.registration_id,d.binding FROM push_devices d
 JOIN sessions s ON s.token=d.session_token AND s.user_id=d.user_id
 JOIN users u ON u.id=d.user_id
 WHERE d.user_id=NEW.user_id AND s.expires>CAST(strftime('%s','now') AS INTEGER)*1000
 AND u.disabled=0 AND u.must_change=0;
END;
CREATE TRIGGER push_session_revoked AFTER DELETE ON sessions BEGIN
 UPDATE push_devices SET user_id=NULL,session_token=NULL,binding=lower(hex(randomblob(16))) WHERE session_token=OLD.token;
END;
