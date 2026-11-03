package online.wydmeal.reservation;
/** The provider does not start the SDK before the user's push consent. */
public final class ConsentPushProvider extends cn.jpush.android.service.InitProvider {
 @Override public boolean onCreate(){android.content.SharedPreferences p=getContext().getSharedPreferences("instant_push",0);return p.getBoolean("consent",false)&&p.getBoolean("enabled",true)&&super.onCreate();}
}
