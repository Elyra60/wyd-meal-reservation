'use client';
import {useState} from 'react';
import BookingForm from './BookingForm';
import BookingSummary from './BookingSummary';
export default function ManagerTools({data,busy,act,notify}:{data:any;busy:boolean;act:(b:any)=>Promise<boolean>;notify:(s:string)=>void}){const [scope,setScope]=useState('default'),[quotaWeek,setQuotaWeek]=useState(''),[userId,setUserId]=useState(''),[bookingId,setBookingId]=useState(''),[creating,setCreating]=useState('');const user=data.users.find((u:any)=>u.id===userId),booking=data.bookings.find((b:any)=>b.id===bookingId),limits=data.weeklyLimits||[];const submit=(action:string,id?:string)=>async(e:any)=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));if(await act({...f,action,id,...(action==='manageUser'?{disabled:f.disabled==='on'}:{})}))notify('管理设置已保存。');};return <>
 <section className="card manager-users">
  <h2>新增预约与记录</h2>
  <div className="review-actions">
   <button className="primary" onClick={()=>setCreating(creating==='booking'?'':'booking')}>新增预约</button>
   <button className="secondary" onClick={()=>setCreating(creating==='record'?'':'record')}>新增放纵餐记录</button>
  </div>
  {creating&&<BookingForm key={creating} self={creating==='record'} data={data} busy={busy}
   users={data.users.filter((u:any)=>!u.disabled&&u.role!=='manager')}
   onSubmit={async fields=>{
    if(await act({...fields,action:creating==='record'?'manageAddRecord':'manageAddBooking'})){
     setCreating('');notify('已保存用餐安排。');
    }
   }}/>}
 </section>
 <section className="card manager-users">
  <h2>王亦达发起的预约</h2>
  {data.bookings.filter((b:any)=>b.user_id==='wang-yida'&&b.status==='pending').map((b:any)=><article key={b.id} className="booking">
   <BookingSummary booking={b}/>
   <div className="review-actions"><button className="primary" disabled={busy} onClick={async()=>{
    if(await act({action:'approve',id:b.id,revision:b.revision}))notify('已批准预约。');
   }}>批准预约</button></div>
   <form onSubmit={async event=>{
    event.preventDefault();
    if(await act({action:'reject',id:b.id,revision:b.revision,reason:new FormData(event.currentTarget).get('reason')}))notify('已拒绝预约。');
   }}>
    <label>拒绝理由（选填）<input name="reason" maxLength={300}/></label>
    <button className="secondary" disabled={busy}>拒绝预约</button>
   </form>
  </article>)}
  {!data.bookings.some((b:any)=>b.user_id==='wang-yida'&&b.status==='pending')&&<p className="muted">暂无待审批预约。</p>}
 </section>
 <section className="card manager-users"><h2>放纵餐额度</h2><p className="form-note">默认每周2次。指定周设置优先于默认值；0表示暂停预约。下调不得制造或加重超额；自主记录造成负数时，可以逐步增加额度，增加额度不会自动恢复已拒绝记录。</p><form onSubmit={submit('manageQuota')}><div className="form-grid"><label>设置范围<select value={scope} onChange={e=>setScope(e.target.value)}><option value="default">默认每周额度</option><option value="week">指定自然周</option></select></label>{scope==='week'?<label>该周周一日期<input name="week" type="date" value={quotaWeek} onChange={e=>setQuotaWeek(e.target.value)} required/></label>:<input type="hidden" name="week" value="default"/>}<label>允许次数<input key={scope+quotaWeek+JSON.stringify(limits)} name="limit" type="number" min={0} max={100} required defaultValue={limits.find((l:any)=>l.week===(scope==='default'?'default':quotaWeek))?.meal_limit??limits.find((l:any)=>l.week==='default')?.meal_limit??2}/></label></div><button className="primary" disabled={busy}>保存额度</button></form><div className="manager-table"><table><thead><tr><th>范围</th><th>次数</th><th>已占用／使用</th></tr></thead><tbody>{limits.map((l:any)=><tr key={l.week}><td>{l.week==='default'?'默认每周':l.week+' 当周'}</td><td>{l.meal_limit}</td><td>{l.week==='default'?'各周分别计算':data.bookings.filter((b:any)=>b.week===l.week&&['approved','completed'].includes(b.status)).length}</td></tr>)}</tbody></table></div></section>
