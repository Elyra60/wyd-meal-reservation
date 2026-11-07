import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';import {pbkdf2Sync} from 'node:crypto';import ts from 'typescript';import assert from 'node:assert/strict';
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
class Stmt{constructor(text,args=[]){this.text=text;this.args=args;}bind(...args){return new Stmt(this.text,args);}async first(){return sql.prepare(this.text).get(...this.args)||null;}async all(){return {results:sql.prepare(this.text).all(...this.args)};}async run(){return sql.prepare(this.text).run(...this.args);}}
const db={prepare:s=>new Stmt(s),async batch(stmts){sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(/^SELECT\s/i.test(s.text.trim())?await s.all():await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const password='Local-Only-Test-123',ph='test:'+pbkdf2Sync(password,'test',100000,32,'sha256').toString('hex');globalThis.__env={DB:db,WY_INITIAL_HASH:ph,MANAGER_INITIAL_HASH:ph,RESEND_API_KEY:'fake',MAIL_FROM:'test@example.test'};
const moduleFrom=async(path,replacements=[])=>{let code=readFileSync(path,'utf8').replace("import { env } from 'cloudflare:workers';",'const env=globalThis.__env;').replace("import {env} from 'cloudflare:workers';",'const env=globalThis.__env;');for(const [a,b] of replacements)code=code.replace(a,b);return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));};
globalThis.__mealFields=await moduleFrom('lib/meal-fields.ts');
globalThis.__avatarStore=(await moduleFrom('lib/avatar-store.ts')).avatarStore;globalThis.__settleMeals=(await moduleFrom('lib/meal-lifecycle.ts')).settleMeals;globalThis.__requestUser=(await moduleFrom('lib/request-user.ts')).requestUser;
globalThis.__mealReviews=await moduleFrom('lib/meal-reviews.ts',[["import {calories} from './meal-fields';",'const {calories}=globalThis.__mealFields;']]);
const {GET,POST}=await moduleFrom('app/api/action/route.ts',[["import {mealFields,calories,mealWeek} from '../../../lib/meal-fields';",'const {mealFields,calories,mealWeek}=globalThis.__mealFields;'],["import {avatarStore} from '../../../lib/avatar-store';",'const avatarStore=globalThis.__avatarStore;'],["import { settleMeals } from '../../../lib/meal-lifecycle';",'const settleMeals=globalThis.__settleMeals;'],["import { listReviews, reviewAction, settleReviews } from '../../../lib/meal-reviews';",'const {listReviews,reviewAction,settleReviews}=globalThis.__mealReviews;']]);
const codes=new Map();globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');const b=JSON.parse(options.body);const code=b.text.match(/\d{6}/);if(code)codes.set(b.to,code[0]);return Response.json({id:'fake-mail'});};let ip=0;
const state=async(c='')=>{const r=await GET(new Request('https://test.invalid/api/action',{headers:{Cookie:c}}));assert.equal(r.status,200);return r.json();};
const call=async(b,c='')=>{const r=await POST(new Request('https://test.invalid/api/action',{method:'POST',headers:{Origin:'https://test.invalid','Content-Type':'application/json',Cookie:c,'cf-connecting-ip':'local-'+(++ip)},body:JSON.stringify(b)}));return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
assert.equal((await state()).user,null);assert.equal(sql.prepare('SELECT count(*) n FROM users').get().n,2);
let wang=await call({action:'login',email:'3025244268',password});assert.equal(wang.status,200);assert.equal((await state(wang.cookie)).user.mustBindEmail,true);assert.equal((await call({action:'read'},wang.cookie)).status,400);
await call({action:'sendEmailChangeCode',email:'wang@example.test',password},wang.cookie);wang=await call({action:'changeEmail',email:'wang@example.test',password,code:codes.get('wang@example.test')},wang.cookie);assert.equal(wang.status,200);wang=await call({action:'password',oldPassword:password,password:'New-Wang-Pass-123'},wang.cookie);assert.equal(wang.status,200);
await call({action:'sendCode',email:'user@example.test'});let user=await call({action:'verify',email:'user@example.test',username:'local_user',password,code:codes.get('user@example.test')});assert.equal(user.status,200);
const jpg=new Uint8Array(131072);jpg.set([255,216,255]);assert.equal((await call({action:'profile',nickname:'头像测试',avatarData:'data:image/jpeg;base64,'+Buffer.from(jpg).toString('base64')},user.cookie)).status,200);const row=sql.prepare('SELECT * FROM avatars').get();assert.equal(Buffer.from(row.data,'base64').length,131072);
const avatar=(await moduleFrom('app/api/avatar/route.ts',[["import {avatarStore} from '../../../lib/avatar-store';",'const avatarStore=globalThis.__avatarStore;'],["import {requestUser} from '../../../lib/request-user';",'const requestUser=globalThis.__requestUser;']])).GET;assert.equal((await avatar(new Request('https://test.invalid/api/avatar'))).status,401);const image=await avatar(new Request('https://test.invalid/api/avatar',{headers:{Cookie:user.cookie}}));assert.equal(image.status,200);assert.equal((await image.arrayBuffer()).byteLength,131072);assert.equal((await avatar(new Request('https://test.invalid/api/avatar?userId=wang-yida',{headers:{Cookie:user.cookie}}))).status,403);
let manager=await call({action:'login',email:'siteadmin',password,managerLogin:true});assert.equal((await state(manager.cookie)).users.length,0);manager=await call({action:'password',oldPassword:password,password:'New-Manager-Pass-123'},manager.cookie);assert.equal((await call({action:'manageQuota',limit:3},manager.cookie)).status,200);assert.equal((await state(user.cookie)).weekLimit,3);assert.equal((await call({action:'manageQuota',limit:4},user.cookie)).status,403);
const date=new Date(Date.now()+86400000*24).toISOString().slice(0,10);assert.equal((await call({action:'book',name:'测试用户',restaurant:'测试餐厅',mealAt:date+'T18:30'},user.cookie)).status,200);const booking=(await state(user.cookie)).bookings[0];assert.equal((await call({action:'approve',id:booking.id},wang.cookie)).status,200);await globalThis.__settleMeals(db,new Date(Date.parse(booking.meal_at)+86400000).toISOString());assert.equal((await state(user.cookie)).bookings[0].status,'completed');
const managerData=await state(manager.cookie);assert.ok(managerData.users.length===3);for(const u of managerData.users)assert.equal(u.password,undefined);assert.equal(globalThis.__env.BUCKET,undefined);
console.log('PASS: standalone seeds and password changes, Wang email binding, registration, 128KiB D1 avatar roundtrip/access control, administrator quotas/role isolation, booking approval and 24-hour scheduled completion; no R2 or Sites credentials used.');

// Booking weeks, self-record overdraw and calorie ownership.
const {mealWeek}=globalThis.__mealFields;
const localTime=t=>new Date(t+28800000).toISOString().slice(0,16);
const thisWeek=mealWeek(),nextMeal=localTime(Date.now()+14*86400000),nextWeek=mealWeek(new Date(nextMeal+'+08:00'));
const pastMeal=localTime(Date.now()-60000),selfFields={name:'王亦达',restaurant:'自主记录餐厅',mealAt:pastMeal,mealType:'lunch',partySize:2,companions:'同行人甲',contact:'测试联系方式',notes:'不吃香菜',address:'测试地址',calories:1200};
const ok=async(body,cookie)=>{const r=await call(body,cookie);assert.equal(r.status,200,JSON.stringify(r.body));return r;};
await ok({action:'manageQuota',week:thisWeek,limit:0},manager.cookie);
assert.equal((await call({action:'selfRecord',...selfFields},user.cookie)).status,403);
assert.equal((await call({action:'selfRecord',...selfFields,calories:''},wang.cookie)).status,400);
assert.equal((await call({action:'selfRecord',...selfFields,mealAt:nextMeal},wang.cookie)).status,400);
assert.equal((await call({action:'selfRecord',...selfFields,mealAt:'2026-02-30T18:00'},wang.cookie)).status,400);
const selfId=crypto.randomUUID();await ok({action:'selfRecord',...selfFields,requestId:selfId},wang.cookie);
await ok({action:'selfRecord',...selfFields,requestId:selfId},wang.cookie);
let ws=await state(wang.cookie);assert.equal(ws.quotas.find(q=>q.week===thisWeek).count,1);assert.equal(ws.weekLimit,0);assert.equal(ws.mealStats.totalCalories,1200);
assert.equal((await call({action:'cancel',id:selfId},wang.cookie)).status,400);
assert.equal((await call({action:'fillCalories',id:selfId,calories:300},wang.cookie)).status,400);
assert.equal((await call({action:'manageBooking',id:selfId,...selfFields},wang.cookie)).status,403);
await ok({action:'book',...selfFields,mealAt:nextMeal},user.cookie);let future=(await state(user.cookie)).bookings.find(b=>b.status==='pending');
assert.equal(future.week,nextWeek);assert.equal(future.calories,null);assert.equal(future.source,'reservation');
const invite=sql.prepare("SELECT * FROM notices WHERE booking_id=? AND user_id='wang-yida'").get(future.id);assert.ok(invite.message.includes('同行人甲')&&invite.message.includes('测试地址')&&invite.message.includes('测试联系方式')&&invite.message.includes('不吃香菜')&&invite.message.includes('人数：2'));
await ok({action:'approve',id:future.id},wang.cookie);
assert.equal((await call({action:'manageQuota',week:nextWeek,limit:0},manager.cookie)).status,400);
await ok({action:'manageQuota',week:nextWeek,limit:1},manager.cookie);
const other={id:'other-test-user',username:'other_test',email:'other@example.test'};
sql.prepare('INSERT INTO users(id,username,email,password) VALUES(?,?,?,?)').run(other.id,other.username,other.email,ph);
const otherSession=await call({action:'login',email:other.username,password});
assert.equal((await call({action:'book',...selfFields,mealAt:nextMeal},otherSession.cookie)).status,400);
assert.equal(sql.prepare('SELECT count(*) n FROM approvals WHERE week=?').get(nextWeek).n,1);
const beforeCancel=sql.prepare("SELECT count(*) n FROM notices WHERE user_id='wang-yida'").get().n;
await ok({action:'cancel',id:future.id},user.cookie);assert.equal(sql.prepare("SELECT count(*) n FROM notices WHERE user_id='wang-yida'").get().n,beforeCancel+1);
await ok({action:'book',...selfFields,mealAt:nextMeal},user.cookie);future=(await state(user.cookie)).bookings.find(b=>b.status==='pending');
const beforePendingCancel=sql.prepare("SELECT count(*) n FROM notices WHERE user_id='wang-yida'").get().n;
await ok({action:'cancel',id:future.id},user.cookie);assert.equal(sql.prepare("SELECT count(*) n FROM notices WHERE user_id='wang-yida'").get().n,beforePendingCancel);
// Completing an existing reservation requires calories; automatic completion is supplemented once.
assert.equal((await call({action:'fillCalories',id:booking.id,calories:600},user.cookie)).status,403);
await ok({action:'fillCalories',id:booking.id,calories:600},wang.cookie);
assert.equal((await call({action:'fillCalories',id:booking.id,calories:700},wang.cookie)).status,400);
await ok({action:'manageBooking',id:selfId,...selfFields,calories:900},manager.cookie);
assert.equal((await state(wang.cookie)).mealStats.totalCalories,1500);
await ok({action:'manageCancel',id:selfId,reason:'录入重复'},manager.cookie);
assert.equal((await state(wang.cookie)).quotas.find(q=>q.week===thisWeek)?.count||0,0);
assert.equal((await state(wang.cookie)).mealStats.totalCalories,600);
await ok({action:'manageQuota',week:thisWeek,limit:2},manager.cookie);
// A source='reservation' request cannot opt into the self-record quota exception.
await ok({action:'book',...selfFields,mealAt:nextMeal,source:'self'},user.cookie);future=(await state(user.cookie)).bookings.find(b=>b.status==='pending');
await ok({action:'approve',id:future.id},wang.cookie);
sql.prepare('UPDATE bookings SET meal_at=? WHERE id=?').run(new Date(Date.now()-3600000).toISOString(),future.id);
assert.equal((await call({action:'complete',id:future.id},wang.cookie)).status,400);
assert.equal(sql.prepare('SELECT status FROM bookings WHERE id=?').get(future.id).status,'approved');
await ok({action:'complete',id:future.id,calories:800},wang.cookie);
assert.equal(sql.prepare('SELECT calories FROM bookings WHERE id=?').get(future.id).calories,800);
// Manager moves a normal completed meal into a full week: whole edit rolls back.
await ok({action:'manageQuota',week:thisWeek,limit:0},manager.cookie);
assert.equal((await call({action:'manageBooking',id:future.id,...selfFields,calories:800},manager.cookie)).status,400);
assert.equal(sql.prepare('SELECT week FROM bookings WHERE id=?').get(future.id).week,nextWeek);
assert.equal(sql.prepare('SELECT week FROM approvals WHERE booking_id=?').get(future.id).week,nextWeek);
// Overdraw can be remedied gradually, but a quota change cannot make it worse.
await ok({action:'selfRecord',...selfFields},wang.cookie);await ok({action:'selfRecord',...selfFields},wang.cookie);
await ok({action:'manageQuota',week:thisWeek,limit:1},manager.cookie);
assert.equal((await call({action:'manageQuota',week:thisWeek,limit:0},manager.cookie)).status,400);
// Mail outbox: no backfill, one delivery per notice, detailed body, concurrent leases,
// failed provider responses never undo a booking and retry uses the same key.
assert.equal(sql.prepare('SELECT count(*) n FROM notices').get().n,sql.prepare('SELECT count(*) n FROM mail_outbox').get().n);
const {deliverNotifications}=await moduleFrom('lib/mail-notifications.ts');let attempts=[];let fail=true;
globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);attempts.push({key:options.headers['Idempotency-Key'],body});return new Response('{}',{status:fail?503:200});};
const time=Date.now();await deliverNotifications(globalThis.__env,1,time);assert.equal(sql.prepare("SELECT attempts FROM mail_outbox WHERE status='pending' AND attempts=1").get().attempts,1);
fail=false;await Promise.all([deliverNotifications(globalThis.__env,100,time+61000),deliverNotifications(globalThis.__env,100,time+61000)]);
assert.equal(attempts.filter(a=>a.key===attempts[0].key).length,2);assert.deepEqual(attempts[0].body,attempts.find((a,i)=>i>0&&a.key===attempts[0].key).body);
assert.equal(sql.prepare("SELECT count(*) n FROM mail_outbox WHERE status IN ('pending','sending')").get().n,0);
const sent=attempts.slice(1);assert.equal(new Set(sent.map(a=>a.key)).size,sent.length);assert.ok(sent.some(a=>a.body.text.includes('收到新的放纵餐预约邀请')&&a.body.text.includes('测试地址')));
assert.equal((await state(manager.cookie)).mailDeliveries.some(m=>m.status==='sent'),true);
console.log('PASS: self records and negative quotas, immutable ownership, selected-week booking guards, cancellation/refunds, required calories and one-time supplement, manager edit/cancel and atomic cross-week rollback, totals, detailed email outbox and failure/concurrent retry safety.');

