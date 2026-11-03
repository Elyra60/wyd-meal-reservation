import online.wydmeal.reservation.Coordinates;
public final class CoordinatesTest {
 public static void main(String[] args){
  double[] foreign=Coordinates.gcj(51.5074,-0.1278);check(foreign[0]==51.5074&&foreign[1]==-0.1278,"Coordinates outside mainland range must remain unchanged");
  double[] beijing=Coordinates.gcj(39.908823,116.397470);check(Math.abs(beijing[0]-39.910226)<0.00001&&Math.abs(beijing[1]-116.403714)<0.00001,"Beijing WGS84 to GCJ02 reference conversion");
  double[] equator=Coordinates.gcj(0,110);check(equator[0]==0&&equator[1]==110,"No GCJ shift outside configured bounds");
  check(Double.isFinite(beijing[0])&&Double.isFinite(beijing[1]),"Finite search coordinates");System.out.println("PASS: geographic range guards and Beijing reference conversion.");
 }
 private static void check(boolean test,String message){if(!test)throw new AssertionError(message);}
}
