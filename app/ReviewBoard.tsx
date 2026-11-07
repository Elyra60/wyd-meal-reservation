'use client';
import {useEffect,useState} from 'react';
import {Clock,Flame,MessageSquare,Plus,ThumbsDown,ThumbsUp} from 'lucide-react';

type ReviewAction=(body:Record<string,unknown>)=>Promise<boolean>;
type Review = {
 id:string; food:string; calories:number; deadline:number; result:'open'|'allowed'|'denied';
 yes:number; no:number; myVote:'yes'|'no'|null;
 comments:{id:number;author:string;avatarUrl?:string|null;body:string;created:string}[];
};

function remaining(deadline:number, now:number){
 const seconds=Math.max(0,Math.ceil((deadline-now)/1000));
 const hours=Math.floor(seconds/3600);
 return [hours,Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
}

function ReviewForm({review,busy,act,onDone}:{
 review?:Review;busy:boolean;act:ReviewAction;onDone:()=>void;
}){
 const deadline=review?new Date(review.deadline+28800000).toISOString().slice(0,16):'';
 return <form className="review-form" onSubmit={async event=>{
  event.preventDefault();
  const fields=Object.fromEntries(new FormData(event.currentTarget));
  if(await act({...fields,action:review?'reviewEdit':'reviewCreate',id:review?.id}))onDone();
 }}>
  <label>食物名称<input name="food" defaultValue={review?.food} required maxLength={100}/></label>
  <div className="review-form-fields">
   <label>热量（千卡）<input name="calories" defaultValue={review?.calories} type="number" min={1} max={100000} step={1} required/></label>
   <label>截止时间（北京时间）<input name="deadline" defaultValue={deadline} type="datetime-local" required/></label>
  </div>
  {review&&review.result!=='open'&&<p className="form-note">把截止时间改到未来会恢复投票，已有投票与留言会保留。</p>}
  <div className="review-actions">
   <button className="primary" disabled={busy}>{review?'保存评审':'提交评审'}</button>
   <button className="secondary" type="button" onClick={onDone}>取消</button>
  </div>
 </form>;
}

function CommentAvatar({comment}:{comment:Review['comments'][number]}){
 const [failed,setFailed]=useState(false);
 return <span className="avatar review-avatar" aria-hidden="true">
  {comment.avatarUrl&&!failed
   ?<img src={comment.avatarUrl} alt="" loading="lazy" onError={()=>setFailed(true)}/>
   :Array.from(comment.author)[0]||'用'}
 </span>;
}

export default function ReviewBoard({reviews=[],user,busy,act}:{
 reviews:Review[];user:{id:string;role:string;canManage?:boolean};busy:boolean;act:ReviewAction
}){
 const [now,setNow]=useState(Date.now());
 const [editor,setEditor]=useState<string|null>(null);
 useEffect(()=>{
  const timer=setInterval(()=>setNow(Date.now()),1000);
  return()=>clearInterval(timer);
 },[]);
 const isWang=user.id==='wang-yida';
 const manager=user.role==='manager'||user.canManage===true;
 return <div className="review-board">
  {(isWang||manager)&&<div className="review-toolbar">
   <button className="primary" type="button" onClick={()=>setEditor('new')} disabled={busy}><Plus size={17}/>{manager?'新增评审':'发起评审申请'}</button>
  </div>}
  {editor==='new'&&(isWang||manager)&&<section className="card review-card review-create">
   <h2>{manager?'为王亦达新增评审':'申请想吃的食物'}</h2>
   <ReviewForm busy={busy} act={act} onDone={()=>setEditor(null)}/>
  </section>}
  {reviews.map(review=>{
   const open=review.result==='open'&&review.deadline>now;
   const result=review.result;
   const status=result==='open'?'pending':result==='allowed'?'approved':'rejected';
   return <article className={'card review-card review-'+status} key={review.id}>
    <header className="review-heading">
     <span className={'status '+status}><i/>{open?'投票中':result==='open'?'正在结算':result==='allowed'?'可以吃':'不可以吃'}</span>
     <h2>{review.food}</h2>
    </header>
    <div className="review-metrics">
     <div><small><Flame size={16}/>预计热量</small><strong>{review.calories.toLocaleString('zh-CN')} <span>千卡</span></strong></div>
     <div><small><Clock size={16}/>{open?'剩余时间':'投票时间'}</small><strong>{open?remaining(review.deadline,now):'已截止'}</strong></div>
    </div>
    <p className="form-note review-deadline">截止于 {new Date(review.deadline).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）</p>
    <div className="review-votes">
     <span className="review-yes"><ThumbsUp size={16}/>同意 <strong>{review.yes}</strong> 票</span>
     <span className="review-no"><ThumbsDown size={16}/>反对 <strong>{review.no}</strong> 票</span>
    </div>
    {review.myVote&&<p className="form-note">你已投{review.myVote==='yes'?'同意':'反对'}票</p>}
    {open&&!isWang&&!review.myVote&&<div className="review-actions">
     <button className="primary compact" disabled={busy} onClick={()=>act({action:'reviewVote',id:review.id,choice:'yes'})}><ThumbsUp size={16}/>同意</button>
     <button className="secondary" disabled={busy} onClick={()=>act({action:'reviewVote',id:review.id,choice:'no'})}><ThumbsDown size={16}/>反对</button>
    </div>}
    {manager&&<div className="review-management">
     <div className="review-actions">
      <button className="secondary" disabled={busy} onClick={()=>setEditor(review.id)}>修改评审</button>
      <button className="secondary review-delete" disabled={busy} onClick={async()=>{
       if(window.confirm('删除这条评审？该评审的投票与留言也会删除。')){
        if(await act({action:'reviewDelete',id:review.id}))setEditor(null);
       }
      }}>删除评审</button>
     </div>
     {editor===review.id&&<ReviewForm key={review.id} review={review} busy={busy} act={act} onDone={()=>setEditor(null)}/>}
    </div>}
    <section className="review-comments">
     <h3><MessageSquare size={16}/>公开留言 <span>{review.comments.length}</span></h3>
     {review.comments.length===0&&<p className="form-note">还没有留言。</p>}
     {review.comments.map(comment=><article className="review-comment" key={comment.id}>
      <CommentAvatar comment={comment} key={comment.avatarUrl||'initial'}/>
      <div><strong>{comment.author}</strong><p>{comment.body}</p></div>
     </article>)}
     {user.role==='user'&&review.myVote&&<form onSubmit={async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const body=new FormData(form).get('body');
      if(await act({action:'reviewComment',id:review.id,body}))form.reset();
     }}>
      <label>写留言<textarea name="body" required maxLength={500} rows={2}/></label>
      <button className="secondary" disabled={busy}>发布留言</button>
     </form>}
    </section>
   </article>;
  })}
  {!reviews.length&&<section className="card empty"><h3>暂无大众评审申请</h3><p>王亦达发起申请后，大家就可以投票。</p></section>}
 </div>;
}
