import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';import {pbkdf2Sync} from 'node:crypto';import ts from 'typescript';import assert from 'node:assert/strict';
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
class Stmt{constructor(text,args=[]){this.text=text;this.args=args;}bind(...args){return new Stmt(this.text,args);}async first(){return sql.prepare(this.text).get(...this.args)||null;}async all(){return {results:sql.prepare(this.text).all(...this.args)};}async run(){return sql.prepare(this.text).run(...this.args);}}
const db={prepare:s=>new Stmt(s),async batch(stmts){sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const password='Local-Only-Test-123',ph='test:'+pbkdf2Sync(password,'test',100000,32,'sha256').toString('hex');globalThis.__env={DB:db,WY_INITIAL_HASH:ph,MANAGER_INITIAL_HASH:ph,RESEND_API_KEY:'fake',MAIL_FROM:'test@example.test'};
const moduleFrom=async(path,replacements=[])=>{let code=readFileSync(path,'utf8').replace("import { env } from 'cloudflare:workers';",'const env=globalThis.__env;').replace("import {env} from 'cloudflare:workers';",'const env=globalThis.__env;');for(const [a,b] of replacements)code=code.replace(a,b);return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));};
globalThis.__mealFields=await moduleFrom('lib/meal-fields.ts');
globalThis.__avatarStore=(await moduleFrom('lib/avatar-store.ts')).avatarStore;globalThis.__settleMeals=(await moduleFrom('lib/meal-lifecycle.ts')).settleMeals;globalThis.__requestUser=(await moduleFrom('lib/request-user.ts')).requestUser;
const {GET,POST}=await moduleFrom('app/api/action/route.ts',[["import {mealFields,calories,mealWeek} from '../../../lib/meal-fields';",'const {mealFields,calories,mealWeek}=globalThis.__mealFields;'],["import {avatarStore} from '../../../lib/avatar-store';",'const avatarStore=globalThis.__avatarStore;'],["import { settleMeals } from '../../../lib/meal-lifecycle';",'const settleMeals=globalThis.__settleMeals;']]);
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
const date=new Date(Date.now()+86400000*3).toISOString().slice(0,10);assert.equal((await call({action:'book',name:'测试用户',restaurant:'测试餐厅',mealAt:date+'T18:30'},user.cookie)).status,200);const booking=(await state(user.cookie)).bookings[0];assert.equal((await call({action:'approve',id:booking.id},wang.cookie)).status,200);await globalThis.__settleMeals(db,new Date(Date.parse(booking.meal_at)+86400000).toISOString());assert.equal((await state(user.cookie)).bookings[0].status,'completed');
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
