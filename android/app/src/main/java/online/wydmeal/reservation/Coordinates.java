package online.wydmeal.reservation;
/** Android location is WGS84; mainland AMap search expects GCJ02. */
public final class Coordinates {
 private static double latOffset(double x,double y){double r=-100+2*x+3*y+0.2*y*y+0.1*x*y+0.2*Math.sqrt(Math.abs(x));r+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;r+=(20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3;r+=(160*Math.sin(y/12*Math.PI)+320*Math.sin(y*Math.PI/30))*2/3;return r;}
 private static double lngOffset(double x,double y){double r=300+x+2*y+0.1*x*x+0.1*x*y+0.1*Math.sqrt(Math.abs(x));r+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;r+=(20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3;r+=(150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3;return r;}
 public static double[] gcj(double latitude,double longitude){if(longitude<72.004||longitude>137.8347||latitude<0.8293||latitude>55.8271)return new double[]{latitude,longitude};double dlat=latOffset(longitude-105,latitude-35),dlng=lngOffset(longitude-105,latitude-35),rad=latitude/180*Math.PI,magic=Math.sin(rad);magic=1-0.00669342162296594323*magic*magic;double sqrt=Math.sqrt(magic);dlat=dlat*180/((6378245*(1-0.00669342162296594323))/(magic*sqrt)*Math.PI);dlng=dlng*180/(6378245/sqrt*Math.cos(rad)*Math.PI);return new double[]{latitude+dlat,longitude+dlng};}
}
