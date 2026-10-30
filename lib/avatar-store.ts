// Small avatars are kept in D1; no R2 subscription is needed.
export function avatarStore(db:any){return {
 async put(key:string,bytes:Uint8Array,options:any){let binary='';for(let i=0;i<bytes.length;i+=4096)binary+=String.fromCharCode(...bytes.subarray(i,i+4096));const value=btoa(binary);await db.prepare('INSERT INTO avatars(key,data,content_type) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,content_type=excluded.content_type').bind(key,value,options.httpMetadata.contentType).run();},
 async get(key:string){const r=await db.prepare('SELECT data,content_type FROM avatars WHERE key=?').bind(key).first();return r?{body:Uint8Array.from(atob(r.data),c=>c.charCodeAt(0)),httpMetadata:{contentType:r.content_type}}:null;},
 async delete(key:string){await db.prepare('DELETE FROM avatars WHERE key=?').bind(key).run();}
};}