// Transport/cost are optional, exact cents, and survive edits from older clients.
const cost=globalThis.__mealFields.estimatedCostCents;
assert.equal(cost('12.34'),1234);assert.equal(cost('0'),0);assert.equal(cost(''),null);assert.equal(cost('100000.00'),10000000);
for(const bad of ['-1','1.001','100000.01','abc','Infinity'])assert.throws(()=>cost(bad));
const travelId=crypto.randomUUID();await ok({action:'selfRecord',...selfFields,requestId:travelId,transportMode:'taxi',estimatedCost:'128.50'},wang.cookie);
let travel=sql.prepare('SELECT * FROM bookings WHERE id=?').get(travelId);assert.equal(travel.transport_mode,'taxi');assert.equal(travel.estimated_cost_cents,12850);
await ok({action:'manageBooking',id:travelId,...selfFields,notes:'兼容旧客户端'},manager.cookie);
travel=sql.prepare('SELECT * FROM bookings WHERE id=?').get(travelId);assert.equal(travel.transport_mode,'taxi');assert.equal(travel.estimated_cost_cents,12850);
assert.equal((await call({action:'selfRecord',...selfFields,transportMode:'invalid',estimatedCost:'12'},wang.cookie)).status,400);
assert.equal((await call({action:'selfRecord',...selfFields,transportMode:'car',estimatedCost:'12.345'},wang.cookie)).status,400);
await ok({action:'manageBooking',id:travelId,...selfFields,transportMode:'walking',estimatedCost:'0.00'},manager.cookie);
travel=sql.prepare('SELECT * FROM bookings WHERE id=?').get(travelId);assert.equal(travel.transport_mode,'walking');assert.equal(travel.estimated_cost_cents,0);
await ok({action:'manageBooking',id:travelId,...selfFields,transportMode:'',estimatedCost:''},manager.cookie);
travel=sql.prepare('SELECT * FROM bookings WHERE id=?').get(travelId);assert.equal(travel.estimated_cost_cents,null);
const farMeal=localTime(Date.now()+42*86400000);await ok({action:'book',...selfFields,mealAt:farMeal,transportMode:'public_transit',estimatedCost:'88.88'},otherSession.cookie);
const trip=(await state(otherSession.cookie)).bookings.find(b=>b.status==='pending');assert.equal(trip.transport_mode,'public_transit');assert.equal(trip.estimated_cost_cents,8888);
const notification=sql.prepare("SELECT message FROM notices WHERE booking_id=? AND user_id='wang-yida'").get(trip.id);assert.ok(notification.message.includes('公共交通')&&notification.message.includes('88.88 元/人'));
await ok({action:'approve',id:trip.id},wang.cookie);const approvedNotice=sql.prepare("SELECT message FROM notices WHERE booking_id=? AND user_id=? ORDER BY id DESC").get(trip.id,other.id);assert.ok(approvedNotice.message.includes('公共交通')&&approvedNotice.message.includes('88.88'));
console.log('PASS: exact-cent cost validation, optional historical values, native/web booking roundtrip, old-client edit preservation, zero/clear values and detailed notification content.');

