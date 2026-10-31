import {mealFields,calories,mealWeek} from '../../../lib/meal-fields';
import {avatarStore} from '../../../lib/avatar-store';
import { env } from 'cloudflare:workers';
import { settleMeals } from '../../../lib/meal-lifecycle';
const FULL='所选用餐周的放纵餐名额已满，请选择其他周。';
const E={...(env as any),BUCKET:avatarStore((env as any).DB)}; const db=()=>E.DB;
const json=(x:any,status=200,cookie?:string)=>Response.json(x,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
async function password(p:string,s=crypto.randomUUID()){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);return s+':'+hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(s),iterations:100000,hash:'SHA-256'},key,256));}
const equal=(a:string,b:string)=>{let n=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)n|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return n===0;};
const capSql=(w:string)=>`COALESCE((SELECT meal_limit FROM weekly_limits WHERE week=${w}),(SELECT meal_limit FROM weekly_limits WHERE week='default'),2)`;
const quota=async(w:string)=>Number((await db().prepare('SELECT '+capSql('?')+' AS n').bind(w).first()).n);
const audit=(u:any,action:string,target:string,details:any)=>db().prepare('INSERT INTO audit_log(actor,action,target,details,created) VALUES(?,?,?,?,?)').bind(u.id,action,target,JSON.stringify(details),new Date().toISOString());
const week=mealWeek;
const cookie=(token:string,age=604800)=>`meal_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
async function identity(r:Request){const t=r.headers.get('cookie')?.match(/(?:^|;\s*)meal_session=([^;]+)/)?.[1];const user=t?await db().prepare('SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?').bind(await hash(t),Date.now()).first():null;return user?.disabled?null:user;}
async function limit(key:string,max:number){const k=await hash(key+':'+Math.floor(Date.now()/600000));const r=await db().prepare('INSERT INTO rates(key,count) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(k).first();if(r.count>max)throw new Error('操作过于频繁，请十分钟后再试。');}
async function session(u:any){const t=crypto.randomUUID()+crypto.randomUUID();await db().prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').bind(await hash(t),u.id,Date.now()+604800000).run();return json({ok:true},200,cookie(t));}
async function prepareAccounts(){
 if(E.WY_INITIAL_HASH)await db().prepare("INSERT OR IGNORE INTO users(id,email,username,password,role,must_change) VALUES('wang-yida','3025244268','3025244268',?,'admin',1)").bind(E.WY_INITIAL_HASH).run();
 await db().prepare("UPDATE users SET username=CASE WHEN id='wang-yida' THEN '3025244268' ELSE 'u_'||replace(id,'-','') END WHERE username IS NULL").run();
 if(E.MANAGER_INITIAL_HASH)await db().prepare("INSERT OR IGNORE INTO users(id,email,username,password,role,must_change) VALUES('site-manager','manager@internal.invalid','siteadmin',?,'manager',1)").bind(E.MANAGER_INITIAL_HASH).run();
}
const validUsername=(value:string)=>/^[a-z0-9_]{3,40}$/.test(value)&&!['3025244268','siteadmin'].includes(value);
async function mealData(u:any){
 const w=week();const scoped=u.role==='user'?' AND user_id=?':'';const args=u.role==='user'?[u.id]:[];
 const [q,limits,stats]=await Promise.all([
 db().prepare("SELECT a.week,count(*) AS count,sum(CASE WHEN b.status='completed' THEN 1 ELSE 0 END) AS used,sum(CASE WHEN b.status='approved' THEN 1 ELSE 0 END) AS reserved FROM approvals a JOIN bookings b ON b.id=a.booking_id GROUP BY a.week").all(),
 db().prepare('SELECT * FROM weekly_limits ORDER BY week DESC').all(),
 db().prepare("SELECT count(*) AS meals,COALESCE(sum(calories),0) AS totalCalories,sum(CASE WHEN calories IS NULL THEN 1 ELSE 0 END) AS missingCalories,COALESCE(sum(CASE WHEN week=? THEN calories ELSE 0 END),0) AS weekCalories FROM bookings WHERE status='completed'"+scoped).bind(w,...args).first()]);
 return {quotas:q.results,weeklyLimits:limits.results,mealStats:stats,week:w,weekLimit:await quota(w)};
}
export async function GET(r:Request){try{await prepareAccounts();const u=await identity(r);if(!u)return json({user:null,mailReady:!!(E.RESEND_API_KEY&&E.MAIL_FROM)});if(u.role==='admin'&&!u.email.includes('@'))return json({user:{id:u.id,email:u.email,username:u.username,role:u.role,mustChange:!!u.must_change,mustBindEmail:true},mailReady:!!(E.RESEND_API_KEY&&E.MAIL_FROM)});if(u.role==='manager'){await settleMeals(db());const users=u.must_change?{results:[]}:await db().prepare('SELECT id,email,username,role,nickname,avatar_key,username_changed_at,disabled FROM users ORDER BY role,username').all();const bookings=u.must_change?{results:[]}:await db().prepare('SELECT * FROM bookings ORDER BY created DESC').all();const notices=u.must_change?{results:[]}:await db().prepare('SELECT * FROM notices ORDER BY created DESC').all();return json({...(u.must_change?{}:await mealData(u)),mailDeliveries:u.must_change?[]:(await db().prepare('SELECT id,notice_id,recipient,status,attempts,last_error,sent_at FROM mail_outbox ORDER BY id DESC LIMIT 100').all()).results,user:{id:u.id,email:u.email,username:u.username,role:u.role,mustChange:!!u.must_change},weeklyLimits:u.must_change?[]:(await db().prepare('SELECT * FROM weekly_limits ORDER BY week DESC').all()).results,audit:u.must_change?[]:(await db().prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300').all()).results,users:users.results,bookings:bookings.results,notices:notices.results,mailReady:!!(E.RESEND_API_KEY&&E.MAIL_FROM)});}await settleMeals(db());const w=week();const [b,n,q]=await Promise.all([db().prepare(u.role==='admin'?'SELECT * FROM bookings ORDER BY created DESC':'SELECT * FROM bookings WHERE user_id=? ORDER BY created DESC').bind(...(u.role==='admin'?[]:[u.id])).all(),db().prepare('SELECT * FROM notices WHERE user_id=? ORDER BY id DESC LIMIT 100').bind(u.id).all(),db().prepare("SELECT a.week,count(*) AS count,sum(CASE WHEN b.status='completed' THEN 1 ELSE 0 END) AS used,sum(CASE WHEN b.status='approved' THEN 1 ELSE 0 END) AS reserved FROM approvals a JOIN bookings b ON b.id=a.booking_id GROUP BY a.week").all()]);return json({...await mealData(u),user:{id:u.id,email:u.email,role:u.role,username:u.username,usernameChangedAt:u.username_changed_at,mustBindEmail:false,mustChange:!!u.must_change,nickname:u.nickname||'',avatarUrl:u.avatar_key?'/api/avatar?v='+encodeURIComponent(u.avatar_key):null},bookings:b.results,notices:n.results,quotas:q.results,week:w,weekLimit:await quota(w),mailReady:!!(E.RESEND_API_KEY&&E.MAIL_FROM)});}catch{return json({error:'读取失败，请稍后重试。'},503);}}
export async function POST(r:Request){try{
 if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'请求来源无效'},403);
 await prepareAccounts();if(Number(r.headers.get('content-length')||0)>220000)return json({error:'上传内容过大。'},413);await settleMeals(db());const raw=await r.text();if(raw.length>220000)return json({error:'上传内容过大。'},413);const b=JSON.parse(raw) as any;const a=b.action;const p=String(b.password||'');const email=String(b.email||'').trim().toLowerCase();const now=Date.now();
 if(['login','sendCode','verify'].includes(a))await limit('ip:'+(r.headers.get('cf-connecting-ip')||'local')+':'+a,30);
 if(a==='login'){
  await limit('login:'+email,10);

  await prepareAccounts();const u=await db().prepare("SELECT * FROM users WHERE username=? OR (email=? AND email LIKE '%@%')").bind(email,email).first();const h=u?.password||E.WY_INITIAL_HASH;if(!h||!equal(await password(p,h.split(':')[0]),h)||!u)throw new Error('账号或密码不正确。');if(u.disabled)throw new Error('账号已被停用，请联系管理员。');if(b.managerLogin&&u.role!=='manager')throw new Error('请使用管理员账号登录此入口。');return session(u);
 }
 if(a==='sendCode'||a==='verify'){
  if(!E.RESEND_API_KEY||!E.MAIL_FROM)return json({error:'邮箱服务尚未配置，注册和找回密码暂未开放。'},503);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('请输入有效邮箱。');
  const purpose=b.purpose==='reset'?'reset':'register';await limit(a+':'+email,a==='sendCode'?3:8);
  if(a==='sendCode'){
   const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
   await db().prepare('INSERT INTO challenges(email,code,purpose,expires) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET code=excluded.code,purpose=excluded.purpose,expires=excluded.expires').bind(email,await hash(code),purpose,now+600000).run();
   const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+E.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:E.MAIL_FROM,to:email,subject:'王亦达放纵餐预约 · 邮箱验证码',text:`你的${purpose==='reset'?'重置密码':'注册'}验证码为 ${code}，10 分钟内有效。请勿向他人透露。`})});if(!result.ok){await db().prepare('DELETE FROM challenges WHERE email=?').bind(email).run();throw new Error('验证码发送失败，请稍后重试。');}return json({ok:true});
  }
  const username=String(b.username||'').trim().toLowerCase();if(purpose==='register'){if(!validUsername(username))throw new Error('用户名须为3–40位字母、数字或下划线，此名称不可使用。');if(await db().prepare('SELECT id FROM users WHERE username=?').bind(username).first())throw new Error('此用户名已被使用。');}if(p.length<10||p.length>128)throw new Error('密码长度须为 10–128 位。');
  const c=await db().prepare('DELETE FROM challenges WHERE email=? AND code=? AND purpose=? AND expires>? RETURNING email').bind(email,await hash(String(b.code)),purpose,now).first();if(!c)throw new Error('验证码错误或已过期。');
  const ph=await password(p);const id=crypto.randomUUID();
  if(purpose==='register'){try{await db().prepare("INSERT INTO users(id,email,password,username) VALUES(?,?,?,?)").bind(id,email,ph,username).run();}catch{throw new Error('邮箱或用户名已被注册，请更换后重试。');}return session({id});}
  const u=await db().prepare('SELECT id FROM users WHERE email=? AND role IN (?,?)').bind(email,'user','admin').first();if(u)await db().batch([db().prepare('UPDATE users SET password=? WHERE id=?').bind(ph,u.id),db().prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id)]);return json({ok:true});
 }
 const u=await identity(r);if(!u)return json({error:'请先登录。'},401);
 if(a==='logout'){const t=r.headers.get('cookie')?.match(/(?:^|;\s*)meal_session=([^;]+)/)?.[1]||'';await db().prepare('DELETE FROM sessions WHERE token=?').bind(await hash(t)).run();return json({ok:true},200,cookie('',0));}
 if(a==='password'){
  if(p.length<10||p.length>128)throw new Error('新密码长度须为 10–128 位。');if(p===b.oldPassword)throw new Error('新密码不能与旧密码相同。');if(!equal(await password(String(b.oldPassword||''),u.password.split(':')[0]),u.password))throw new Error('原密码不正确。');
  await db().batch([db().prepare('UPDATE users SET password=?,must_change=0 WHERE id=?').bind(await password(p),u.id),db().prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id)]);return session(u);
 }
 if(u.role==='admin'&&!u.email.includes('@')&&!['sendEmailChangeCode','changeEmail'].includes(a))throw new Error('请先验证并绑定邮箱。');
 if(a==='username'){
 if(u.must_change)throw new Error('请先修改初始密码。');const name=String(b.username||'').trim().toLowerCase();if(!validUsername(name))throw new Error('用户名须为3–40位字母、数字或下划线，此名称不可使用。');if(name===u.username)throw new Error('请输入新的用户名。');
 const next=u.username_changed_at?new Date(u.username_changed_at):null;if(next){const day=next.getUTCDate();next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);const end=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();next.setUTCDate(Math.min(day,end));if(now<next.getTime())throw new Error('每月仅可修改一次用户名，下次可修改时间：'+next.toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'}));}
 if(await db().prepare('SELECT id FROM users WHERE username=?').bind(name).first())throw new Error('此用户名已被使用。');
 const changed=await db().prepare('UPDATE users SET username=?,username_changed_at=? WHERE id=? AND username=? AND username_changed_at IS ? RETURNING id').bind(name,now,u.id,u.username,u.username_changed_at??null).first();if(!changed)throw new Error('用户名已被修改，请刷新。');return json({ok:true});
 }
 if(u.must_change&&!((u.role==='admin')&&['sendEmailChangeCode','changeEmail'].includes(a)))throw new Error('请先修改初始密码。');
 if(a==='profile'){
  await limit('profile:'+u.id,20);const nickname=String(b.nickname||'').trim();if(!nickname||nickname.length>30)throw new Error('昵称须为1至30个字符。');
  let avatarKey=u.avatar_key||null,createdKey:string|null=null;
  if(b.removeAvatar===true)avatarKey=null;
  if(b.avatarData){if(typeof b.avatarData!=='string'||b.avatarData.length>180000)throw new Error('头像图片过大。');const match=b.avatarData.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match)throw new Error('头像仅支持 JPG、PNG 或 WebP 图片。');
   const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));if(bytes.length>131072||bytes.length<12)throw new Error('头像图片大小无效。');const valid=match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:match[1]==='png'?Array.from(bytes.slice(0,8)).join(',')==='137,80,78,71,13,10,26,10':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!valid)throw new Error('头像图片格式无效。');if(!E.BUCKET)throw new Error('头像存储尚未就绪，请稍后重试。');
   createdKey='avatars/'+u.id+'/'+crypto.randomUUID()+'.'+match[1];await E.BUCKET.put(createdKey,bytes,{httpMetadata:{contentType:'image/'+match[1]}});avatarKey=createdKey;
  }
  try{await db().prepare('UPDATE users SET nickname=?,avatar_key=? WHERE id=?').bind(nickname,avatarKey,u.id).run();}catch(e){if(createdKey)await E.BUCKET.delete(createdKey);throw e;}
  if(u.avatar_key&&u.avatar_key!==avatarKey&&E.BUCKET){try{await E.BUCKET.delete(u.avatar_key);}catch{}}
  return json({ok:true});
 }
 if(a==='sendEmailChangeCode'||a==='changeEmail'){
  if(!E.RESEND_API_KEY||!E.MAIL_FROM)return json({error:'邮箱服务尚未配置，更换邮箱暂未开放。'},503);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||email===u.email)throw new Error('请输入一个与当前账号不同的有效邮箱。');
  await limit('email-change:'+a+':'+u.id,a==='sendEmailChangeCode'?3:8);
  if(!equal(await password(p,u.password.split(':')[0]),u.password))throw new Error('当前密码不正确。');
  if(await db().prepare('SELECT id FROM users WHERE email=?').bind(email).first())throw new Error('该邮箱已被其他账号使用。');
  const purpose='email-change:'+u.id;
  if(a==='sendEmailChangeCode'){
   const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');await db().prepare('INSERT INTO challenges(email,code,purpose,expires) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET code=excluded.code,purpose=excluded.purpose,expires=excluded.expires').bind(email,await hash(code),purpose,now+600000).run();
   const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+E.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:E.MAIL_FROM,to:email,subject:'王亦达放纵餐预约 · 更换邮箱验证',text:'你的更换邮箱验证码为 '+code+'，10分钟内有效。如非本人操作，请忽略。'})});if(!result.ok){await db().prepare('DELETE FROM challenges WHERE email=? AND purpose=?').bind(email,purpose).run();throw new Error('验证码发送失败，请稍后重试。');}return json({ok:true});
  }
  const verified=await db().prepare('DELETE FROM challenges WHERE email=? AND purpose=? AND code=? AND expires>? RETURNING email').bind(email,purpose,await hash(String(b.code||'')),now).first();if(!verified)throw new Error('验证码错误、已过期或不属于当前账号。');
  try{await db().batch([db().prepare('UPDATE users SET email=? WHERE id=?').bind(email,u.id),db().prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id)]);}catch{throw new Error('邮箱更换失败，该邮箱可能已被使用，请重新验证。');}return session(u);
 }
 if(a.startsWith('manage')){
 if(u.role!=='manager')return json({error:'仅管理员可执行此操作。'},403);await limit('manage:'+u.id,80);
 if(a==='manageQuota'){const w=String(b.week||'default'),n=Number(b.limit);if(w!=='default'&&(!/^\d{4}-\d{2}-\d{2}$/.test(w)||week(new Date(w+'T00:00:00+08:00'))!==w))throw new Error('请选择有效的周一日期。');if(!Number.isInteger(n)||n<0||n>100)throw new Error('额度须为0至100的整数，0表示暂停预约。');const previous=await db().prepare('SELECT * FROM weekly_limits WHERE week=?').bind(w).first();await db().batch([db().prepare('INSERT INTO weekly_limits(week,meal_limit) VALUES(?,?) ON CONFLICT(week) DO UPDATE SET meal_limit=excluded.meal_limit').bind(w,n),audit(u,a,w,{before:previous,after:n})]);return json({ok:true});}
 if(a==='manageUser'){const target=await db().prepare('SELECT id,username,email,nickname,role,disabled FROM users WHERE id=?').bind(String(b.id)).first();if(!target)throw new Error('用户不存在。');const username=String(b.username||'').trim().toLowerCase(),nickname=String(b.nickname||'').trim(),mail=String(b.email||'').trim().toLowerCase(),disabled=b.disabled===true?1:0;if(username!==target.username&&!validUsername(username))throw new Error('用户名格式无效或不可使用。');if(nickname.length>30)throw new Error('昵称最多30字。');if(mail!==target.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))throw new Error('请输入有效邮箱。');if(target.role!=='user'&&disabled)throw new Error('不能停用王亦达或管理员账号。');const next={username,email:mail,nickname,disabled};await db().batch([db().prepare('UPDATE users SET username=?,email=?,nickname=?,disabled=?,username_changed_at=CASE WHEN username!=? THEN ? ELSE username_changed_at END WHERE id=?').bind(username,mail,nickname,disabled,username,now,target.id),db().prepare('DELETE FROM sessions WHERE user_id=? AND user_id!=?').bind(target.id,u.id),audit(u,a,target.id,{before:target,after:next})]);return json({ok:true});}
 const target=await db().prepare('SELECT * FROM bookings WHERE id=?').bind(String(b.id)).first();if(!target)throw new Error('预约不存在。');
 if(a==='manageCancel'){
  if(!['pending','approved','completed'].includes(target.status))throw new Error('这份记录已经结束或取消。');
  const reason=String(b.reason||'').trim();if(!reason||reason.length>300)throw new Error('请填写300字以内的取消原因。');
  await db().batch([db().prepare('UPDATE bookings SET id=CASE WHEN status=? THEN id ELSE NULL END WHERE id=?').bind(target.status,target.id),db().prepare("UPDATE bookings SET status='cancelled',cancelled_by=?,reason=? WHERE id=?").bind(u.id,reason,target.id),audit(u,a,target.id,{before:target,reason})]);return json({ok:true});
 }
 if(a==='manageBooking'){
  const f=mealFields(b,'edit'),dt=new Date(f.mealAt),changedTime=f.mealAt!==target.meal_at;
  if(changedTime&&target.status==='completed'&&dt.getTime()>now)throw new Error('已完成的用餐不能改到未来。');
  if(changedTime&&['pending','approved'].includes(target.status)&&dt.getTime()<=now)throw new Error('未完成预约只能改到未来。');
  const kcal=target.status==='completed'?calories(b.calories):target.calories??null;
  const move=f.week!==target.week&&['approved','completed'].includes(target.status);
  const queries=[db().prepare('UPDATE bookings SET id=CASE WHEN status=? AND meal_at=? THEN id ELSE NULL END WHERE id=?').bind(target.status,target.meal_at,target.id)];
  if(move)queries.push(db().prepare('DELETE FROM approvals WHERE booking_id=?').bind(target.id));
  if(target.status==='pending')queries.push(db().prepare('UPDATE bookings SET id=CASE WHEN (SELECT count(*) FROM approvals WHERE week=?)<'+capSql('?')+' THEN id ELSE NULL END WHERE id=?').bind(f.week,f.week,target.id));
  queries.push(db().prepare('UPDATE bookings SET name=?,restaurant=?,address=?,companions=?,contact=?,notes=?,party_size=?,meal_type=?,meal_at=?,week=?,calories=?,latitude=CASE WHEN address!=? OR restaurant!=? THEN NULL ELSE latitude END,longitude=CASE WHEN address!=? OR restaurant!=? THEN NULL ELSE longitude END WHERE id=?').bind(f.name,f.restaurant,f.address,f.companions,f.contact,f.notes,f.partySize,f.mealType,f.mealAt,f.week,kcal,f.address,f.restaurant,f.address,f.restaurant,target.id));
  if(move)queries.push(db().prepare('INSERT INTO approvals(booking_id,week,slot) VALUES(?,?,COALESCE((SELECT max(slot)+1 FROM approvals WHERE week=?),1))').bind(target.id,f.week,f.week));
  queries.push(audit(u,a,target.id,{before:target,after:{...f,calories:kcal}}));await db().batch(queries);return json({ok:true});
 }
 return json({error:'无效管理操作。'},400);
 }
 if(u.role==='manager')return json({error:'管理员仅可查看用户数据。'},403);
 if(a==='read'){await db().prepare('UPDATE notices SET read=1 WHERE user_id=?').bind(u.id).run();return json({ok:true});}
 if(a==='book'||a==='selfRecord'){
  const self=a==='selfRecord';if(self?u.id!=='wang-yida'||u.role!=='admin':u.role!=='user')return json({error:'此账号无权执行该操作。'},403);
  const f=mealFields(b,self?'self':'booking'),kcal=self?calories(b.calories):null;
  const requestId=String(b.requestId||crypto.randomUUID());if(!/^[a-f0-9-]{36}$/.test(requestId))throw new Error('提交标识无效，请重新打开表单。');
  if(await db().prepare('SELECT id FROM bookings WHERE id=? AND user_id=?').bind(requestId,u.id).first())return json({ok:true});
  await db().prepare('INSERT INTO bookings(id,user_id,name,restaurant,meal_at,week,created,meal_type,party_size,companions,contact,notes,address,latitude,longitude,coordinate_system,source,status,calories,completed_at,completion_method) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(requestId,u.id,f.name,f.restaurant,f.mealAt,f.week,new Date().toISOString(),f.mealType,f.partySize,f.companions,f.contact,f.notes,f.address,f.latitude,f.longitude,f.coordinateSystem,self?'self':'reservation',self?'completed':'pending',kcal,self?new Date().toISOString():null,self?'self':null).run();return json({ok:true});
 }
 const booking=await db().prepare('SELECT * FROM bookings WHERE id=?').bind(String(b.id||'')).first();if(!booking)throw new Error('预约不存在。');
 if(a==='cancel'){if((booking.user_id!==u.id&&u.role!=='admin')||!['pending','approved'].includes(booking.status))throw new Error('无法取消此预约。');const changed=await db().prepare("UPDATE bookings SET status='cancelled',cancelled_by=? WHERE id=? AND status IN ('pending','approved') RETURNING id").bind(u.id,booking.id).first();if(!changed)throw new Error('预约状态已改变，请刷新。');return json({ok:true});}
 if(a==='fillCalories'){
  if(u.id!=='wang-yida'||u.role!=='admin')return json({error:'仅王亦达可补填热量。'},403);
  const changed=await db().prepare("UPDATE bookings SET calories=? WHERE id=? AND status='completed' AND source='reservation' AND calories IS NULL RETURNING id").bind(calories(b.calories),booking.id).first();
  if(!changed)throw new Error('该记录已填写热量或状态已改变；修改请联系管理员。');return json({ok:true});
 }
 if(a==='complete'){if(u.role!=='admin')return json({error:'仅王亦达可确认完成用餐。'},403);if(booking.status!=='approved'||new Date(booking.meal_at).getTime()>now)throw new Error('请在已批准的用餐时间之后确认完成。');const changed=await db().prepare("UPDATE bookings SET status='completed',completed_at=?,completion_method='manual',calories=? WHERE id=? AND status='approved' RETURNING id").bind(new Date().toISOString(),calories(b.calories),booking.id).first();if(!changed)throw new Error('预约状态已改变，请刷新。');return json({ok:true});}
 if(u.role!=='admin')return json({error:'仅王亦达可审批。'},403);
 if(a==='approve'){
  if(new Date(booking.meal_at).getTime()<=now)throw new Error('用餐时间已过，请拒绝此预约并请用户重新提交。');
  await db().batch([
   db().prepare("INSERT OR IGNORE INTO approvals(booking_id,week,slot) SELECT id,week,COALESCE((SELECT max(slot)+1 FROM approvals WHERE week=bookings.week),1) FROM bookings WHERE id=? AND status='pending' AND (SELECT count(*) FROM approvals WHERE week=bookings.week)<"+capSql('bookings.week')).bind(booking.id),
   db().prepare("UPDATE bookings SET status='approved' WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM approvals WHERE booking_id=bookings.id)").bind(booking.id),
   db().prepare("UPDATE bookings SET status='rejected',reason=? WHERE week=? AND status='pending' AND (SELECT count(*) FROM approvals WHERE week=?)>="+capSql('bookings.week')).bind(FULL,booking.week,booking.week)
  ]);const after=await db().prepare('SELECT status FROM bookings WHERE id=?').bind(booking.id).first();if(after.status!=='approved')throw new Error(after.status==='rejected'?FULL:'预约状态已改变，请刷新。');return json({ok:true});
 }
 if(a==='reject'){const reason=String(b.reason||'').trim();if(reason.length>300)throw new Error('拒绝理由最多 300 字。');await db().prepare("UPDATE bookings SET status='rejected',reason=? WHERE id=? AND status='pending'").bind(reason,booking.id).run();return json({ok:true});}
 return json({error:'无效操作'},400);
 }catch(e:any){const msg=String(e.message||'');return json({error:msg.includes('QUOTA_BELOW_USED')?'新额度不能低于已批准和已完成的用餐次数。':msg.includes('QUOTA_FULL')?FULL:msg.includes('ACTIVE_BOOKING')?'你还有一份未完成的预约，请先完成或取消。':/D1|SQL|constraint/i.test(msg)?'数据更新失败，请刷新后重试。':msg||'操作失败，请重试。'},400);}}
