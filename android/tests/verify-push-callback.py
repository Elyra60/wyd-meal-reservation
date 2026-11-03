"""Exercise the shipped receiver with both SDK direct and Android broadcast dispatch."""
from pathlib import Path
import subprocess, shutil, tempfile
root=Path(__file__).resolve().parent.parent
java=Path(shutil.which('java')).resolve()
stubs={
 'android/content/Context.java':'package android.content; public class Context {}',
 'android/content/BroadcastReceiver.java':'''package android.content; public class BroadcastReceiver {
 public static PendingResult current; public PendingResult goAsync(){return current;}
 public static class PendingResult {public int finishes; public void finish(){finishes++;}}
 }''',
 'android/os/Looper.java':'package android.os; public class Looper {public static Looper getMainLooper(){return null;}}',
 'android/os/Handler.java':'package android.os; public class Handler {public static Runnable timeout;public Handler(Looper l){} public boolean postDelayed(Runnable r,long delay){if(delay>9000)throw new AssertionError();timeout=r;return true;}}',
 'cn/jpush/android/api/CustomMessage.java':'package cn.jpush.android.api; public class CustomMessage {public String extra="{}";}',
 'cn/jpush/android/service/JPushMessageReceiver.java':'''package cn.jpush.android.service;
 public class JPushMessageReceiver extends android.content.BroadcastReceiver {
 public void onRegister(android.content.Context c,String r){} public void onConnected(android.content.Context c,boolean b){}
 public void onMessage(android.content.Context c,cn.jpush.android.api.CustomMessage m){}
 }''',
 'online/wydmeal/reservation/PushBridge.java':'''package online.wydmeal.reservation;
 public class PushBridge {public static Runnable completion;public static int receives;
 public static void sync(android.content.Context c,boolean b){} public static void connected(android.content.Context c,boolean b){}
 public static void receive(android.content.Context c,String e,Runnable f){receives++;completion=f;}
 }''',
 'CallbackTest.java':'''import online.wydmeal.reservation.*;import android.content.BroadcastReceiver;
 public class CallbackTest {public static void main(String[] a){
 MealPushReceiver r=new MealPushReceiver();cn.jpush.android.api.CustomMessage m=new cn.jpush.android.api.CustomMessage();
 // SDK calls onMessage directly: there is no Android pending broadcast result.
 BroadcastReceiver.current=null;r.onMessage(null,m);PushBridge.completion.run();
 // Network finishes first; the later timeout must not finish the broadcast twice.
 BroadcastReceiver.current=new BroadcastReceiver.PendingResult();r.onMessage(null,m);PushBridge.completion.run();android.os.Handler.timeout.run();
 if(BroadcastReceiver.current.finishes!=1)throw new AssertionError("double finish");
 // Slow network: finish the broadcast before its deadline, tolerate late completion.
 BroadcastReceiver.current=new BroadcastReceiver.PendingResult();r.onMessage(null,m);android.os.Handler.timeout.run();PushBridge.completion.run();
 if(BroadcastReceiver.current.finishes!=1||PushBridge.receives!=3)throw new AssertionError();
 System.out.println("PASS: direct SDK callback without pending result, broadcast completion exactly once, and timeout/late network completion.");
 }}'''
}
(root/'build').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=root/'build',prefix='push-callback-') as temp:
 folder=Path(temp);sources=[]
 for name,content in stubs.items():
  path=folder/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content,encoding='utf-8');sources.append(path)
 sources.append(root/'app/src/main/java/online/wydmeal/reservation/MealPushReceiver.java')
 subprocess.run([str(java.parent/'javac'),'-encoding','UTF-8','--release','8','-d',temp,*map(str,sources)],check=True)
 subprocess.run([str(java),'-cp',temp,'CallbackTest'],check=True)
