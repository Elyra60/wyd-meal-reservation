type Part={path:string;bytes:number};
export function downloadRange(header:string|null,size:number):[number,number]|null{
 if(!header)return [0,size-1];const m=/^bytes=(\d*)-(\d*)$/.exec(header);if(!m||(!m[1]&&!m[2]))return null;
 if(!m[1]){const suffix=Number(m[2]);return suffix>0?[Math.max(0,size-suffix),size-1]:null;}
 const start=Number(m[1]),end=m[2]?Math.min(size-1,Number(m[2])):size-1;return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start<size&&end>=start?[start,end]:null;
}
export async function androidDownload(request:Request,assets:Fetcher,ctx?:ExecutionContext):Promise<Response|null>{
 const url=new URL(request.url);const match=/^\/downloads\/wyd-meal-reservation-(\d+\.\d+\.\d+)-native\.apk$/.exec(url.pathname);if(!match)return null;
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
 const meta=await assets.fetch(new Request(new URL('/android/releases/'+match[1]+'.json',url.origin)));if(!meta.ok)return new Response('版本不存在',{status:404});
 const release=await meta.json() as {bytes:number;sha256:string;parts:Part[]};
 if(!Number.isSafeInteger(release.bytes)||release.bytes<=0||!Array.isArray(release.parts)||release.parts.length>10||!release.parts.every(p=>/^\/android-packages\/\d+\.\d+\.\d+\/part-\d+\.bin$/.test(p.path)&&Number.isSafeInteger(p.bytes)&&p.bytes>0)||release.parts.reduce((n,p)=>n+p.bytes,0)!==release.bytes)return new Response('版本信息无效',{status:503});
 const range=downloadRange(request.headers.get('Range'),release.bytes);if(!range)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+release.bytes}});
 const [start,end]=range;const partial=!!request.headers.get('Range');const headers:Record<string,string>={'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="wyd-meal-reservation-'+match[1]+'-native.apk"','Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Cache-Control':'public, max-age=31536000, immutable','ETag':'"'+release.sha256+'"','X-Content-Type-Options':'nosniff'};
 if(partial)headers['Content-Range']=`bytes ${start}-${end}/${release.bytes}`;
 if(request.method==='HEAD')return new Response(null,{status:partial?206:200,headers});
 let partIndex=0,offset=0,remaining=end-start+1;while(offset+release.parts[partIndex].bytes<=start){offset+=release.parts[partIndex++].bytes;}
 let cursor=start,reader:ReadableStreamDefaultReader<Uint8Array>|null=null,skip=0,partRemaining=0;
 const finishPart=async()=>{if(reader){await reader.cancel();reader.releaseLock();reader=null;}offset+=release.parts[partIndex++].bytes;};
 const stream=new ReadableStream<Uint8Array>({async pull(controller){try{
  while(remaining>0){if(!reader){const part=release.parts[partIndex];const localStart=cursor-offset,localEnd=Math.min(part.bytes-1,localStart+remaining-1);const response=await assets.fetch(new Request(new URL(part.path,url.origin),{headers:{Range:`bytes=${localStart}-${localEnd}`}}));if(![200,206].includes(response.status)||!response.body)throw Error('APK part unavailable');skip=response.status===200?localStart:0;partRemaining=localEnd-localStart+1;reader=response.body.getReader();}
   const chunk=await reader.read();if(chunk.done)throw Error('APK part truncated');let value=chunk.value;if(skip){const ignored=Math.min(skip,value.byteLength);skip-=ignored;value=value.subarray(ignored);if(!value.byteLength)continue;}
   const count=Math.min(value.byteLength,partRemaining,remaining);remaining-=count;partRemaining-=count;cursor+=count;controller.enqueue(value.subarray(0,count));if(partRemaining===0)await finishPart();return;
  }controller.close();}catch(error){controller.error(error);if(reader)await reader.cancel().catch(()=>{});}},async cancel(){if(reader)await reader.cancel();}});
 if(ctx&&typeof FixedLengthStream!=='undefined'){const fixed=new FixedLengthStream(end-start+1);ctx.waitUntil(stream.pipeTo(fixed.writable).catch(()=>console.error('android_download_stream_failed')));return new Response(fixed.readable,{status:partial?206:200,headers});}
 return new Response(stream,{status:partial?206:200,headers});
}
