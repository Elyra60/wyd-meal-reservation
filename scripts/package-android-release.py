"""Prepare signed APK download assets before a Workers deployment."""
import argparse,pathlib,re,json,hashlib
p=argparse.ArgumentParser();p.add_argument('apk');p.add_argument('--version-code',type=int,required=True);p.add_argument('--version-name',required=True);p.add_argument('--min-sdk',type=int,default=26);p.add_argument('--note',action='append',default=[]);a=p.parse_args()
if a.version_code<1 or not re.fullmatch(r'\d+\.\d+\.\d+',a.version_name):raise SystemExit('Invalid version')
apk=pathlib.Path(a.apk).resolve();data=apk.read_bytes()
if not 1024<=len(data)<=50000000:raise SystemExit('APK must be between 1 KiB and 50 MB')
public=pathlib.Path(__file__).resolve().parent.parent/'public';folder=public/'android-packages'/a.version_name;folder.mkdir(parents=True,exist_ok=True);parts=[]
for i,start in enumerate(range(0,len(data),16*1024*1024)):
 chunk=data[start:start+16*1024*1024];name='part-'+str(i)+'.bin';(folder/name).write_bytes(chunk);parts.append({'path':'/android-packages/'+a.version_name+'/'+name,'bytes':len(chunk)})
release={'versionCode':a.version_code,'versionName':a.version_name,'minSdk':a.min_sdk,'apkUrl':'https://wyd-meal-reservation.online/downloads/wyd-meal-reservation-'+a.version_name+'-native.apk','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'notes':a.note,'parts':parts}
releases=public/'android/releases';releases.mkdir(parents=True,exist_ok=True);encoded=json.dumps(release,ensure_ascii=False,indent=2).encode('utf-8');(releases/(a.version_name+'.json')).write_bytes(encoded);(public/'android/latest.json').write_bytes(encoded);print(json.dumps({'version':a.version_name,'sha256':release['sha256'],'parts':len(parts)}))
