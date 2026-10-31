export const mealWeek=(date=new Date())=>{
 const d=new Date(date.getTime()+8*3600000);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);
};
export function calories(value:unknown){
 const n=Number(value);
 if(value==null||String(value).trim()===''||!Number.isInteger(n)||n<1||n>100000)throw new Error('请填写本次王亦达摄入的热量（1–100000 千卡的整数）。');
 return n;
}
export function mealFields(b:Record<string,unknown>,mode:'booking'|'self'|'edit',now=Date.now()){
 const text=(k:string,max:number,required=false)=>{const s=String(b[k]??'').trim();if(s.length>max||(required&&!s))throw new Error('请完整填写姓名、餐厅，并检查补充信息长度。');return s;};
 const name=text('name',40,true),restaurant=text('restaurant',100,true),mealAt=String(b.mealAt||'');
 const dt=new Date(mealAt+'+08:00');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(mealAt)||!Number.isFinite(dt.getTime())||new Date(dt.getTime()+28800000).toISOString().slice(0,16)!==mealAt)throw new Error('请选择有效的用餐日期和时间。');
 if(mode==='booking'&&(dt.getTime()<=now||dt.getTime()>now+366*86400000))throw new Error('请选择未来一年内的用餐时间。');
 if(mode==='self'&&dt.getTime()>now)throw new Error('自主记录只能填写已经发生的用餐。');
 const mealType=String(b.mealType||'dinner'),partySize=Number(b.partySize??2);
 if(!['lunch','dinner','late',...(mode==='edit'?['unspecified']:[])].includes(mealType))throw new Error('请选择午餐、晚餐或夜宵。');
 if(!Number.isInteger(partySize)||partySize<1||partySize>30)throw new Error('用餐人数须为1至30人的整数。');
 const latitude=b.latitude==null||b.latitude===''?null:Number(b.latitude),longitude=b.longitude==null||b.longitude===''?null:Number(b.longitude);
 const coordinateSystem=String(b.coordinateSystem||'wgs84');
 if(!['wgs84','gcj02'].includes(coordinateSystem)||(latitude===null)!==(longitude===null)||(latitude!==null&&(!Number.isFinite(latitude)||Math.abs(latitude)>85.05112878))||(longitude!==null&&(!Number.isFinite(longitude)||Math.abs(longitude)>180)))throw new Error('餐厅位置无效，请重新在地图选点。');
 return {name,restaurant,mealAt:dt.toISOString(),week:mealWeek(dt),mealType,partySize,companions:text('companions',1500),contact:text('contact',120),notes:text('notes',1000),address:text('address',300),latitude,longitude,coordinateSystem};
}
