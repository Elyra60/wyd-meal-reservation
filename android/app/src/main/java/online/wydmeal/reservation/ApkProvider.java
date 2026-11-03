package online.wydmeal.reservation;
import android.content.*;
import android.database.*;
import android.net.Uri;
import android.os.*;
import android.provider.OpenableColumns;
import java.io.*;
public final class ApkProvider extends ContentProvider {
 static File file(Context c)throws IOException{String name=c.getSharedPreferences("updates",0).getString("file","");if(!name.matches("wyd-meal-\\d+\\.apk"))throw new FileNotFoundException();File dir=c.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);if(dir==null)throw new FileNotFoundException();File target=new File(dir,name).getCanonicalFile();if(!target.getParentFile().equals(dir.getCanonicalFile()))throw new FileNotFoundException();return target;}
 private void validate(Uri uri)throws FileNotFoundException{if(!"/update".equals(uri.getPath()))throw new FileNotFoundException();}
 @Override public boolean onCreate(){return true;}
 @Override public String getType(Uri uri){return "application/vnd.android.package-archive";}
 @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{validate(uri);if(!"r".equals(mode))throw new FileNotFoundException();try{return ParcelFileDescriptor.open(file(getContext()),ParcelFileDescriptor.MODE_READ_ONLY);}catch(IOException e){throw new FileNotFoundException();}}
 @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String order){try{validate(uri);File f=file(getContext());MatrixCursor cursor=new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE});cursor.addRow(new Object[]{f.getName(),f.length()});return cursor;}catch(IOException e){return null;}}
 @Override public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}@Override public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}@Override public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
}
