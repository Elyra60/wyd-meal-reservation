import {spawn} from 'node:child_process';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
async function hidden(prompt){if(!process.stdin.isTTY)throw Error('请在交互终端运行设置，密钥不会回显。');process.stdout.write(prompt);return new Promise((resolve,reject)=>{let value='';const finish=()=>{process.stdin.off('data',data);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};const data=chunk=>{for(const char of chunk.toString()){if(char==='\u0003'){finish();reject(Error('已取消'));return;}if(char==='\r'||char==='\n'){finish();resolve(value);return;}if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else if(char>=' ')value+=char;}};process.stdin.setRawMode(true);process.stdin.on('data',data);process.stdin.resume();});}
async function initial(label){const p=await hidden(label+'初始密码（至少10位）：');if(p.length<10||p.length>128)throw Error('密码须为10–128位。');if(p!==await hidden('再次输入确认：'))throw Error('两次密码不一致。');const salt=randomBytes(16).toString('hex');return salt+':'+pbkdf2Sync(p,salt,100000,32,'sha256').toString('hex');}
const values={WY_INITIAL_HASH:await initial('王亦达'),MANAGER_INITIAL_HASH:await initial('管理员')};
values.RESEND_API_KEY=await hidden('Resend API Key（留空则稍后配置）：');
const reader=createInterface({input:process.stdin,output:process.stdout});values.MAIL_FROM=await reader.question('发件地址 [王亦达放纵餐预约 <no-reply@wyd-meal-reservation.online>]：');reader.close();values.MAIL_FROM=values.MAIL_FROM||'王亦达放纵餐预约 <no-reply@wyd-meal-reservation.online>';
values.AMAP_JS_KEY=await hidden('高德 JS API Key（留空则稍后配置）：');values.AMAP_SECURITY_CODE=await hidden('高德安全密钥（留空则稍后配置）：');
const payload=Object.fromEntries(Object.entries(values).filter(([,v])=>v));
const child=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url)),'secret','bulk','--config','wrangler.json'],{stdio:['pipe','inherit','inherit'],windowsHide:true});child.stdin.end(JSON.stringify(payload));const code=await new Promise(resolve=>child.on('exit',resolve));if(code!==0)throw Error('上传配置失败，请确认 Cloudflare 已登录且 Worker 已创建。');console.log('私密配置上传完成。初始密码只用于创建新账号，不会覆盖已存在账号的密码。');
