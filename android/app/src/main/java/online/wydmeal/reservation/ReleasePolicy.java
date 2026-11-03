package online.wydmeal.reservation;
import java.net.URL;
import java.io.IOException;
public final class ReleasePolicy {
 public static void validate(int code,long bytes,String digest,String address)throws Exception{URL url=new URL(address);if(!"https".equals(url.getProtocol())||!"wyd-meal-reservation.online".equals(url.getHost())||url.getUserInfo()!=null||(url.getPort()!=-1&&url.getPort()!=443)||!url.getPath().matches("/downloads/wyd-meal-reservation-\\d+\\.\\d+\\.\\d+-native\\.apk")||url.getRef()!=null||url.getQuery()!=null||code<1||bytes<1024||bytes>50000000||!digest.matches("[a-f0-9]{64}"))throw new IOException("更新信息无效。");}
}
