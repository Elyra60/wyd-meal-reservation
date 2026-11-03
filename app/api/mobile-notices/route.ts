import {env} from 'cloudflare:workers';
import {requestUser} from '../../../lib/request-user';
export async function GET(request:Request){
 const headers={'Cache-Control':'no-store'};
 const user=await requestUser(request);if(!user)return Response.json({error:'请重新登录。'},{status:401,headers});
 if(user.must_change)return Response.json({error:'请先修改初始密码。'},{status:403,headers});
 const raw=new URL(request.url).searchParams.get('after')||'0';if(!/^\d{1,15}$/.test(raw))return Response.json({error:'消息游标无效。'},{status:400,headers});
 const after=Number(raw);const results=await (env as any).DB.prepare('SELECT id,user_id,message,created,read FROM notices WHERE user_id=? AND id>? ORDER BY id ASC LIMIT 101').bind(user.id,after).all();
 const notices=results.results.slice(0,100);return Response.json({userId:user.id,notices,nextCursor:notices.length?notices.at(-1).id:after,hasMore:results.results.length>100},{headers});
}
