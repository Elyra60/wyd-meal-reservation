package online.wydmeal.reservation;
import java.math.BigDecimal;
public final class BookingLabels {
 public static final String[] TRANSPORT_VALUES={"","walking","bicycle","ebike","public_transit","car","taxi","other"};
 public static final String[] TRANSPORT_LABELS={"未填写","步行","骑行","电动车","公共交通","自驾","打车","其他"};
 public static String transport(String value){for(int i=0;i<TRANSPORT_VALUES.length;i++)if(TRANSPORT_VALUES[i].equals(value))return TRANSPORT_LABELS[i];return "未填写";}
 public static String amount(long cents){return BigDecimal.valueOf(cents,2).toPlainString();}
 public static Long parseCost(String value){if(value==null||value.trim().isEmpty())return null;String raw=value.trim();if(!raw.matches("\\d{1,6}(?:\\.\\d{1,2})?"))throw new IllegalArgumentException("预估人均消费须为0至100000元，最多两位小数。");long cents=new BigDecimal(raw).movePointRight(2).longValueExact();if(cents>10000000)throw new IllegalArgumentException("预估人均消费不能超过100000元。");return cents;}
}
