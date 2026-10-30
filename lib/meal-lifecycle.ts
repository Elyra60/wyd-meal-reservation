export async function settleMeals(db:any,now=new Date().toISOString()){
 // Also releases reservations cancelled under the previous quota policy.
 const result=await db.batch([
  db.prepare("DELETE FROM approvals WHERE booking_id IN (SELECT id FROM bookings WHERE status='cancelled')"),
  db.prepare("UPDATE bookings SET status='completed',completed_at=strftime('%Y-%m-%dT%H:%M:%fZ',meal_at,'+24 hours'),completion_method='auto' WHERE status='approved' AND julianday(meal_at)+1<=julianday(?)").bind(now)
 ]);
 return {completed:Number(result[1]?.meta?.changes??result[1]?.changes??0),overdueRemaining:Number((await db.prepare("SELECT count(*) AS n FROM bookings WHERE status='approved' AND julianday(meal_at)+1<=julianday(?)").bind(now).first()).n)};
}
