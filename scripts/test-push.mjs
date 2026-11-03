// Imported by the integration suite with its isolated database and users.
export async function testPush({moduleFrom,sql,db,user,wang,otherSession,other,call,env}){
 const {default:assert}=await import('node:assert/strict');
 const {POST}=await moduleFrom('app/api/mobile-push/route.ts',[["import {requestUser} from '../../../lib/request-user';",'const requestUser=globalThis.__requestUser;']]);
 const request=async(cookie,body,origin='https://test.invalid')=>POST(new Request('https://test.invalid/api/mobile-push',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 const device={registrationId:'fake-registration-123456',deviceProof:'a'.repeat(64),enabled:true};
 assert.equal((await request('',device)).status,401);assert.equal((await request(user.cookie,device,'https://evil.invalid')).status,403);
 assert.equal((await request(user.cookie,{...device,registrationId:'all'})).status,400);
 const bound=await request(user.cookie,device);assert.equal(bound.status,200);const binding=(await bound.json()).binding;
 assert.equal((await (await request(user.cookie,device)).json()).binding,binding);
 assert.equal(sql.prepare('SELECT count(*) n FROM push_outbox').get().n,0,'old notices are not backfilled');
 assert.equal((await request(otherSession.cookie,{...device,deviceProof:'b'.repeat(64)})).status,409);
 const userId=sql.prepare('SELECT id FROM users WHERE username=?').get('local_user').id;
 const notice=()=>sql.prepare('INSERT INTO notices(user_id,message,created) VALUES(?,?,?) RETURNING id').get(userId,'不应传给推送服务的私密用餐详情',new Date().toISOString()).id;
 const first=notice();assert.equal(sql.prepare('SELECT count(*) n FROM push_outbox').get().n,1);
 const {deliverPush}=await moduleFrom('lib/push-notifications.ts');
 env.JPUSH_APP_KEY='fake-key';env.JPUSH_MASTER_SECRET='fake-secret';let fail=true,cids=0;const sent=[];
 globalThis.fetch=async(url,options)=>{assert.equal(options.headers.Authorization,'Basic '+btoa('fake-key:fake-secret'));if(url.includes('/cid?'))return Response.json({cidlist:['fake-cid-'+(++cids)]});assert.equal(url,'https://api.jpush.cn/v3/push');const body=JSON.parse(options.body);sent.push(body);assert.deepEqual(body.audience,{registration_id:[device.registrationId]});assert.equal(JSON.stringify(body).includes('私密'),false);return new Response('{}',{status:fail?503:200});};
 const now=Date.now();await deliverPush(env,1,now);assert.equal(sql.prepare('SELECT status FROM push_outbox').get().status,'pending');fail=false;
 await Promise.all([deliverPush(env,10,now+61000),deliverPush(env,10,now+61000)]);assert.equal(sent.length,2);assert.deepEqual(sent[0],sent[1]);assert.equal(cids,1);assert.equal(sent[1].message.extras.binding,binding);assert.equal(sent[1].message.extras.notice_id,String(first));
 const read=notice();sql.prepare('UPDATE notices SET read=1 WHERE id=?').run(read);await deliverPush(env,10,now+62000);assert.equal(sent.length,2);assert.equal(sql.prepare('SELECT status FROM push_outbox WHERE notice_id=?').get(read).status,'skipped');
 const stale=notice();await request(otherSession.cookie,device);await deliverPush(env,10,now+63000);assert.equal(sent.length,2);assert.equal(sql.prepare('SELECT status FROM push_outbox WHERE notice_id=?').get(stale).status,'skipped');
 await request(user.cookie,device);const disabled=notice();sql.prepare('UPDATE users SET disabled=1 WHERE id=?').run(userId);await deliverPush(env,10,now+64000);assert.equal(sent.length,2);sql.prepare('UPDATE users SET disabled=0 WHERE id=?').run(userId);
 const revoke=notice();await call({action:'logout'},user.cookie);assert.equal(sql.prepare('SELECT user_id FROM push_devices WHERE registration_id=?').get(device.registrationId).user_id,null);await deliverPush(env,10,now+65000);assert.equal(sent.length,2);assert.equal(sql.prepare('SELECT status FROM push_outbox WHERE notice_id=?').get(revoke).status,'skipped');
 console.log('PASS: push authentication/origin/proof checks, stable binding, no historical backfill or private payload, CID retry/concurrency, read/disabled/rebound/logout skip and session revocation.');
}
