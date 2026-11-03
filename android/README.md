# 王亦达放纵餐预约 · 原生 Android 2.1

本版本使用 Java 和 Android 原生 Views 重建交互页面，不包含 WebView、HTML 页面渲染或网页 JavaScript。通过 HTTPS JSON 接口连接既有网站服务，所有账号与业务规则由服务器统一校验。

## 原生页面

- 登录、注册、找回密码、强制邮箱绑定、修改密码、修改用户名和邮箱。
- 概览、预约列表、详情、审批、取消、用餐完成与热量补填。
- 预约及自主记录表单：餐次、人数、逐行同行人、原生日期与时间选择、联系方式、备注。
- 放纵餐记录、单次及累计热量、本周与待补填筛选、红色负额度提示。
- 消息列表、个人昵称与系统图片选择器、头像缩放上传。
- 管理员周额度设置、用户编辑与停用、预约和记录编辑、取消、邮件投递与审计记录。
- 原生地点检索与前台定位：复用现有高德服务端接口，转换 WGS84/GCJ02 坐标，显示按距离排序的结果和分页。选中后填入餐厅与地址。查看地图会调起系统地图应用或浏览器，没有内嵌地图网页，也没有冒用 JS Key 初始化 Android 地图 SDK。

## 界面与安装

Material 3 风格的自定义原生控件：圆角 tonal 卡片、胶囊按钮、底部五项导航、深浅色及可选系统动态配色。没有首页常驻返回和刷新按钮；返回只出现在子页面，菜单支持同步数据，前台每30秒检查消息与记录更新。

适配 Android 16（target API 36）的 edge-to-edge 和系统返回接口，最低 Android 8.0（API 26）。原生控件响应系统字号，表单有键盘避让。

安装 `wyd-meal-reservation-2.1.0-native.apk`，可以同签名覆盖此前1.0版，无须卸载。原生客户端需要重新登录，不读取旧网页内核的 Cookie。登录会话使用 Android Keystore 加密保存，密码不落盘。

本版本仍需要联网。站内消息在 App 打开时同步；邮件由现有服务继续发送，没有新增离线系统推送。网站服务器规则与数据更新即时共享；原生界面自身更新需安装新版 APK。

## 构建

JDK 17、Python 3、Android SDK Platform 36、Build Tools 35.0.0：

```text
python build-apk.py --sdk /path/to/android-sdk
```

构建脚本调用官方 aapt2、javac、D8、zipalign 和 apksigner。也可使用 Android Studio 打开本目录，AGP 8.10.1、Gradle 8.11.1、JDK17。Gradle 构建的发布签名需要另外配置；手动脚本会使用现有 `.private/release.p12` 和 `.private/password.txt`。

签名材料必须一起私密保存。源码 ZIP 不含密钥、真实账号数据、SDK 工具链或签名备份；不要将 `.private` 上传 GitHub。

## 验证范围

通过 Platform 36 编译、资源/Manifest/DEX/ZIP 检查、APK v2/v3 签名验证及与1.0版签名一致性检查。检查最终 DEX 不含 `android.webkit`；原生控件、定位与日期时间控件引用存在。WGS84/GCJ02 边界与北京参考坐标测试通过。以原生客户端 User-Agent 调用正式匿名状态接口返回200。

当前没有安卓真机/模拟器验证，尚未实际验证各厂商设备的页面显示、登录后完整流程、头像选择、定位授权与地图跳转。未向真实用户发送测试邮件，也未修改服务器或生产数据。

参考：
- https://developer.android.com/develop/ui/views/theming/dynamic-colors
- https://developer.android.com/about/versions/16/behavior-changes-16
- https://developer.android.com/build/releases/agp-8-10-0-release-notes

## 2.1 更新

预约、自主记录与管理员编辑新增选填交通方式和预估人均消费（元/人）。金额最多两位小数，按分保存。预约列表与详情共用原生摘要组件：状态、餐厅、日期时间和人数首先展示，再展示同行人、交通、费用、联系方式、地址及备注。卡片高度随内容测量，增加上下间距并取消额外层级，避免按钮紧贴下一张卡片。
