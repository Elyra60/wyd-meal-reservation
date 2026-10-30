import handler from 'vinext/server/fetch-handler';
import {settleMeals} from '../lib/meal-lifecycle';
export default {
 fetch(request:Request,env:any,ctx:ExecutionContext){
  const url=new URL(request.url);
  if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){
   url.protocol='https:';return Response.redirect(url.toString(),308);
  }
  return handler.fetch(request,env,ctx);
 },
 async scheduled(_event:ScheduledEvent,env:any){await settleMeals(env.DB);}
};
