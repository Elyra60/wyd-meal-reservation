# 王亦达放纵餐预约 · 原生 Android 2.2

使用 Android Views 构建业务界面，高德原生 SDK 渲染地图，通过 HTTPS JSON 接口复用网站账号、数据和业务规则。包名 `online.wydmeal.reservation`，versionCode 4，Android 8.0 起，target API 36，包含 ARM32 / ARM64 库。

## 功能

- 原生登录、注册、密码重置、邮箱绑定、昵称头像、用户名和密码修改。
- 原生预约、审批、取消、自主记录、用餐完成、热量补填、周额度、交通方式及人均消费。
- 管理员用户编辑、停用、额度设置、记录编辑、取消、投递及审计查看。
- 登录切换和管理员入口使用独立全宽按钮；同行人输入与移除改成纵向自适应布局。
- 外观可选深色、浅色、跟随系统；支持预设主题色、系统壁纸色及自定义 #RRGGBB。
- 高德原生地图可拖动、缩放、显示餐厅标记，支持地图、POI和搜索结果选点，填入餐厅与地址。SDK只在用户同意地图隐私说明后初始化，定位另行请求系统授权。
- 启动和手动检查新版本，用户确认后下载；安装前核对大小、SHA-256、包名、版本与当前证书。授权安装和安装本身仍由系统界面确认。
- 系统通知以当前账号为范围、通过游标去重，锁屏默认隐藏详情。前台约30秒检查；后台 JobScheduler 最短15分钟，受省电、强行停止及厂商限制影响。用户选择先完成此方案，尚未接入 JPush/FCM 即时推送。

## 更新与安装

2.2沿用1.0/2.0/2.1签名，可覆盖安装。会话使用 Android Keystore 加密保存，不存储账号密码。

元数据为 `https://wyd-meal-reservation.online/android/latest.json`，APK 是同域 `/downloads/wyd-meal-reservation-版本-native.apk`。Worker流式组合静态资产分段并支持HEAD、Range，客户端验证完整包的摘要和证书。后续发布必须递增versionCode，重新生成APK、下载分段和元数据后部署。

## 构建

需要 JDK17、Python3、Android Platform36、Build Tools35.0.0，以及 `vendor-sdk.json` 指定的高德官方SDK All ZIP（当前3DMap11.3.100 / Search9.8.1 / Location11.3.101）。

```text
python build-apk.py --sdk /path/to/android-sdk --amap-sdk /path/to/AMap_Android_SDK_All.zip
```

私有 `.private/app-config.json` 中配置 `amapAndroidKey`。Key必须绑定本包名和发布证书SHA-1。`.private/release.p12` 与 `.private/password.txt` 用于同签名发布，务必私密备份。源码不包含这些文件或SDK二进制。

脚本调用官方aapt2、javac、D8、zipalign、apksigner，并检查ARM64 ELF 16KiB对齐。Android Studio项目使用AGP8.10.1/Gradle8.11.1；如通过Studio构建，需将相同版本SDK的JAR放入app/libs/amap-sdk.jar、配置SDK native库及assets，并提供环境变量AMAP_ANDROID_KEY。推荐给定脚本复现当前产物。

## 验证范围

已通过编译、签名、同证书检查、坐标与金额处理、更新地址白名单测试，以及服务端消息隔离、游标分页和下载Range/摘要测试。当前环境没有完成真机或模拟器联调，地图授权/手势、系统权限、下载安装UI、厂商后台行为与字号下的实际显示仍需在手机核验。未发送真实用户测试邮件。