const {androidDownload,downloadRange}=await moduleFrom('lib/android-download.ts');
assert.deepEqual(downloadRange('bytes=-3',10),[7,9]);assert.deepEqual(downloadRange('bytes=2-',10),[2,9]);assert.equal(downloadRange('bytes=9-2',10),null);assert.equal(downloadRange('bytes=10-',10),null);assert.equal(downloadRange('bytes=0-1,3-4',10),null);
const blocks=[new TextEncoder().encode('01234'),new TextEncoder().encode('56789')];const manifest={bytes:10,sha256:'a'.repeat(64),parts:blocks.map((b,i)=>({path:'/android-packages/2.2.0/part-'+i+'.bin',bytes:b.length}))};
const assets={async fetch(request){const url=new URL(request.url);if(url.pathname.endsWith('.json'))return Response.json(manifest);const i=Number(url.pathname.match(/part-(\d+)/)[1]);const [a,b]=request.headers.get('Range').slice(6).split('-').map(Number);return new Response(blocks[i].slice(a,b+1),{status:206});}};
for(const [range,expected] of [[null,'0123456789'],['bytes=2-7','234567'],['bytes=5-','56789'],['bytes=-2','89']]){const r=await androidDownload(new Request('https://test.invalid/downloads/wyd-meal-reservation-2.2.0-native.apk',{headers:range?{Range:range}:{}}),assets);assert.equal(r.status,range?206:200);assert.equal(await r.text(),expected);assert.equal(Number(r.headers.get('content-length')),expected.length);}
const head=await androidDownload(new Request('https://test.invalid/downloads/wyd-meal-reservation-2.2.0-native.apk',{method:'HEAD'}),assets);assert.equal(await head.text(),'');assert.equal(head.headers.get('content-length'),'10');assert.equal((await androidDownload(new Request('https://test.invalid/downloads/wyd-meal-reservation-2.2.0-native.apk',{headers:{Range:'bytes=20-'}}),assets)).status,416);
console.log('PASS: range-resumable streamed APK downloads including cross-part ranges and HEAD.');

