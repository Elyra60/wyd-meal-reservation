package online.wydmeal.reservation;
import android.Manifest;
import android.app.*;
import android.app.job.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.widget.*;
import org.json.*;
import java.util.*;

public final class NoticeNotifier {
 private static final String CHANNEL="meal_updates",PREFS="system_notices";private static final int JOB=220001;
 public static boolean allowed(Context c){return c.getSharedPreferences(PREFS,0).getBoolean("enabled",true)&&(Build.VERSION.SDK_INT<33||c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)&&c.getSystemService(NotificationManager.class).areNotificationsEnabled();}
 public static void schedule(Context c){JobScheduler jobs=c.getSystemService(JobScheduler.class);if(!allowed(c)||c.getSharedPreferences(PREFS,0).getString("active","").isEmpty()){jobs.cancel(JOB);return;}if(jobs.getPendingJob(JOB)!=null)return;JobInfo job=new JobInfo.Builder(JOB,new ComponentName(c,NoticeJobService.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15*60*1000L).setPersisted(true).build();jobs.schedule(job);}
 public static synchronized void accept(Context context,JSONObject state){JSONObject user=state.optJSONObject("user");SharedPreferences prefs=context.getSharedPreferences(PREFS,0);String previous=prefs.getString("active","");String id=user==null?"":user.optString("id");if(user!=null&&(user.optBoolean("mustBindEmail")||user.optBoolean("mustChange")))id="";
  if(!previous.equals(id)){context.getSystemService(NotificationManager.class).cancelAll();prefs.edit().putString("active",id).apply();}if(id.isEmpty()){schedule(context);return;}
  JSONArray notices=state.optJSONArray("notices");if(notices==null)notices=new JSONArray();long latest=0;for(int i=0;i<notices.length();i++){JSONObject n=notices.optJSONObject(i);if(id.equals(n.optString("user_id")))latest=Math.max(latest,n.optLong("id"));}
  String cursor="cursor:"+id;if(!prefs.contains(cursor)){prefs.edit().putLong(cursor,latest).apply();}else deliver(context,id,notices,latest);
  schedule(context);
 }
 public static synchronized void deliver(Context c,String userId,JSONArray notices,long latest){SharedPreferences prefs=c.getSharedPreferences(PREFS,0);if(!userId.equals(prefs.getString("active","")))return;long cursor=prefs.getLong("cursor:"+userId,0);ArrayList<JSONObject> fresh=new ArrayList<>();for(int i=0;i<notices.length();i++){JSONObject n=notices.optJSONObject(i);if(userId.equals(n.optString("user_id"))&&n.optLong("id")>cursor&&n.optInt("read")==0)fresh.add(n);}fresh.sort((a,b)->Long.compare(a.optLong("id"),b.optLong("id")));
  if(allowed(c)&&!fresh.isEmpty()){NotificationManager manager=c.getSystemService(NotificationManager.class);NotificationChannel channel=new NotificationChannel(CHANNEL,"预约与用餐动态",NotificationManager.IMPORTANCE_DEFAULT);channel.setDescription("新的邀请、审批结果、取消与用餐提醒");manager.createNotificationChannel(channel);int start=Math.max(0,fresh.size()-5);for(int i=start;i<fresh.size();i++){JSONObject n=fresh.get(i);String message=n.optString("message");Intent intent=new Intent(c,MainActivity.class).putExtra("destination","messages").addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);PendingIntent open=PendingIntent.getActivity(c,(int)(n.optLong("id")&0x7fffffff),intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Notification publicView=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle("王亦达放纵餐预约").setContentText("你收到一条新消息").build();Notification notification=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle("新的预约动态").setContentText(message.split("\n",2)[0]).setStyle(new Notification.BigTextStyle().bigText(message)).setAutoCancel(true).setContentIntent(open).setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(publicView).setGroup("meal_notices").build();try{manager.notify("notice:"+userId+":"+n.optLong("id"),(int)(n.optLong("id")&0x7fffffff),notification);}catch(SecurityException ignored){}}
   if(fresh.size()>5){Intent intent=new Intent(c,MainActivity.class).putExtra("destination","messages");manager.notify(220002,new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle("收到 "+fresh.size()+" 条新消息").setContentText("打开应用查看全部预约动态").setContentIntent(PendingIntent.getActivity(c,220002,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE)).setGroup("meal_notices").setGroupSummary(true).setAutoCancel(true).build());}}
  prefs.edit().putLong("cursor:"+userId,Math.max(cursor,latest)).apply();
 }
 public static void ask(Activity a){SharedPreferences p=a.getSharedPreferences(PREFS,0);if(Build.VERSION.SDK_INT>=33&&!p.getBoolean("asked",false)&&!p.getString("active","").isEmpty()){p.edit().putBoolean("asked",true).apply();a.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},301);}}
 public static void settings(Activity a,LinearLayout parent,NativeUi ui){ui.title(parent,"系统通知","预约动态会显示到系统通知栏。");Switch toggle=new Switch(a);toggle.setText("接收系统通知");toggle.setTextColor(ui.text);toggle.setTextSize(16);toggle.setPadding(0,ui.dp(18),0,ui.dp(18));toggle.setChecked(a.getSharedPreferences(PREFS,0).getBoolean("enabled",true));toggle.setOnCheckedChangeListener((b,checked)->{a.getSharedPreferences(PREFS,0).edit().putBoolean("enabled",checked).apply();if(checked&&Build.VERSION.SDK_INT>=33)a.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},301);schedule(a);});parent.addView(toggle);parent.addView(ui.body(allowed(a)?"系统通知已开启":"系统通知尚未获准，请在系统设置中允许通知。"));ui.fullButton(parent,"打开系统通知设置",false,()->a.startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,a.getPackageName())));ui.gap(parent,18);parent.addView(ui.body("应用打开时约每30秒检查新消息。应用关闭后，系统最短按15分钟安排后台检查，省电模式或厂商后台限制可能延迟。此版本暂未接入即时推送服务。"));}
}
