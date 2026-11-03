type PushEnv={DB:D1Database;JPUSH_APP_KEY?:string;JPUSH_MASTER_SECRET?:string};
type Job={id:number;notice_id:number;registration_id:string;binding:string;attempts:number;cid:string|null;first_attempt:number};
// A durable lease prevents parallel request/cron drains. CID protects uncertain retries.
export async function deliverPush(env:PushEnv,maximum=8,now=Date.now()){
 if(!env.JPUSH_APP_KEY||!env.JPUSH_MASTER_SECRET)return;
 const headers={Authorization:'Basic '+btoa(env.JPUSH_APP_KEY+':'+env.JPUSH_MASTER_SECRET),'Content-Type':'application/json'};
 for(let i=0;i<maximum;i++){
  const lease=crypto.randomUUID();
  const job=await env.DB.prepare(`UPDATE push_outbox SET status='sending',lease_token=?,lease_until=?,attempts=attempts+1,first_attempt=COALESCE(first_attempt,?) WHERE id=(SELECT id FROM push_outbox WHERE (status='pending' AND next_attempt<=?) OR (status='sending' AND lease_until<?) ORDER BY id LIMIT 1) RETURNING *`).bind(lease,now+120000,now,now,now).first<Job>();
  if(!job)break;
  const finish=async(status:string,error:string|null=null)=>env.DB.prepare('UPDATE push_outbox SET status=?,last_error=?,lease_token=NULL,lease_until=NULL,sent_at=? WHERE id=? AND lease_token=?').bind(status,error,status==='sent'?now:null,job.id,lease).run();
  const target=await env.DB.prepare(`SELECT n.user_id,n.read FROM push_devices d JOIN sessions s ON s.token=d.session_token AND s.user_id=d.user_id JOIN users u ON u.id=d.user_id JOIN notices n ON n.id=? AND n.user_id=d.user_id WHERE d.registration_id=? AND d.binding=? AND s.expires>? AND u.disabled=0 AND u.must_change=0`).bind(job.notice_id,job.registration_id,job.binding,now).first<any>();
  if(!target||target.read){await finish('skipped','INACTIVE_OR_READ');continue;}
  if(now-job.first_attempt>23*3600000){await finish('failed','RETRY_WINDOW_EXPIRED');continue;}
  try{
   let cid=job.cid;
   if(!cid){const r=await fetch('https://api.jpush.cn/v3/push/cid?count=1&type=push',{headers,signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('HTTP_'+r.status);const b:any=await r.json();cid=b.cidlist?.[0];if(typeof cid!=='string'||cid.length>128)throw Error('PROVIDER_RESPONSE');await env.DB.prepare('UPDATE push_outbox SET cid=? WHERE id=? AND lease_token=?').bind(cid,job.id,lease).run();}
   // No private message text or session credential is handed to the provider.
   // App fetches authenticated notices after this wake-up, reusing polling dedup.
   const r=await fetch('https://api.jpush.cn/v3/push',{method:'POST',headers,signal:AbortSignal.timeout(10000),body:JSON.stringify({cid,platform:['android'],audience:{registration_id:[job.registration_id]},message:{msg_content:'你有新的预约动态',content_type:'application/json',extras:{notice_id:String(job.notice_id),user_id:target.user_id,binding:job.binding}},options:{time_to_live:3600}})});
   if(!r.ok){const body:any=await r.json().catch(()=>({}));if(body.error?.code===1011){await finish('skipped','DEVICE_UNAVAILABLE');continue;}throw Error('HTTP_'+r.status);}
   await finish('sent');
  }catch(e){const code=e instanceof Error&&/^HTTP_\d+$/.test(e.message)?e.message:'PROVIDER_ERROR';await env.DB.prepare("UPDATE push_outbox SET status=?,next_attempt=?,last_error=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").bind(job.attempts>=8?'failed':'pending',now+Math.min(3600000,60000*2**(job.attempts-1)),code,job.id,lease).run();break;}
 }
}