const wholeAssets={async fetch(request){const url=new URL(request.url);if(url.pathname.endsWith('.json'))return Response.json(manifest);const index=Number(url.pathname.match(/part-(\d+)/)[1]);return new Response(new ReadableStream({start(controller){controller.enqueue(blocks[index].slice(0,3));controller.enqueue(blocks[index].slice(3));controller.close();}}));}};
const fallback=await androidDownload(new Request('https://test.invalid/downloads/wyd-meal-reservation-2.2.0-native.apk',{headers:{Range:'bytes=2-7'}}),wholeAssets);assert.equal(await fallback.text(),'234567');console.log('PASS: asset bindings without Range support stream-skip correctly across APK parts.');

await (await import("./test-management-reviews.mjs")).testManagementReviews({sql,db,state,call,ok,wang,user,manager,otherSession,other,password,localTime,settleReviews:globalThis.__mealReviews.settleReviews,avatar});

// Invoke the production scheduler directly with no HTTP requests or signed-in users.
globalThis.__deliverNotifications=deliverNotifications;
const {default:scheduledWorker}=await moduleFrom('worker/index.ts',[
 ["import {androidDownload} from '../lib/android-download';","const androidDownload=()=>{throw Error('unexpected HTTP request');};"],
 ["import handler from 'vinext/server/fetch-handler';","const handler={fetch(){throw Error('unexpected HTTP request');}};"],
 ["import {deliverNotifications} from '../lib/mail-notifications';","const deliverNotifications=globalThis.__deliverNotifications;"],
 ["import {settleMeals} from '../lib/meal-lifecycle';","const settleMeals=globalThis.__settleMeals;"],
 ["import {settleReviews} from '../lib/meal-reviews';","const {settleReviews}=globalThis.__mealReviews;"],
]);
const offlineReview=crypto.randomUUID();
sql.prepare("INSERT INTO meal_reviews(id,requester_id,food,calories,deadline,created) VALUES(?,'wang-yida','离线发信测试',123,?,?)")
 .run(offlineReview,Date.now()-1000,new Date().toISOString());
