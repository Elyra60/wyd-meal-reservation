package online.wydmeal.reservation;
import android.app.*;
import android.content.*;
import android.content.res.Configuration;
import android.graphics.Color;
import android.widget.*;

public final class Appearance {
 public static boolean dark(Context c){String mode=c.getSharedPreferences("appearance",0).getString("mode","system");return "dark".equals(mode)||"system".equals(mode)&&(c.getResources().getConfiguration().uiMode&Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;}
 public static void apply(Activity a){a.setTheme(dark(a)?R.style.AppThemeDark:R.style.AppThemeLight);}
 public static void settings(Activity a,LinearLayout parent,NativeUi ui){
  ui.title(parent,"外观设置","选择适合你的明暗模式和主题颜色。");String[] modes={"system","light","dark"},labels={"跟随系统","浅色模式","深色模式"};RadioGroup group=new RadioGroup(a);String current=a.getSharedPreferences("appearance",0).getString("mode","system");for(int i=0;i<modes.length;i++){RadioButton b=new RadioButton(a);b.setId(android.view.View.generateViewId());b.setText(labels[i]);b.setTextColor(ui.text);b.setTextSize(16);b.setPadding(ui.dp(8),ui.dp(14),ui.dp(8),ui.dp(14));b.setTag(modes[i]);group.addView(b);b.setChecked(modes[i].equals(current));}parent.addView(group);group.setOnCheckedChangeListener((g,id)->{RadioButton b=g.findViewById(id);a.getSharedPreferences("appearance",0).edit().putString("mode",(String)b.getTag()).apply();a.recreate();});
  ui.gap(parent,24);parent.addView(ui.text("主题颜色",22,ui.text,true));String[][] colors={{"系统壁纸配色","dynamic"},{"健康绿","#3E6337"},{"湖水蓝","#315DA8"},{"鸢尾紫","#7351A1"},{"暖橙","#8D511C"},{"玫瑰红","#9C4562"},{"海松青","#006A66"}};for(String[] choice:colors)ui.fullButton(parent,choice[0],false,()->{android.content.SharedPreferences.Editor editor=a.getSharedPreferences("appearance",0).edit();editor.putBoolean("dynamic","dynamic".equals(choice[1]));if(!"dynamic".equals(choice[1]))editor.putString("seed",choice[1]);editor.apply();a.recreate();});EditText custom=ui.input(parent,"自定义颜色 · #RRGGBB",a.getSharedPreferences("appearance",0).getString("seed","#3E6337"),android.text.InputType.TYPE_CLASS_TEXT);ui.fullButton(parent,"应用自定义颜色",true,()->{String value=custom.getText().toString().trim();if(!value.matches("#[0-9a-fA-F]{6}")){custom.setError("例如 #3E6337");return;}a.getSharedPreferences("appearance",0).edit().putBoolean("dynamic",false).putString("seed",value).apply();a.recreate();});
 }
 public static int tone(int seed,float saturation,float value){float[] hsv=new float[3];Color.colorToHSV(seed,hsv);hsv[1]=hsv[1]<.05f?0:saturation;hsv[2]=value;return Color.HSVToColor(hsv);}
}
