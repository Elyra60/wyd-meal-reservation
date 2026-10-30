# 王亦达放纵餐预约

> 认真计划每一顿，也为偶尔的放纵留一点期待。

一个围绕每周用餐额度设计的预约与审批网站，提供普通用户、王亦达和管理员三种角色。通过预约、审批、取消返还和用餐确认，将一次聚餐从发起到完成完整记录下来。

**在线访问：[wyd-meal-reservation.online](https://wyd-meal-reservation.online)**

使用 React、TypeScript 和 Vinext 构建，运行在 Cloudflare Workers，业务数据及小型头像存储于 D1。邮箱验证码使用 Resend，餐厅检索与选点使用高德地图，可部署在自己的 Cloudflare 账号中。

## 项目功能

| 角色 | 主要能力 |
|---|---|
| 普通用户 | 注册登录、发起与取消预约、查看审批结果及站内消息、维护个人资料 |
| 王亦达 | 审批或拒绝预约、填写拒绝理由、取消获批预约、确认完成用餐 |
| 管理员 | 查看用户与预约数据、修改用户及预约信息、调整周额度、停用普通账号、查看审计记录 |

### 账号与个人资料

- 邮箱与用户名均唯一，可使用用户名或已绑定的邮箱登录。
- 邮箱验证码注册、找回密码、绑定与更换邮箱，以及登录后的修改密码。
- 用户名统一转为小写，支持3–40位字母、数字或下划线，修改后需间隔一个日历月才能再次修改。
- 自定义昵称和头像；昵称默认填入预约姓名，提交前仍可修改。
- 王亦达首次使用需验证并绑定邮箱；新建的专属账号设有初始密码修改限制。

### 预约与周额度

- 按北京时间计算自然周，主页展示当周日期范围和额度概览。
- 每人同一时间只能有一笔待审批或已批准预约。
- 支持午餐、晚餐、夜宵，记录餐厅、日期、时间、人数、同行人及可选联系方式和备注。
- 同行人逐行添加，仅填写了姓名的同行人才会参与自动人数计算，也可手动调整人数。
- 日期输入自动补充斜杠；时间支持手动输入及选择。
- 每周额度默认2次，管理员可设置默认额度或指定周的额度。

| 状态 | 对额度的影响 | 后续操作 |
|---|---|---|
| 待审批 | 暂不占用 | 批准、拒绝或取消 |
| 已批准 | 预留一个名额 | 确认完成或取消 |
| 已完成 | 消耗一个名额 | 作为历史记录保留 |
| 已拒绝／已取消 | 不占用 | 用户可重新填写信息发起预约 |

批准后的取消会返还预留名额，并按取消方通知对应人员；批准前由用户取消，不通知王亦达。审批结果和拒绝理由会通知预约人。额度满额时，系统拒绝同周其他待审批预约，并阻止继续提交。

王亦达可手动确认完成用餐。超过预约时间24小时仍未确认的获批预约，会在后续请求或每小时定时结算时自动完成，因此实际后台结算最多可能再等待一个调度间隔。

### 地图与界面

- 高德餐厅搜索、定位、选点，选中结果自动填写餐厅名称与地址。
- 有当前位置时采用附近搜索，按距离排序；搜索范围为当前位置周边50公里，并支持分页。
- 城市可手动填写，也可通过定位获得；没有定位时按所填城市检索。
- 健康绿色主题，适配桌面与手机，预约记录集中展示重要信息。

## 技术栈与结构

| 层级 | 技术 |
|---|---|
| 界面 | React 19、TypeScript、Tailwind CSS 4、Lucide |
| 应用与构建 | Vinext、Vite、Cloudflare Vite Plugin |
| 服务端 | Cloudflare Workers、D1、原生 Cron Triggers |
| 数据模型 | Drizzle ORM、SQL迁移和数据库触发器 |
| 外部服务 | Resend、高德地图 JS API及服务端代理 |

```text
app/                 页面、表单、角色界面和 API 路由
db/                  Drizzle 数据模型与数据库入口
drizzle/             数据库迁移及元数据
lib/                 周期计算、用餐结算、地图及头像存储等
worker/index.ts      Worker 入口、HTTPS跳转和定时任务
public/              图标及静态资源
scripts/             验证、数据库配置与私密配置辅助脚本
docs/                部署维护说明
wrangler.json        当前部署配置
wrangler.example.json 新账号部署模板
```

## 本地开发

需要 Node.js 24 LTS 与 npm。以下命令在项目根目录执行：

```bash
npm ci
npm run db:local
```

根据 `.dev.vars.example` 创建本地 `.dev.vars`，按需填写邮箱和地图配置，然后启动：

```bash
npm run dev
```

本地入口为 `http://127.0.0.1:8787`。没有邮箱服务配置时，邮箱注册和找回密码不可用；没有高德配置时，地图搜索不可用。服务端依赖 Workers 运行环境及 D1，不能只将静态页面上传到 GitHub Pages 来运行完整应用。

## 部署到 Cloudflare

### 更新现有部署

仓库中的 `wrangler.json` 保留当前站点的数据库与路由配置；数据库ID和区域ID是资源标识，不是访问凭据。维护现有站点时保留这些配置：

```bash
npm ci
npm run login
npm run whoami
npm run build
npm run deploy
```

有新增数据库迁移时，先备份并执行 `npm run db:remote`，再按版本需要部署。配置密钥、初始密码或创建数据库不是每次更新都需要执行的步骤。

### 在新账号中首次部署

1. 将 `wrangler.example.json` 复制为 `wrangler.json`，避免沿用现有站点的数据库和域名路由。
2. 执行 `npm ci`、`npm run login`，创建自己的 D1 数据库：

   ```bash
   npx wrangler d1 create wyd-meal-reservation-db
   node scripts/configure-db.mjs YOUR_DATABASE_UUID
   npm run db:remote
   npm run build
   npm run deploy
   ```

3. 首次部署若提示缺少 `workers.dev` 子域名，按控制台提示完成开通后重新部署。
4. 执行 `npm run setup:secrets`，设置两个专属账号的初始密码和外部服务配置；也可通过 Cloudflare 控制台配置 Secrets。
5. 重新部署并验证测试地址，再配置自己的域名。域名路由、地图域名白名单和已验证发件域名均需使用自己的配置。

新数据库的默认用户名为 `3025244268`（王亦达）和 `siteadmin`（管理员），初始密码由部署者配置。账号由配置的初始密码哈希初始化，不提供写在源码里的通用密码。初始化配置不会覆盖数据库中已经存在账号的密码。

| 私密配置 | 用途 |
|---|---|
| `WY_INITIAL_HASH` | 王亦达初始密码的 PBKDF2 哈希，辅助脚本生成 |
| `MANAGER_INITIAL_HASH` | 管理员初始密码哈希，辅助脚本生成 |
| `RESEND_API_KEY` | 发送邮箱验证码 |
| `MAIL_FROM` | 已验证域名下的发件人地址 |
| `AMAP_JS_KEY` | 高德 Web端 JS API Key |
| `AMAP_SECURITY_CODE` | 高德安全密钥，仅存服务端 |

## 安全与数据

- 密码通过 PBKDF2-SHA256 加盐计算，迭代100,000次；会话令牌和邮箱验证码以摘要形式保存。
- 登录会话使用 `HttpOnly`、`Secure`、`SameSite=Lax` Cookie，写入接口检查请求来源。
- 注册、登录、验证码及部分更新接口设有限频；角色权限在服务端检查，额度由数据库触发器共同约束。
- 头像限制为128KiB，以 base64 存储于 D1，通过鉴权接口访问。
- 仓库不包含生产密钥、真实用户资料、会话、验证码、数据库导出或本地 Cloudflare 登录凭据。
- 请勿提交 `.dev.vars`、`.env`、`.wrangler/`、`.cache/` 或数据库备份。Fork 或公开分享前也应检查自己的新增文件。

## 验证与运行说明

```bash
npm test
npx tsc --noEmit
npm run build
```

测试脚本使用虚构账号、模拟发信及内存数据库，覆盖账号初始化、邮箱绑定、管理员权限、额度、预约审批与自动完成、头像读写及访问控制。

现有部署已验证正式域名的登录、地图检索、页面资源及 HTTP到HTTPS 跳转。实际验证码送达、长期流量额度和线上定时执行仍需结合实际使用观察。Cloudflare 免费方案有请求、CPU、数据库读写和存储限制，不保证任意访问量均可免费运行。

当前域名代理状态、数据备份和维护注意事项见 [运维说明](docs/OPERATIONS.md)。

## 参考文档

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [D1](https://developers.cloudflare.com/d1/)
- [Workers Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Resend](https://resend.com/docs)
- [高德地图 JS API](https://lbs.amap.com/api/javascript-api-v2/summary)
