import {env} from 'cloudflare:workers';
import {requestUser} from '../../../lib/request-user';
export async function GET(request:Request){if(!await requestUser(request))return Response.json({error:'请先登录。'},{status:401});const e=env as any;const ready=!!(e.AMAP_JS_KEY&&e.AMAP_SECURITY_CODE);return Response.json({ready,key:ready?e.AMAP_JS_KEY:null},{headers:{'Cache-Control':'no-store'}});}