<section className="card manager-users"><h2>编辑用户与账号状态</h2><p className="form-note">管理员修改用户名不受用户修改周期限制。保存后，该用户需要重新登录。停用仅适用于普通用户。</p><label>选择用户<select value={userId} onChange={e=>setUserId(e.target.value)}><option value="">请选择用户</option>{data.users.map((u:any)=><option value={u.id} key={u.id}>{u.username} · {u.nickname||u.email}</option>)}</select></label>{user?.canEditAccount&&<form key={user.id+user.username+user.email+user.nickname+user.disabled} onSubmit={submit('manageUser',user.id)}><div className="form-grid"><label>用户名<input name="username" defaultValue={user.username} required minLength={3} maxLength={40} pattern="[A-Za-z0-9_]{3,40}"/></label><label>昵称<input name="nickname" defaultValue={user.nickname} maxLength={30}/></label></div><label>邮箱<input name="email" defaultValue={user.email} required type="email" maxLength={254}/></label>{user.role==='user'&&<label className="manager-checkbox"><input name="disabled" type="checkbox" defaultChecked={!!user.disabled}/>停用账号</label>}<button className="primary" disabled={busy}>保存用户信息</button></form>}
 {user&&user.canEditAccount&&user.id!==data.user.id&&<form key={'password-'+user.id} onSubmit={async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const fields=new FormData(form);
  if(fields.get('password')!==fields.get('confirm')){notify('两次输入的密码不一致。');return;}
  if(await act({action:'manageResetPassword',id:user.id,password:fields.get('password')})){
   form.reset();notify('临时密码已设置，该用户下次登录时需修改。');
  }
 }}>
  <h3>密码管理</h3>
  <p className="form-note">{user.must_change?'下次登录须修改密码。':'密码已设置。'} 可为该用户设置临时密码，原有登录会话会退出。</p>
  <div className="form-grid">
   <label>临时密码<input type="password" name="password" minLength={10} maxLength={128} required autoComplete="new-password"/></label>
   <label>确认临时密码<input type="password" name="confirm" minLength={10} maxLength={128} required autoComplete="new-password"/></label>
  </div>
  <button className="secondary" disabled={busy}>重置密码</button>
 </form>}
 {user&&!user.canEditAccount&&<p className="form-note">此账号由主管理员维护。</p>}
 </section>
 {data.user.canGrant&&<section className="card manager-users">
  <h2>绑定管理员权限</h2>
  <p className="form-note">可以为多个普通账号分别开通管理员功能。</p>
  {data.users.filter((u:any)=>u.role==='user'&&(!u.disabled||u.can_manage)).map((u:any)=><div className="review-actions" key={u.id}>
   <span>{u.username}{u.can_manage?' · 已绑定':''}</span>
   <button className="secondary" disabled={busy} onClick={async()=>{
    if(await act({action:'manageGrant',id:u.id,enabled:!u.can_manage}))notify(u.can_manage?'已收回管理员权限。':'已绑定管理员权限。');
   }}>{u.can_manage?'解绑':'绑定'}</button>
  </div>)}
 </section>}
<section className="card manager-users"><h2>编辑预约与放纵餐记录</h2><p className="form-note">改动会通知预约人。已批准预约跨周改期将同步转移名额；已完成记录只能改到过去；普通预约跨周改期不能超额。自主记录允许超额，仅管理员可修改或取消。修改餐厅或地址后，原地图坐标会清除。</p><label>选择预约<select value={bookingId} onChange={e=>setBookingId(e.target.value)}><option value="">请选择预约</option>{data.bookings.map((b:any)=><option key={b.id} value={b.id}>{b.name} · {b.restaurant} · {new Date(b.meal_at).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})}</option>)}</select></label>{booking&&<div key={booking.id}><BookingForm booking={booking} data={data} busy={busy} onSubmit={async fields=>{
  if(await act({...fields,action:'manageBooking'})){setBookingId('');notify('用餐信息已更新。');}
 }}/>{['pending','approved','completed'].includes(booking.status)&&<form className="manager-cancel" onSubmit={submit('manageCancel',booking.id)}><label>取消原因<input name="reason" required maxLength={300} placeholder="填写取消原因后确认"/></label><button className="secondary" disabled={busy}>取消该记录并返还名额</button></form>}</div>}</section>
<section className="card manager-users"><h2>邮件通知投递</h2><p className="form-note">最近100条。发送成功表示邮件服务已接收；收件箱实际送达由邮件服务处理。失败将自动重试，超出重试期限后保留失败记录。</p><div className="manager-table"><table><thead><tr><th>收件人</th><th>状态</th><th>尝试次数</th><th>说明</th></tr></thead><tbody>{(data.mailDeliveries||[]).map((m:any)=><tr key={m.id}><td>{m.recipient}</td><td>{{pending:'等待重试／发送',sending:'发送中',sent:'发送成功',failed:'发送失败',skipped:'无有效邮箱或已停用'}[m.status as string]||m.status}</td><td>{m.attempts}</td><td>{m.last_error||m.sent_at||'—'}</td></tr>)}</tbody></table></div></section><section className="card manager-users"><h2>管理员操作记录</h2><p className="form-note">显示最近300条记录，可展开查看修改前后的内容。</p>{(data.audit||[]).map((l:any)=><details className="manager-audit" key={l.id}><summary>{new Date(l.created).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})} · {{manageQuota:'调整额度',manageUser:'编辑用户',manageBooking:'修改预约',manageCancel:'取消预约',manageGrant:'调整管理员权限',manageResetPassword:'重置密码',manageAddBooking:'新增预约',manageAddRecord:'新增记录'}[l.action as string]||l.action}</summary><p>操作账号：{l.actor} · 目标：{l.target}</p><pre>{JSON.stringify(JSON.parse(l.details),null,2)}</pre></details>)}{!data.audit?.length&&<p className="muted">暂无管理操作</p>}</section></>;}