const offlineBooking=trip.id,offlineMealAt=new Date(Date.now()-25*3600000).toISOString();
sql.prepare("UPDATE bookings SET meal_at=?,restaurant='离线用餐测试' WHERE id=?").run(offlineMealAt,offlineBooking);
sql.exec("UPDATE mail_outbox SET status='sent' WHERE status='pending'");
const offlineMail=[];
globalThis.fetch=async(url,options)=>{
 assert.equal(url,'https://api.resend.com/emails');
 offlineMail.push(JSON.parse(options.body).text);
 return Response.json({id:'offline-test-mail'});
};
await scheduledWorker.scheduled({scheduledTime:Date.parse('2026-11-07T10:13:00Z')},globalThis.__env);
assert.equal(sql.prepare('SELECT result FROM meal_reviews WHERE id=?').get(offlineReview).result,'denied');
assert.equal(sql.prepare('SELECT status FROM bookings WHERE id=?').get(offlineBooking).status,'completed');
assert.ok(offlineMail.some(message=>message.includes('离线发信测试')));
assert.ok(offlineMail.some(message=>message.includes('离线用餐测试')));
const deliveryCount=offlineMail.length;
await scheduledWorker.scheduled({scheduledTime:Date.parse('2026-11-07T10:14:00Z')},globalThis.__env);
assert.equal(offlineMail.length,deliveryCount);
console.log('PASS: scheduled review and booking settlement send mail without HTTP activity; rerun sends no duplicates.');
