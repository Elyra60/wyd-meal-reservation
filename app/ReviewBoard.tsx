'use client';
import {useEffect,useState} from 'react';
import {Clock,ThumbsDown,ThumbsUp} from 'lucide-react';

type Review = {
 id:string; food:string; calories:number; deadline:number; result:'open'|'allowed'|'denied';
 yes:number; no:number; myVote:'yes'|'no'|null;
 comments:{id:number;author:string;body:string;created:string}[];
};

function remaining(deadline:number, now:number){
 const seconds=Math.max(0,Math.ceil((deadline-now)/1000));
 const hours=Math.floor(seconds/3600);
 return [hours,Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
}

export default function ReviewBoard({reviews=[],user,busy,act}:{
 reviews:Review[];user:{id:string;role:string};busy:boolean;act:(body:Record<string,unknown>)=>Promise<boolean>
}){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{
  const timer=setInterval(()=>setNow(Date.now()),1000);
  return()=>clearInterval(timer);
 },[]);
 const isWang=user.id==='wang-yida';
 return <div className="settings-stack">
  {isWang&&<section className="card settings">
   <h2>申请想吃的食物</h2>
   <form onSubmit={async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    if(await act({action:'reviewCreate',...Object.fromEntries(new FormData(form))}))form.reset();
   }}>
    <label>食物名称<input name="food" required maxLength={100}/></label>
    <div className="form-grid">
     <label>热量（千卡）<input name="calories" type="number" min={1} max={100000} step={1} required/></label>
     <label>截止时间（北京时间）<input name="deadline" type="datetime-local" required/></label>
    </div>
    <button className="primary" disabled={busy}>发起评审</button>
   </form>
  </section>}
  {reviews.map(review=>{
   const open=review.result==='open'&&review.deadline>now;
   const result=review.result;
   return <section className="card review-card" key={review.id}>
    <div className="section-heading">
     <div><h2>{review.food}</h2><p className="form-note">{review.calories} 千卡</p></div>
     <span className={'status '+(result==='open'?'pending':result==='allowed'?'approved':'rejected')}>
      {open?'投票中':result==='open'?'正在结算':result==='allowed'?'可以吃':'不可以吃'}
     </span>
    </div>
    <p className="review-countdown"><Clock size={17}/>{open?remaining(review.deadline,now):'已截止'}</p>
    <p className="form-note">截止于 {new Date(review.deadline).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）</p>
    <div className="review-votes"><span>同意 {review.yes} 票</span><span>反对 {review.no} 票</span></div>
    {review.myVote&&<p className="form-note">你已投{review.myVote==='yes'?'同意':'反对'}票</p>}
    {open&&!isWang&&!review.myVote&&<div className="review-actions">
     <button className="primary compact" disabled={busy} onClick={()=>act({action:'reviewVote',id:review.id,choice:'yes'})}><ThumbsUp size={16}/>同意</button>
     <button className="secondary" disabled={busy} onClick={()=>act({action:'reviewVote',id:review.id,choice:'no'})}><ThumbsDown size={16}/>反对</button>
    </div>}
    <div className="review-comments">
     <h3>公开留言</h3>
     {review.comments.length===0&&<p className="form-note">还没有留言。</p>}
     {review.comments.map(comment=><article key={comment.id}><strong>{comment.author}</strong><p>{comment.body}</p></article>)}
     {user.role==='user'&&review.myVote&&<form onSubmit={async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const body=new FormData(form).get('body');
      if(await act({action:'reviewComment',id:review.id,body}))form.reset();
     }}>
      <label>写留言<textarea name="body" required maxLength={500} rows={2}/></label>
      <button className="secondary" disabled={busy}>发布留言</button>
     </form>}
    </div>
   </section>;
  })}
  {!reviews.length&&<section className="card empty"><h3>暂无大众评审申请</h3><p>王亦达发起申请后，大家就可以投票。</p></section>}
 </div>;
}
