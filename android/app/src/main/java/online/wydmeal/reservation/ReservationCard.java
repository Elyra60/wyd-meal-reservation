package online.wydmeal.reservation;
import android.graphics.Color;
import android.view.Gravity;
import android.widget.*;
import org.json.JSONObject;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Readable, fully measured native reservation summary, shared by list and detail. */
public final class ReservationCard {
 private static String s(JSONObject b,String key){return b.isNull(key)?"":b.optString(key,"");}
 private static String fallback(String value){return value.isEmpty()?"未填写":value;}
 private static String meal(JSONObject b){String v=s(b,"meal_type");return "lunch".equals(v)?"午餐":"dinner".equals(v)?"晚餐":"late".equals(v)?"夜宵":"未注明餐次";}
 private static void field(NativeUi ui,LinearLayout p,String label,String value,boolean emphasis){p.addView(ui.text(label,13,ui.muted,true));ui.gap(p,6);TextView t=ui.text(fallback(value),emphasis?19:16,emphasis?ui.primary:ui.text,true);p.addView(t,new LinearLayout.LayoutParams(-1,-2));}
 private static void pair(NativeUi ui,LinearLayout p,String l1,String v1,String l2,String v2){LinearLayout row=ui.row();row.setGravity(Gravity.TOP);row.setBaselineAligned(false);LinearLayout left=ui.column(),right=ui.column();LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-2,1);lp.rightMargin=ui.dp(12);row.addView(left,lp);row.addView(right,new LinearLayout.LayoutParams(0,-2,1));field(ui,left,l1,v1,false);field(ui,right,l2,v2,false);p.addView(row,new LinearLayout.LayoutParams(-1,-2));ui.gap(p,18);}
 public static LinearLayout render(NativeUi ui,LinearLayout parent,JSONObject b){
  LinearLayout card=ui.card(parent);String status=s(b,"status");boolean complete="completed".equals(status);String label=complete?("self".equals(s(b,"source"))?"自主记录 · 已完成":"预约用餐 · 已完成"):"approved".equals(status)?"已批准":"pending".equals(status)?"等待审批":"cancelled".equals(status)?"已取消":"已拒绝";
  int statusColor="rejected".equals(status)?ui.error:"pending".equals(status)?Color.parseColor(ui.dark?"#F0D079":"#806018"):ui.primary;
  TextView chip=ui.text(label,13,statusColor,true);chip.setPadding(ui.dp(12),ui.dp(7),ui.dp(12),ui.dp(7));chip.setBackground(ui.shape(ui.tonal,20));card.addView(chip,new LinearLayout.LayoutParams(-2,-2));ui.gap(card,16);
  card.addView(ui.text(fallback(s(b,"restaurant")),24,ui.text,true));ui.gap(card,14);
  if(complete){card.addView(ui.text("王亦达本次摄入",13,ui.muted,true));ui.gap(card,6);card.addView(ui.text(b.isNull("calories")?"热量待补填":String.format(Locale.CHINA,"%,d 千卡",b.optLong("calories")),30,b.isNull("calories")?ui.error:ui.primary,true));ui.gap(card,16);}
  LinearLayout schedule=ui.column();schedule.setPadding(ui.dp(16),ui.dp(16),ui.dp(16),ui.dp(16));schedule.setBackground(ui.shape(ui.tonal,20));String date=s(b,"meal_at"),time="";try{ZonedDateTime dt=Instant.parse(date).atZone(ZoneId.of("Asia/Shanghai"));date=dt.format(DateTimeFormatter.ofPattern("yyyy年M月d日 EEEE",Locale.CHINA));time=dt.format(DateTimeFormatter.ofPattern("HH:mm"));}catch(Exception ignored){}
  schedule.addView(ui.text("用餐日期 · 北京时间",12,ui.muted,true));ui.gap(schedule,6);schedule.addView(ui.text(date,18,ui.text,true));ui.gap(schedule,12);schedule.addView(ui.text(time+" · "+meal(b)+" · "+b.optInt("party_size",1)+" 人",23,ui.primary,true));card.addView(schedule,new LinearLayout.LayoutParams(-1,-2));ui.gap(card,20);
  pair(ui,card,"预约人",s(b,"name"),"同行人",s(b,"companions"));
  pair(ui,card,"交通方式",BookingLabels.transport(s(b,"transport_mode")),"预估人均消费",b.isNull("estimated_cost_cents")?"未填写":"¥"+BookingLabels.amount(b.optLong("estimated_cost_cents"))+" / 人");
  field(ui,card,"联系方式",s(b,"contact"),false);ui.gap(card,18);field(ui,card,"餐厅地址",s(b,"address"),false);ui.gap(card,18);
  LinearLayout note=ui.column();note.setPadding(ui.dp(14),ui.dp(14),ui.dp(14),ui.dp(14));note.setBackground(ui.shape(ui.bg,16));field(ui,note,"备注",s(b,"notes").isEmpty()?"无备注":s(b,"notes"),false);card.addView(note,new LinearLayout.LayoutParams(-1,-2));
  if("rejected".equals(status)){ui.gap(card,16);card.addView(ui.text("拒绝理由",13,ui.error,true));ui.gap(card,6);card.addView(ui.text(s(b,"reason").isEmpty()?"未填写理由":s(b,"reason"),16,ui.error,false));}
  ui.gap(card,16);card.addView(ui.text("approved".equals(status)?"已预留1次名额 · 取消后返还原预约周":"completed".equals(status)?"已使用1次额度 · "+s(b,"week")+" 当周":s(b,"week")+" 当周",13,ui.muted,false));
  return card;
 }
}
