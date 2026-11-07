package online.wydmeal.reservation;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.security.KeyStore;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.*;
import java.util.*;

/** Fixed-origin JSON transport. The app never stores an account password. */
public final class ApiClient {
 public static final class SessionExpired extends IOException {public SessionExpired(){super("登录已过期，请重新登录。");}}
 public static final String ORIGIN="https://wyd-meal-reservation.online";
 private final SharedPreferences prefs;private final Context context;
 private String cookie="";
 public ApiClient(Context context){this.context=context.getApplicationContext();prefs=context.getSharedPreferences("native_session",Context.MODE_PRIVATE);try{String encoded=prefs.getString("sealed","");if(!encoded.isEmpty()&&prefs.getLong("expires",0)>System.currentTimeMillis()){String[] parts=encoded.split(":");Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));cookie=new String(c.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),"UTF-8");}}catch(Exception e){clear();}}
 private SecretKey key()throws Exception{KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);String alias="wyd-native-session-v2";if(!store.containsAlias(alias)){KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");generator.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generator.generateKey();}return (SecretKey)store.getKey(alias,null);}
 public synchronized void clear(){cookie="";prefs.edit().clear().apply();}
 public synchronized String sessionKey(){if(cookie.isEmpty())return "";try{byte[] digest=java.security.MessageDigest.getInstance("SHA-256").digest(cookie.getBytes("UTF-8"));StringBuilder s=new StringBuilder();for(byte b:digest)s.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return s.toString();}catch(Exception e){return "";}}
 private void acceptCookie(String header)throws Exception{
  if(header==null||!header.startsWith("meal_session="))return;
  String value=header.split(";",2)[0];long age=604800;
  for(String part:header.split(";"))if(part.trim().startsWith("Max-Age="))age=Long.parseLong(part.trim().substring(8));
  if(age<=0){clear();return;}
  Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());String sealed=Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(c.doFinal(value.getBytes("UTF-8")),Base64.NO_WRAP);
  prefs.edit().putString("sealed",sealed).putLong("expires",System.currentTimeMillis()+Math.min(age,604800)*1000).apply();cookie=value;
 }
 public JSONObject state()throws Exception{return json("/api/action",null);}
 public JSONObject action(JSONObject value)throws Exception{return json("/api/action",value);}
 public JSONObject json(String path,JSONObject value)throws Exception{
  byte[] bytes=request(path,value);
  try{return new JSONObject(new String(bytes,"UTF-8"));}catch(Exception e){throw new IOException("服务暂时无法连接，请稍后重试。");}
 }
 public byte[] avatar(String path)throws Exception{if(!path.startsWith("/api/avatar"))throw new IOException("头像地址无效");return request(path,null);}
 private synchronized byte[] request(String path,JSONObject value)throws Exception{
  if(!path.startsWith("/api/")||path.contains("://")||path.contains(".."))throw new IOException("请求地址无效");
  HttpURLConnection c=(HttpURLConnection)new URL(ORIGIN+path).openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","WydMealNative/2.5 Android");c.setRequestProperty("Origin",ORIGIN);if(!cookie.isEmpty())c.setRequestProperty("Cookie",cookie);
  try{
   if(value!=null){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json; charset=utf-8");try(OutputStream out=c.getOutputStream()){out.write(value.toString().getBytes("UTF-8"));}}
   int status=c.getResponseCode();if(status==401){clear();throw new SessionExpired();}
   InputStream stream=status>=400?c.getErrorStream():c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream();if(stream!=null)try(InputStream input=stream){byte[] block=new byte[8192];int n;while((n=input.read(block))!=-1){if(out.size()+n>8388608)throw new IOException("数据过大，请联系管理员。");out.write(block,0,n);}}
   if(status<200||status>=300){String message="网络连接失败，请稍后重试（"+status+"）。";try{message=new JSONObject(out.toString("UTF-8")).optString("error",message);}catch(Exception ignored){}throw new IOException(message);}
   for(Map.Entry<String,List<String>> h:c.getHeaderFields().entrySet())if("Set-Cookie".equalsIgnoreCase(h.getKey()))for(String v:h.getValue())acceptCookie(v);
   return out.toByteArray();
  }finally{c.disconnect();}
 }
 public static JSONObject object(Object... pairs){JSONObject result=new JSONObject();try{for(int i=0;i<pairs.length;i+=2)result.put((String)pairs[i],pairs[i+1]);}catch(Exception e){throw new IllegalArgumentException(e);}return result;}
}
