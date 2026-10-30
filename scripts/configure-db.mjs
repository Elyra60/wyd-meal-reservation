import {readFileSync,writeFileSync} from 'node:fs';
const id=process.argv[2];if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id||'')||/^0{8}-/.test(id)){throw Error('请提供 Cloudflare 创建数据库后返回的 database_id。');}
const p=JSON.parse(readFileSync('wrangler.json','utf8'));p.d1_databases[0].database_id=id;writeFileSync('wrangler.json',JSON.stringify(p,null,2)+'\n');console.log('数据库 ID 已配置。');
