package online.wydmeal.reservation;
import android.app.job.*;
import android.content.SharedPreferences;
import org.json.*;
public final class NoticeJobService extends JobService {
 private Thread task;
 @Override public boolean onStartJob(JobParameters params){task=new Thread(()->{boolean retry=false;try{SharedPreferences p=getSharedPreferences("system_notices",0);String user=p.getString("active","");if(!user.isEmpty()&&NoticeNotifier.allowed(this)){PushBridge.sync(this,false);ApiClient api=new ApiClient(this);long cursor=p.getLong("cursor:"+user,0);for(int page=0;page<3&&!Thread.currentThread().isInterrupted();page++){JSONObject data=api.json("/api/mobile-notices?after="+cursor,null);if(!user.equals(data.optString("userId")))break;JSONArray notices=data.optJSONArray("notices");cursor=data.optLong("nextCursor",cursor);if(notices!=null)NoticeNotifier.deliver(this,user,notices,cursor);if(!data.optBoolean("hasMore"))break;}}}catch(ApiClient.SessionExpired expired){getSharedPreferences("system_notices",0).edit().putString("active","").apply();NoticeNotifier.schedule(this);}catch(Exception error){retry=true;}if(!Thread.currentThread().isInterrupted())jobFinished(params,retry);},"meal-notice-check");task.start();return true;}
 @Override public boolean onStopJob(JobParameters params){if(task!=null)task.interrupt();return true;}
}
