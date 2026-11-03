import {env} from 'cloudflare:workers';
import {requestUser} from '../../../lib/request-user';
const headers={'Cache-Control':'no-store'};
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'请求来源无效。'},{status:403,headers});
 const user=await requestUser(request);if(!user)return Response.json({error:'请重新登录。'},{status:401,headers});
 if(user.must_change)return Response.json({error:'请先修改初始密码。'},{status:403,headers});
 const db=env.DB;let body:any;
 try{if(Number(request.headers.get('content-length')||0)>2048)throw Error();const raw=await request.text();if(raw.length>2048)throw Error();body=JSON.parse(raw);}catch{return Response.json({error:'请求内容无效。'},{status:400,headers});}
 const {registrationId,deviceProof,enabled}=body;
 if(typeof registrationId!=='string'||! /^[a-zA-Z0-9_-]{10,128}$/.test(registrationId)||typeof deviceProof!=='string'||! /^[a-f0-9]{64}$/.test(deviceProof)||typeof enabled!=='boolean')return Response.json({error:'设备信息无效。'},{status:400,headers});
 const proof=await hash(deviceProof),token=request.headers.get('cookie')!.match(/(?:^|;\s*)meal_session=([^;]+)/)![1],session=await hash(token);
 // Claiming an existing device requires its installation secret, including after logout.
 const old=await db.prepare('SELECT proof_hash,binding,user_id,session_token FROM push_devices WHERE registration_id=?').bind(registrationId).first<any>();
 if(old&&old.proof_hash!==proof)return Response.json({error:'设备绑定无法验证，请重新安装后重试。'},{status:409,headers});
 const binding=enabled&&old?.user_id===user.id&&old?.session_token===session?old.binding:crypto.randomUUID();
 const result=await db.prepare(`INSERT INTO push_devices(registration_id,proof_hash,user_id,session_token,binding,updated) VALUES(?,?,?,?,?,?)
 ON CONFLICT(registration_id) DO UPDATE SET user_id=excluded.user_id,session_token=excluded.session_token,binding=excluded.binding,updated=excluded.updated WHERE push_devices.proof_hash=excluded.proof_hash RETURNING binding`).bind(registrationId,proof,enabled?user.id:null,enabled?session:null,binding,Date.now()).first<any>();
 if(!result)return Response.json({error:'设备绑定无法验证。'},{status:409,headers});
 return Response.json({enabled,binding:result.binding,userId:user.id},{headers});
}
