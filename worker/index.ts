import {androidDownload} from '../lib/android-download';
import handler from 'vinext/server/fetch-handler';
import {deliverNotifications} from '../lib/mail-notifications';
import {settleMeals} from '../lib/meal-lifecycle';
import {deliverPush} from '../lib/push-notifications';
export default {
 async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  const url=new URL(request.url);
  if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){
   url.protocol='https:';return Response.redirect(url.toString(),308);
  }
  const download=await androidDownload(request,env.ASSETS,ctx);if(download)return download;
  const response=await handler.fetch(request,env,ctx);
  if(url.pathname==='/api/action')ctx.waitUntil(Promise.allSettled([deliverNotifications(env),deliverPush(env)]));
  return response;
 },
 async scheduled(_event:ScheduledEvent,env:Cloudflare.Env){await settleMeals(env.DB);await Promise.allSettled([deliverNotifications(env,50),deliverPush(env,50)]);}
};
