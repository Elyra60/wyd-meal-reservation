"""Build native Views with the verified AMap SDK and the official Android tools."""
import argparse, pathlib, os, subprocess, shutil, secrets, zipfile, hashlib, json
import xml.etree.ElementTree as ET
import io,struct
p=argparse.ArgumentParser();p.add_argument('--sdk',default=os.environ.get('ANDROID_SDK_ROOT'));p.add_argument('--amap-sdk');args=p.parse_args()
if not args.sdk:raise SystemExit('Pass --sdk PATH (Android platform 36 and build-tools 35.0.0 required).')
root=pathlib.Path(__file__).resolve().parent;sdk=pathlib.Path(args.sdk).resolve();tools=sdk/'build-tools/35.0.0';android=sdk/'platforms/android-36/android.jar'
build=root/'build';build.mkdir(exist_ok=True)
private=root/'.private';private.mkdir(exist_ok=True)
java=pathlib.Path(shutil.which('java')).resolve();jdk=java.parent
def run(*argv,env=None):
 result=subprocess.run([str(a) for a in argv],cwd=root,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
 if result.returncode:raise RuntimeError(result.stdout+'\n'+result.stderr)
 return result.stdout+result.stderr
def tool(name):return tools/(name+'.exe' if os.name=='nt' else name)
src=root/'app/src/main'
vendor=json.loads((root/'vendor-sdk.json').read_text(encoding='utf-8'))
sdkzip=pathlib.Path(args.amap_sdk).resolve() if args.amap_sdk else root.parent/'android-toolchain/amap/official-sdk-all.zip'
with zipfile.ZipFile(sdkzip) as outer:
 bundle=outer.read(vendor['bundle'])
with zipfile.ZipFile(io.BytesIO(bundle)) as package:
 vendorjar=build/'amap-sdk.jar';vendorjar.write_bytes(package.read(vendor['jar']))
 libraries={name:package.read(name) for name in package.namelist() if name.endswith('.so') and name.startswith(('arm64-v8a/','armeabi-v7a/'))}
for name,elf in libraries.items():
 if name.startswith('arm64-v8a/'):
  offset=struct.unpack_from('<Q',elf,32)[0];size,count=struct.unpack_from('<HH',elf,54)
  assert all(struct.unpack_from('<Q',elf,offset+i*size+48)[0]>=16384 for i in range(count) if struct.unpack_from('<I',elf,offset+i*size)[0]==1),'SDK must support 16KiB memory pages'

run(tool('aapt2'),'compile','--dir',src/'res','-o',build/'resources.zip')
generated=build/'generated'
if generated.exists():
 assert generated.resolve().parent==build.resolve()
 shutil.rmtree(generated)
generated.mkdir()
ET.register_namespace('android','http://schemas.android.com/apk/res/android')
manifest=ET.parse(src/'AndroidManifest.xml');manifest.getroot().set('package','online.wydmeal.reservation');config=json.loads((private/'app-config.json').read_text(encoding='utf-8'));metadata=next(n for n in manifest.getroot().iter('meta-data') if n.get('{http://schemas.android.com/apk/res/android}name')=='com.amap.api.v2.apikey');metadata.set('{http://schemas.android.com/apk/res/android}value',config['amapAndroidKey'])
manifest.write(build/'AndroidManifest.xml',encoding='utf-8',xml_declaration=True)
run(tool('aapt2'),'link','-I',android,'--manifest',build/'AndroidManifest.xml','--java',generated,
 '-o',build/'unsigned.apk',build/'resources.zip')
classes=build/'classes'
if classes.exists():
 assert classes.resolve().parent==build.resolve()
 shutil.rmtree(classes)
classes.mkdir()
run(jdk/'javac','-encoding','UTF-8','--release','8','-classpath',os.pathsep.join(str(x) for x in [android,vendorjar]),'-d',classes,*sorted((src/'java').rglob('*.java')),*sorted(generated.rglob('*.java')))
with zipfile.ZipFile(build/'classes.jar','w',compression=zipfile.ZIP_DEFLATED) as z:
 for f in classes.rglob('*.class'):z.write(f,f.relative_to(classes).as_posix())
dex=build/'dex'
if dex.exists():
 assert dex.resolve().parent==build.resolve()
 shutil.rmtree(dex)
dex.mkdir()
run(java,'-Xmx1536m','-cp',tools/'lib/d8.jar','com.android.tools.r8.D8','--release','--min-api','26','--lib',android,'--output',dex,build/'classes.jar',vendorjar)
with zipfile.ZipFile(build/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as z:
 for f in dex.glob('*.dex'):z.write(f,f.name)
 with zipfile.ZipFile(vendorjar) as vendorzip:
  for n in vendorzip.namelist():
   if n.startswith('assets/') and not n.endswith('/'):z.writestr(n,vendorzip.read(n))
 for n,content in libraries.items():z.writestr('lib/'+n,content)
run(tool('zipalign'),'-f','-P','16','4',build/'unsigned.apk',build/'aligned.apk')
key=private/'release.p12';password_file=private/'password.txt'
if not key.exists():
 password=secrets.token_urlsafe(36);password_file.write_text(password+'\n',encoding='utf-8')
 env={**os.environ,'WY_APK_STORE_PASSWORD':password}
 run(jdk/'keytool','-genkeypair','-keystore',key,'-storetype','PKCS12','-storepass:env','WY_APK_STORE_PASSWORD','-keypass:env','WY_APK_STORE_PASSWORD','-alias','wyd-release','-keyalg','RSA','-keysize','3072','-sigalg','SHA256withRSA','-validity','10000','-dname','CN=WYD Meal Reservation, O=WYD, C=CN',env=env)
if not password_file.exists():raise RuntimeError('Signing password file missing; preserve the original key for updates.')
output=build/'wyd-meal-reservation-2.4.0-native.apk'
signer=tools/'lib/apksigner.jar'
run(java,'-jar',signer,'sign','--ks',key,'--ks-key-alias','wyd-release','--ks-pass','file:'+str(password_file),'--out',output,build/'aligned.apk')
report=run(java,'-jar',signer,'verify','--verbose','--print-certs',output)
run(tool('zipalign'),'-c','-P','16','4',output)
badging=run(tool('aapt2'),'dump','badging',output)
assert "package: name='online.wydmeal.reservation'" in badging
assert "minSdkVersion:'26'" in badging and "targetSdkVersion:'36'" in badging
assert 'android.permission.INTERNET' in badging
assert 'android.permission.CAMERA' not in badging and 'android.permission.READ_EXTERNAL_STORAGE' not in badging
with zipfile.ZipFile(output) as z:
 assert 'classes.dex' in z.namelist() and 'AndroidManifest.xml' in z.namelist()
 assert z.testzip() is None
(build/'verification.txt').write_text(report+'\n'+badging,encoding='utf-8')
print(json.dumps({'apk':str(output),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'signed':True,'minimumAndroid':'8.0','targetApi':36,'verification':'APK signature, alignment, manifest, resources, DEX and ZIP passed'},ensure_ascii=False))
