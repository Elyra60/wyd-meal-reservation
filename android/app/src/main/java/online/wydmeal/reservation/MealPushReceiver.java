package online.wydmeal.reservation;
import android.content.Context;
import cn.jpush.android.service.JPushMessageReceiver;
import cn.jpush.android.api.CustomMessage;
public final class MealPushReceiver extends JPushMessageReceiver {
 @Override public void onRegister(Context c,String registrationId){PushBridge.sync(c,true);}
 @Override public void onConnected(Context c,boolean connected){PushBridge.connected(c,connected);}
 @Override public void onMessage(Context c,CustomMessage message){
  // JPush also invokes this callback directly, outside BroadcastReceiver.onReceive.
  android.content.BroadcastReceiver.PendingResult pending=goAsync();
  java.util.concurrent.atomic.AtomicBoolean done=new java.util.concurrent.atomic.AtomicBoolean();
  Runnable finish=()->{if(pending!=null&&done.compareAndSet(false,true))pending.finish();};
  if(pending!=null)new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(finish,9000);
  PushBridge.receive(c,message.extra,finish);
 }
}
