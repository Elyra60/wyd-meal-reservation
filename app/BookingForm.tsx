'use client';
import {useState} from 'react';
import {ArrowRight,MapPin} from 'lucide-react';
import RestaurantMap,{type Point} from './RestaurantMap';
import BookingDate from './BookingDate';
import BookingTime from './BookingTime';
import {mealWeek,transportModes} from '../lib/meal-fields';
import {weekRange} from '../lib/week-range';
type BookingProps={
  busy:boolean; defaultName?:string; self?:boolean; data?:any; booking?:any;
  users?:{id:string;username:string;nickname?:string}[];
  onSubmit:(fields:Record<string,any>)=>Promise<void>;
 };
 export default function BookingForm({busy,onSubmit,defaultName='',self=false,data,booking,users}:BookingProps){
 const completed=self||booking?.status==='completed';
 const initial=booking?new Date(Date.parse(booking.meal_at)+28800000).toISOString().slice(0,16):'';
 const [target,setTarget]=useState(users?.find(user=>user.id==='wang-yida')?.id||users?.[0]?.id||'');
 const labelFor=(id:string)=>id==='wang-yida'?'王亦达':users?.find(user=>user.id===id)?.nickname||users?.find(user=>user.id===id)?.username||'';
 const [name,setName]=useState(booking?.name||defaultName||labelFor(target));
 const [selectedDate,setSelectedDate]=useState(initial.slice(0,10)),[requestId]=useState(()=>crypto.randomUUID());
 const selectedWeek=selectedDate?mealWeek(new Date(selectedDate+'T12:00:00+08:00')):'';
 const limit=(data?.weeklyLimits||[]).find((l:any)=>l.week===selectedWeek)?.meal_limit??(data?.weeklyLimits||[]).find((l:any)=>l.week==='default')?.meal_limit??2;
 const occupied=(data?.quotas||[]).find((q:any)=>q.week===selectedWeek)?.count||0,remaining=limit-occupied;
 const [companions,setCompanions]=useState<string[]>(booking?.companions?.split('、')||['']),[partySize,setPartySize]=useState<number>(booking?.party_size??1);
 function updateCompanions(next:string[]){setCompanions(next);if(next.filter(n=>n.trim()).length!==companions.filter(n=>n.trim()).length)setPartySize(1+next.filter(n=>n.trim()).length);}
 const [mealType,setMealType]=useState(booking?.meal_type||'dinner');
 const [showMap,setShowMap]=useState(false);
 const [point,setPoint]=useState<Point|null>(booking?.latitude!=null&&booking?.longitude!=null
  ?{lat:booking.latitude,lng:booking.longitude,system:booking.coordinate_system}:null);
 const [restaurant,setRestaurant]=useState(booking?.restaurant||'');
 const [address,setAddress]=useState(booking?.address||'');
 return <form className="reservation-form" onSubmit={async e=>{e.preventDefault();const fields=Object.fromEntries(new FormData(e.currentTarget));await onSubmit({...fields,requestId,...(booking?{id:booking.id,revision:booking.revision}:{}),companions:companions.map(n=>n.trim()).filter(Boolean).join('、'),mealAt:fields.date+'T'+fields.time,mealType,latitude:point?.lat??null,longitude:point?.lng??null,coordinateSystem:point?.system||'wgs84'});}}>
 {users&&<label>用餐账号<select name="userId" required value={target} onChange={event=>{setTarget(event.target.value);setName(labelFor(event.target.value));}}>
  <option value="" disabled>选择一个账号</option>
  {users.map(user=><option value={user.id} key={user.id}>{user.username}{user.nickname?' · '+user.nickname:''}</option>)}
 </select></label>}
 <section className="form-section"><h3><span>01</span>用餐安排</h3><div className="form-grid"><label>{completed?'用餐人姓名':'预约人姓名'}<input name="name" value={name} onChange={event=>setName(event.target.value)} required maxLength={40} autoComplete="name" placeholder="请输入姓名"/></label><label>用餐人数 <small>（含预约人）</small><select name="partySize" value={partySize} onChange={e=>setPartySize(Number(e.target.value))} required>{Array.from({length:30},(_,i)=><option value={i+1} key={i}>{i+1} 人</option>)}</select></label></div><fieldset className="meal-options"><legend>用餐类型</legend>{[['lunch','午餐'],['dinner','晚餐'],['late','夜宵'],...(booking?[['unspecified','未注明']]:[])].map(([v,label])=><label key={v}><input type="radio" name="mealType" value={v} checked={mealType===v} onChange={()=>setMealType(v)}/><span>{label}</span></label>)}</fieldset><div className="form-grid"><label>用餐日期<BookingDate past={completed} editing={!!booking} initial={initial.slice(0,10)} onDateChange={setSelectedDate}/></label><label>用餐时间<BookingTime initial={initial.slice(11)||undefined}/></label></div>{selectedWeek&&<div className={'week-selection '+(remaining<=0?'quota-warning':'')}><strong>{weekRange(selectedWeek)}</strong><span>该周额度 {limit} 次 · 已占用／使用 {occupied} 次 · 剩余 {remaining} 次</span>{remaining<=0&&!booking&&<p>{self&&!users?'本次记录提交后将出现或增加负额度，并以红色提醒。':'所选周名额已满，请选择其他周。'}</p>}</div>}</section>
 <section className="form-section"><h3><span>02</span>餐厅位置</h3><label>餐厅名称<input name="restaurant" value={restaurant} onChange={e=>{setRestaurant(e.target.value);setPoint(null);}} required maxLength={100} placeholder="餐厅名称及分店"/></label><label>详细地址 <small>（选填）</small><input name="address" value={address} onChange={e=>{setAddress(e.target.value);setPoint(null);}} maxLength={300} placeholder="街道、门牌号等，方便确认位置"/></label><button type="button" className="map-toggle secondary" aria-expanded={showMap} onClick={()=>setShowMap(!showMap)}><MapPin size={18}/>{showMap?'收起地图':point?'调整地图位置':'搜索餐厅并选择位置'}</button>{showMap&&<RestaurantMap point={point} onChange={setPoint} onSelect={p=>{setPoint({lat:p.lat,lng:p.lng,system:p.system,city:p.city});setRestaurant(p.name);setAddress(p.address);}}/>} {!showMap&&point&&<p className="selected-point"><MapPin size={17}/>已保存选点，可展开地图调整</p>}</section>
 <section className="form-section"><h3><span>03</span>同行与补充信息 <small>选填</small></h3><div className="companion-list"><span className="field-title">同行人姓名</span>{companions.map((name,i)=><div className="companion-row" key={i}><input aria-label={'同行人 '+(i+1)+' 姓名'} value={name} maxLength={40} placeholder="填写一位同行人的姓名" onChange={e=>updateCompanions(companions.map((n,j)=>j===i?e.target.value:n))}/><button type="button" className="text-btn" aria-label={'移除同行人 '+(i+1)} onClick={()=>updateCompanions(companions.filter((_,j)=>j!==i))}>移除</button></div>)}<button type="button" className="secondary" disabled={companions.length>=29} onClick={()=>setCompanions([...companions,''])}>＋ 添加同行人</button><p className="form-note">已填写 {companions.filter(n=>n.trim()).length} 位同行人，含预约人共 {1+companions.filter(n=>n.trim()).length} 人。空白行不计入人数，也可在上方调整人数。</p></div><div className="form-grid"><label>交通方式 <small>（选填）</small><select name="transportMode" defaultValue={booking?.transport_mode||""}>{transportModes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>预估人均消费 <small>（元/人，选填）</small><input name="estimatedCost" defaultValue={booking?.estimated_cost_cents==null?"":(booking.estimated_cost_cents/100).toFixed(2)} type="number" min="0" max="100000" step="0.01" inputMode="decimal" placeholder="例如 128.00"/></label></div><label>联系方式<input name="contact" defaultValue={booking?.contact||""} maxLength={120} autoComplete="tel" placeholder="手机号、微信等"/></label><label>备注<textarea name="notes" defaultValue={booking?.notes||""} maxLength={1000} rows={3} placeholder="忌口、集合安排或其他想说明的事项"/></label></section>
 {completed&&<section className="form-section"><h3><span>04</span>本次摄入热量</h3><label>王亦达摄入热量（千卡）<input name="calories" type="number" inputMode="numeric" defaultValue={booking?.calories??""} required={!booking||booking.calories!=null} min={1} max={100000} step={1} placeholder="例如 1200"/></label>{!booking&&<p className="form-note">提交后扣除用餐日期所在周的 1 次额度。</p>}{self&&!users&&<label className="record-confirm"><input type="checkbox" required/>我已核对记录，确认提交后仅管理员可修改或取消。</label>}</section>}<div className="form-submit"><p className="form-note">北京时间 · 每周次数由管理员设置。已批准的预约先占用名额，取消后返还。</p><button className="primary wide" disabled={busy||(!booking&&(!self||!!users)&&!!selectedWeek&&remaining<=0)}>{busy?'提交中…':booking?'保存修改':self?'提交放纵餐记录':'提交预约'}<ArrowRight size={18}/></button></div>
 </form>;
}
