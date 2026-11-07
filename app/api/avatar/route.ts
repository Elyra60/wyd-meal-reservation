import {avatarStore} from '../../../lib/avatar-store';
import {env} from 'cloudflare:workers';
import {requestUser} from '../../../lib/request-user';
export async function GET(request:Request){
 const user=await requestUser(request);
 if(!user)return new Response(null,{status:401});
 const query=new URL(request.url).searchParams;
 const reviewAuthor=query.get('reviewAuthor');
 const target=query.get('userId');
 let key=user.avatar_key;
 if(reviewAuthor){
  if(user.must_change)return new Response(null,{status:403});
  const author=await env.DB.prepare(`SELECT u.avatar_key FROM users u WHERE u.id=?
   AND EXISTS(SELECT 1 FROM meal_review_comments c WHERE c.user_id=u.id)`).bind(reviewAuthor).first<{avatar_key:string|null}>();
  key=author?.avatar_key;
 }else if(target&&target!==user.id){
  const manager=user.role==='manager'||(user.role==='user'&&user.can_manage===1);
  if(!manager||user.must_change)return new Response(null,{status:403});
  key=(await env.DB.prepare('SELECT avatar_key FROM users WHERE id=?').bind(target).first<{avatar_key:string|null}>())?.avatar_key;
 }
 if(!key)return new Response(null,{status:404});
 const file=await avatarStore(env.DB).get(key);
 if(!file)return new Response(null,{status:404});
 return new Response(file.body,{headers:{
  'Content-Type':file.httpMetadata?.contentType||'image/jpeg',
  'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=300'
 }});
}
