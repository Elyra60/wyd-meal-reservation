import {androidDownload} from '../lib/android-download';
import handler from 'vinext/server/fetch-handler';
import {deliverNotifications} from '../lib/mail-notifications';
import {settleMeals} from '../lib/meal-lifecycle';
import {settleReviews} from '../lib/meal-reviews';
export default {
 async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  const url=new URL(request.url);
  if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){
   url.protocol='https:';return Response.redirect(url.toString(),308);
  }
  const download=await androidDownload(request,env.ASSETS,ctx);if(download)return download;
  const response=await handler.fetch(request,env,ctx);
  if(url.pathname==='/api/action')ctx.waitUntil(deliverNotifications(env).catch(()=>console.error('notification_delivery_failed')));
  return response;
 },
 async scheduled(_event:ScheduledEvent,env:Cloudflare.Env){
  // Drain queued mail even if one of the deadline checks fails.
  const settlements=await Promise.allSettled([settleReviews(env.DB),settleMeals(env.DB)]);
  const delivery=await deliverNotifications(env);
  console.log(JSON.stringify({event:'scheduled_mail',sent:delivery.sent,mailReady:delivery.configured,
   reviewCheck:settlements[0].status,bookingCheck:settlements[1].status}));
  for(const result of settlements)if(result.status==='rejected')throw result.reason;
 }
};
