import handler from 'vinext/server/fetch-handler';
import {deliverNotifications} from '../lib/mail-notifications';
import {settleMeals} from '../lib/meal-lifecycle';
export default {
 async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  const url=new URL(request.url);
  if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){
   url.protocol='https:';return Response.redirect(url.toString(),308);
  }
  const response=await handler.fetch(request,env,ctx);
  if(url.pathname==='/api/action')ctx.waitUntil(deliverNotifications(env).catch(()=>console.error('notification_delivery_failed')));
  return response;
 },
 async scheduled(_event:ScheduledEvent,env:Cloudflare.Env){await settleMeals(env.DB);await deliverNotifications(env,50);}
};
