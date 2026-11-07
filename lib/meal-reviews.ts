import {calories} from './meal-fields';

type Reviewer = {id:string; role:string};
type ReviewInput = Record<string,unknown>;

export async function settleReviews(db:D1Database, now=Date.now()){
 await db.prepare(`UPDATE meal_reviews
 SET result=CASE WHEN
  (SELECT count(*) FROM meal_review_votes WHERE review_id=meal_reviews.id AND choice='yes') >
  (SELECT count(*) FROM meal_review_votes WHERE review_id=meal_reviews.id AND choice='no')
  THEN 'allowed' ELSE 'denied' END
 WHERE result='open' AND deadline<=?`).bind(now).run();
}

export async function listReviews(db:D1Database, userId:string){
 const [reviews, comments]=await db.batch<Record<string,unknown>>([
  db.prepare(`SELECT r.*,
   (SELECT count(*) FROM meal_review_votes WHERE review_id=r.id AND choice='yes') AS yes,
   (SELECT count(*) FROM meal_review_votes WHERE review_id=r.id AND choice='no') AS no,
   (SELECT choice FROM meal_review_votes WHERE review_id=r.id AND user_id=?) AS myVote
   FROM meal_reviews r ORDER BY r.result='open' DESC,r.created DESC,r.id`).bind(userId),
  db.prepare(`SELECT c.id,c.review_id,c.body,c.created,COALESCE(NULLIF(u.nickname,''),u.username) AS author
   FROM meal_review_comments c JOIN users u ON u.id=c.user_id ORDER BY c.id`),
 ]);
 const threads=new Map<unknown,typeof comments.results>();
 for(const comment of comments.results){
  const thread=threads.get(comment.review_id)??[];
  thread.push(comment);
  threads.set(comment.review_id,thread);
 }
 return reviews.results.map(review=>({...review,comments:threads.get(review.id)??[]}));
}

export async function reviewAction(db:D1Database, user:Reviewer, action:string, input:ReviewInput, now=Date.now()){
 const id=String(input.id??'');
 if(action==='reviewCreate'){
  if(user.id!=='wang-yida'||user.role!=='admin')return 403;
  const food=String(input.food??'').trim();
  if(!food||food.length>100)throw new Error('请填写 1–100 字的食物名称。');
  const local=String(input.deadline??'');
  const deadline=Date.parse(local+'+08:00');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)||!Number.isFinite(deadline)||
     new Date(deadline+28800000).toISOString().slice(0,16)!==local||deadline<=now)
   throw new Error('请选择有效的未来截止时间（北京时间）。');
  await db.prepare('INSERT INTO meal_reviews(id,requester_id,food,calories,deadline,created) VALUES(?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),user.id,food,calories(input.calories),deadline,new Date(now).toISOString()).run();
  return 200;
 }
 if(action==='reviewVote'){
  if(user.id==='wang-yida')return 403;
  const choice=input.choice;
  if(choice!=='yes'&&choice!=='no')throw new Error('请选择同意或反对。');
  const voted=await db.prepare(`INSERT INTO meal_review_votes(review_id,user_id,choice)
   SELECT id,?,? FROM meal_reviews WHERE id=? AND result='open'
    AND deadline>MAX(?,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))
   ON CONFLICT(review_id,user_id) DO NOTHING RETURNING choice`).bind(user.id,choice,id,now).first();
  if(!voted)throw new Error('投票已截止，或你已投过票。');
  return 200;
 }
 if(action==='reviewComment'){
  if(user.role!=='user')return 403;
  const body=String(input.body??'').trim();
  if(!body||body.length>500)throw new Error('请填写 1–500 字的留言。');
  const posted=await db.prepare(`INSERT INTO meal_review_comments(review_id,user_id,body,created)
   SELECT review_id,user_id,?,? FROM meal_review_votes WHERE review_id=? AND user_id=? RETURNING id`)
   .bind(body,new Date(now).toISOString(),id,user.id).first();
  if(!posted)throw new Error('请先投票，再发表留言。');
  return 200;
 }
 return 400;
}
