# 王亦达放纵餐预约 · 原生 Android 2.3.1

使用 Android Views 构建业务界面，高德原生 SDK 渲染地图，通过 HTTPS JSON 接口复用网站账号、数据和业务规则。包名 `online.wydmeal.reservation`，versionCode 6，Android 8.0 起，target API 36，包含 ARM32 / ARM64 库。

## 功能

- 原生登录、注册、密码重置、邮箱绑定、昵称头像、用户名和密码修改。
- 原生预约、审批、取消、自主记录、用餐完成、热量补填、周额度、交通方式及人均消费。
- 管理员用户编辑、停用、额度设置、记录编辑、取消、投递及审计查看。
- 登录切换和管理员入口使用独立全宽按钮；同行人输入与移除改成纵向自适应布局。
- 外观可选深色、浅色、跟随系统；支持预设主题色、系统壁纸色及自定义 #RRGGBB。
- 高德原生地图可拖动、缩放、显示餐厅标记，支持地图、POI和搜索结果选点，填入餐厅与地址。SDK只在用户同意地图隐私说明后初始化，定位另行请求系统授权。
- 启动和手动检查新版本，用户确认后下载；安装前核对大小、SHA-256、包名、版本与当前证书。授权安装和安装本身仍由系统界面确认。
- 系统通知以当前账号为范围、通过游标去重，锁屏默认隐藏详情。前台约30秒检查；后台 JobScheduler 最短15分钟，受省电、强行停止及厂商限制影响。新增极光6.3.0 / JCore5.6.0基础通道，经用户同意后初始化并绑定当前会话；即时唤醒后仅通过认证接口取回自己的消息，与定时检查共用游标去重。退出、密码/邮箱修改和停用后会话失效，服务端解绑。

## 更新与安装

2.3沿用1.0/2.0/2.1/2.2签名，可覆盖安装。会话使用 Android Keystore 加密保存，不存储账号密码。

元数据为 `https://wyd-meal-reservation.online/android/latest.json`，APK 是同域 `/downloads/wyd-meal-reservation-版本-native.apk`。Worker流式组合静态资产分段并支持HEAD、Range，客户端验证完整包的摘要和证书。后续发布必须递增versionCode，重新生成APK、下载分段和元数据后部署。

## 构建

需要 JDK17、Python3、Android Platform36、Build Tools35.0.0，以及 `push-sdk.json` 指定的极光 Maven AAR（可放在SDK同级jpush目录或通过--push-sdk指定）和 `vendor-sdk.json` 指定的高德官方SDK All ZIP（当前3DMap11.3.100 / Search9.8.1 / Location11.3.101）。

```text
python build-apk.py --sdk /path/to/android-sdk --amap-sdk /path/to/AMap_Android_SDK_All.zip
```

私有 `.private/app-config.json` 中配置 `amapAndroidKey` 和客户端 `jpushAppKey`。Master Secret 只能保存在服务端 Secrets。Key必须绑定本包名和发布证书SHA-1。`.private/release.p12` 与 `.private/password.txt` 用于同签名发布，务必私密备份。源码不包含这些文件或SDK二进制。

脚本调用官方aapt2、javac、D8、zipalign、apksigner，并检查ARM64 ELF 16KiB对齐。Android Studio项目使用AGP8.10.1/Gradle8.11.1；如通过Studio构建，需将相同版本SDK的JAR放入app/libs/amap-sdk.jar、配置SDK native库及assets，并提供环境变量AMAP_ANDROID_KEY和JPUSH_APP_KEY。推荐给定脚本复现当前产物。

## 验证范围

已通过编译、签名、同证书检查、坐标与金额处理、更新地址白名单测试，以及服务端消息隔离、游标分页和下载Range/摘要测试。当前环境没有完成真机或模拟器联调，地图授权/手势、系统权限、下载安装UI、厂商后台行为与字号下的实际显示仍需在手机核验。未发送真实用户测试邮件。


## 华为／荣耀厂商通道

本版已接入极光基础长连接，仍保留15分钟后台检查。尚未加入华为/HONOR厂商SDK和厂商凭据，不能承诺进程被清理后的及时送达。华为需应用的App ID、agconnect-services.json及极光后台HMS通道配置；荣耀需其独立Push服务应用参数和极光后台HONOR通道配置。请按当前极光官方指南分别开通，勿混用两家的应用凭据。基础通道采用自定义消息唤醒；加入厂商通道时还需将服务端切换为适配厂商的通知载荷并核验注销隔离和去重。当前发布不宣称支持HarmonyOS NEXT原生应用。

极光SDK来自Maven Central，构建时核对SHA-256，并合并官方AAR资源及必要组件。按需保留网络、通知及地图定位权限，不申请后台定位、电话状态、全包查询或存储权限；SDK InitProvider通过ConsentPushProvider在用户同意前禁用初始化。极光当前AAR只含ARM64原生库；ARM32保留原有应用/地图功能，推送兼容性需要真机核验。未向真实用户发送测试推送，也没有完成真机端到端即时推送验证。
