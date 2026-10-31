type MailEnv={DB:D1Database;RESEND_API_KEY?:string;MAIL_FROM?:string};
type Delivery={id:number;recipient:string;subject:string;body:string;attempts:number;first_attempt:number};
// Notices and deliveries are inserted in the same database transaction. A lease
// and Resend's idempotency key protect concurrent request/cron delivery attempts.
export async function deliverNotifications(env:MailEnv,maximum=8,now=Date.now()){
 if(!env.RESEND_API_KEY||!env.MAIL_FROM)return;
 for(let i=0;i<maximum;i++){
  const token=crypto.randomUUID();
  const job=await env.DB.prepare(`UPDATE mail_outbox SET status='sending',lease_token=?,lease_until=?,attempts=attempts+1,first_attempt=COALESCE(first_attempt,?)
   WHERE id=(SELECT id FROM mail_outbox WHERE (status='pending' AND next_attempt<=?) OR (status='sending' AND lease_until<?) ORDER BY id LIMIT 1)
   RETURNING id,recipient,subject,body,attempts,first_attempt`).bind(token,now+120000,now,now,now).first<Delivery>();
  if(!job)break;
  // Never retry an uncertain delivery outside the provider's 24-hour key window.
  if(now-job.first_attempt>23*3600000){await env.DB.prepare("UPDATE mail_outbox SET status='failed',last_error='RETRY_WINDOW_EXPIRED' WHERE id=? AND lease_token=?").bind(job.id,token).run();continue;}
  try{
   const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'wyd-notice-'+job.id},signal:AbortSignal.timeout(10000),body:JSON.stringify({from:env.MAIL_FROM,to:job.recipient,subject:job.subject,text:job.body+'\n\n登录网站查看：https://wyd-meal-reservation.online'})});
   if(!result.ok)throw new Error('HTTP_'+result.status);
   await env.DB.prepare("UPDATE mail_outbox SET status='sent',sent_at=?,last_error=NULL,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").bind(new Date(now).toISOString(),job.id,token).run();
  }catch(e){
   const code=e instanceof Error&&/^HTTP_\d+$/.test(e.message)?e.message:'NETWORK_ERROR';
   await env.DB.prepare("UPDATE mail_outbox SET status=?,next_attempt=?,last_error=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").bind(job.attempts>=10?'failed':'pending',now+Math.min(3600000,60000*2**(job.attempts-1)),code,job.id,token).run();
   // Stop on service/network failure rather than retrying an entire backlog.
   break;
  }
 }
}
