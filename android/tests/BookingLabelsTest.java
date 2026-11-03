import online.wydmeal.reservation.BookingLabels;
public final class BookingLabelsTest {
 public static void main(String[] args){check(BookingLabels.parseCost("")==null);check(BookingLabels.parseCost("0")==0);check(BookingLabels.parseCost("128.50")==12850);check(BookingLabels.parseCost("100000.00")==10000000);check(BookingLabels.amount(12850).equals("128.50"));check(BookingLabels.transport("public_transit").equals("公共交通"));check(BookingLabels.transport("unknown").equals("未填写"));for(String bad:new String[]{"-1","1.001","100000.01","NaN","1e2"}){boolean rejected=false;try{BookingLabels.parseCost(bad);}catch(IllegalArgumentException e){rejected=true;}check(rejected);}System.out.println("PASS: native money precision, range validation, zero/empty values and transport labels.");}
 private static void check(boolean value){if(!value)throw new AssertionError();}
}
