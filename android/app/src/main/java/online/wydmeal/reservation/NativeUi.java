package online.wydmeal.reservation;
import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.*;
import android.graphics.drawable.*;
import android.content.res.ColorStateList;
import android.os.Build;
import android.view.*;
import android.widget.*;

/** Material 3 inspired native Views: tonal surfaces, rounded shapes, scalable type. */
public final class NativeUi {
 public final Activity a;public final boolean dark;public int bg,card,tonal,primary,onPrimary,text,muted,line,error;
 public NativeUi(Activity activity){a=activity;dark=Appearance.dark(a);
  bg=Color.parseColor(dark?"#101510":"#F7FAF2");card=Color.parseColor(dark?"#1C241C":"#FFFFFF");tonal=Color.parseColor(dark?"#2C3E2B":"#E4EEDB");primary=Color.parseColor(dark?"#B6D6A2":"#3E6337");onPrimary=Color.parseColor(dark?"#14330F":"#FFFFFF");text=Color.parseColor(dark?"#E5EBDC":"#202B1E");muted=Color.parseColor(dark?"#B9C6B2":"#65735E");line=Color.parseColor(dark?"#3C4938":"#DDE5D5");error=Color.parseColor(dark?"#FFB4AB":"#B3261E");
  int seed=Color.parseColor(a.getSharedPreferences("appearance",0).getString("seed","#3E6337"));
  if(!a.getSharedPreferences("appearance",0).getBoolean("dynamic",false)){primary=Appearance.tone(seed,dark?.28f:.65f,dark?.88f:.42f);tonal=Appearance.tone(seed,dark?.25f:.08f,dark?.24f:.94f);onPrimary=dark?Color.rgb(15,25,15):Color.WHITE;}
  if(Build.VERSION.SDK_INT>=31&&a.getSharedPreferences("appearance",0).getBoolean("dynamic",false)){primary=a.getColor(dark?android.R.color.system_accent1_200:android.R.color.system_accent1_600);tonal=a.getColor(dark?android.R.color.system_accent1_800:android.R.color.system_accent1_100);}
 }
 public int dp(float n){return Math.round(n*a.getResources().getDisplayMetrics().density);}
 public LinearLayout column(){LinearLayout v=new LinearLayout(a);v.setOrientation(LinearLayout.VERTICAL);v.setLayoutParams(new LinearLayout.LayoutParams(-1,-2));return v;}
 public LinearLayout row(){LinearLayout v=new LinearLayout(a);v.setGravity(Gravity.CENTER_VERTICAL);return v;}
 public GradientDrawable shape(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;}
 public TextView text(String value,int size,int color,boolean bold){TextView t=new TextView(a);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setTypeface(null,bold?Typeface.BOLD:Typeface.NORMAL);t.setIncludeFontPadding(false);t.setLineSpacing(dp(3),1);return t;}
 public TextView body(String value){return text(value,16,text,false);}
 public void gap(LinearLayout parent,int height){View v=new View(a);parent.addView(v,new LinearLayout.LayoutParams(1,dp(height)));}
 public LinearLayout card(LinearLayout parent){LinearLayout box=column();box.setPadding(dp(20),dp(20),dp(20),dp(20));box.setBackground(shape(card,28));box.setClipToOutline(true);box.setElevation(0);box.setTranslationZ(0);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(8);p.bottomMargin=dp(16);parent.addView(box,p);return box;}
 public Button button(String label,boolean filled,Runnable action){Button b=new Button(a);b.setText(label);b.setTextSize(15);b.setAllCaps(false);b.setMinHeight(dp(52));b.setMinimumHeight(dp(52));b.setTextColor(filled?onPrimary:primary);b.setTypeface(null,Typeface.BOLD);b.setPadding(dp(20),dp(10),dp(20),dp(10));b.setStateListAnimator(null);b.setBackground(new RippleDrawable(ColorStateList.valueOf(dark?0x22FFFFFF:0x14000000),shape(filled?primary:tonal,28),null));b.setOnClickListener(v->action.run());return b;}
 public void fullButton(LinearLayout parent,String label,boolean filled,Runnable action){Button b=button(label,filled,action);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=dp(10);p.bottomMargin=dp(14);parent.addView(b,p);}
 public EditText input(LinearLayout parent,String label,String value,int type){TextView l=text(label,13,muted,true);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(16);lp.bottomMargin=dp(7);parent.addView(l,lp);EditText e=new EditText(a);e.setText(value==null?"":value);e.setTextSize(16);e.setTextColor(text);e.setHintTextColor(muted);e.setInputType(type);e.setPadding(dp(16),dp(13),dp(16),dp(13));e.setMinHeight(dp(56));e.setBackground(shape(tonal,16));e.setSaveEnabled(false);parent.addView(e,new LinearLayout.LayoutParams(-1,-2));return e;}
 public void title(LinearLayout parent,String title,String subtitle){parent.addView(text(title,30,text,true));if(subtitle!=null&&!subtitle.isEmpty()){gap(parent,8);parent.addView(text(subtitle,14,muted,false));}gap(parent,22);}
 public View icon(String name,int color){return new Icon(a,name,color);}
 private final class Icon extends View {final String name;final Paint p=new Paint(3);Icon(Activity a,String name,int color){super(a);this.name=name;p.setColor(color);p.setStrokeWidth(1.8f);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}@Override protected void onDraw(Canvas canvas){super.onDraw(canvas);canvas.save();canvas.translate((getWidth()-dp(24))/2f,(getHeight()-dp(24))/2f);canvas.scale(dp(24)/24f,dp(24)/24f);p.setStyle(Paint.Style.STROKE);Path path=new Path();switch(name){case "home":path.moveTo(3,11);path.lineTo(12,3);path.lineTo(21,11);path.moveTo(5,10);path.lineTo(5,21);path.lineTo(10,21);path.lineTo(10,15);path.lineTo(14,15);path.lineTo(14,21);path.lineTo(19,21);path.lineTo(19,10);break;case "calendar":canvas.drawRoundRect(3,5,21,21,3,3,p);canvas.drawLine(3,10,21,10,p);canvas.drawLine(8,3,8,7,p);canvas.drawLine(16,3,16,7,p);canvas.drawCircle(9,15,1,p);canvas.restore();return;case "fire":path.moveTo(13,2);path.cubicTo(14,8,21,9,20,16);path.cubicTo(19,24,5,24,4,16);path.cubicTo(3,12,7,9,8,8);path.lineTo(9,13);path.cubicTo(13,10,10,6,13,2);break;case "message":canvas.drawRoundRect(3,3,21,18,4,4,p);path.moveTo(6,18);path.lineTo(6,22);path.lineTo(11,18);canvas.drawLine(7,8,17,8,p);canvas.drawLine(7,12,14,12,p);break;case "review":canvas.drawRoundRect(4,3,20,21,3,3,p);path.moveTo(7,12);path.lineTo(10,15);path.lineTo(17,8);break;case "person":canvas.drawCircle(12,7,4,p);path.moveTo(4,22);path.cubicTo(3,11,21,11,20,22);break;case "back":path.moveTo(15,5);path.lineTo(8,12);path.lineTo(15,19);break;case "more":canvas.drawCircle(12,5,1,p);canvas.drawCircle(12,12,1,p);canvas.drawCircle(12,19,1,p);canvas.restore();return;default:path.moveTo(5,20);path.cubicTo(1,8,10,3,21,3);path.cubicTo(21,16,14,23,5,20);path.moveTo(4,23);path.lineTo(16,9);}canvas.drawPath(path,p);canvas.restore();}}
}
