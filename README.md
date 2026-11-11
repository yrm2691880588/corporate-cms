# 企业官网内容管理系统（CMS）

一个可复用的企业官网 + 后台内容管理系统模板。前台给访客和搜索引擎看，后台给内部人员写内容、改设置。修改配置即可换品牌用于其他公司。

> **给非技术使用者的说明**：见 [使用说明.md](使用说明.md)

---

## 快速开始

```bash
# 1. 安装依赖（首次）
npm install

# 2. 灌入示例数据（首次，可选）
npm run db:seed

# 3. 构建
node node_modules/next/dist/bin/next build

# 4. 启动
node node_modules/next/dist/bin/next start -p 3000
```

打开 http://localhost:3000，后台在 `/admin/login`，默认账号 `admin` / `admin12345`（**首次登录后立即改密码**）。

**Windows 用户**：直接双击 `启动.bat` 即可，会自动完成上面四步。

### 为什么用 `node node_modules/next/dist/bin/next` 而不是 `npm run`

在某些受限沙箱环境中，npm 包装会启动子进程并报 `spawn EPERM`。直接调用 node 二进制可绕过。**普通环境用 `npm run build` / `npm start` 也可以。**

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 15（App Router） |
| 语言 | TypeScript（strict） |
| UI | shadcn/ui + Radix UI + lucide-react + sonner |
| 样式 | Tailwind CSS 4 |
| 数据库 | SQLite（better-sqlite3，单文件） |
| ORM | Drizzle ORM |
| 校验 | zod |
| 富文本 | TipTap 2 |
| 图片 | sharp（压缩转 WebP）+ react-easy-crop（裁剪） |
| 密码 | bcryptjs |

**运行时**：Node.js ≥ 20。

---

## 目录结构

```
├── config/site.config.ts    品牌出厂默认值（数据库 settings 优先）
├── lib/
│   ├── schema.ts            数据库表结构（Drizzle 单一真源）
│   ├── db.ts                连接 + 建表迁移
│   ├── content.ts           内容查询 owner 层
│   ├── settings.ts          站点设置（数据库 > 配置文件）
│   ├── sanitize.ts          正文 HTML 白名单净化
│   ├── logger.ts            错误日志
│   ├── auth.ts              认证与会话
│   ├── slug.ts              URL 别名规范化
│   ├── crop.ts              服务端图片裁剪
│   └── api-wrapper.ts       接口统一错误捕获
├── app/
│   ├── (site)/              前台官网
│   ├── admin/               后台管理
│   ├── api/                 接口
│   └── uploads/             图片静态服务
├── components/
│   ├── ui/                  shadcn 标准组件
│   └── admin/               后台业务组件
├── scripts/                 初始化 / 启动 / 停止 / 备份 / 恢复
├── data/                    ⚠️ 数据目录，不进 Git
│   ├── site.db              SQLite 数据库
│   ├── uploads/             上传的图片
│   ├── logs/                错误日志
│   └── secret.key           会话签名密钥
└── backup/                  备份产物，不进 Git
```

---

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run db:seed` | 灌入示例数据（已存在的跳过） |
| `npx tsx scripts/reset.ts` | **危险**：清空全部数据重建，需输 YES 确认 |
| `npm test` | 跑自动化测试（43 个用例，自动用数据库副本） |
| `npx tsc --noEmit` | 类型检查 |
| `node node_modules/next/dist/bin/next build` | 构建 |

**Windows 一键脚本**：`启动.bat` / `停止.bat` / `备份.bat` / `恢复.bat`

---

## 关键约定（改代码前必读）

1. **内容查询走 `lib/content.ts`**，页面和接口不直接 `getDb()`。
2. **正文必须经 `sanitizeHtml`**（在 `mapRow` 统一处理）。iframe 只放行视频平台白名单。
3. **改表结构要同步两处**：`lib/schema.ts` 和 `lib/db.ts` 的建表语句。
4. **前台不加根级 `loading.tsx`**，会让 404 变软 404、307 变 200。
5. **禁止对 `data/site.db` 做模糊匹配删除**。清理测试数据必须按 id 精确删。
6. **`.bat` 只写英文**，中文提示放 `.ps1`（UTF-8 带 BOM）。

以上是必须遵守的硬性约定。

---

## 备份与恢复

- **备份**：双击 `备份.bat`，数据库和图片都会存到 `backup/`
- **恢复**：双击 `恢复.bat`，会先另存当前库再覆盖
- 数据全在 `data/` 目录，手工复制该目录也能备份

---

## 文档索引

| 文档 | 内容 |
|---|---|
| [使用说明.md](使用说明.md) | 非技术使用者操作指南：怎么启动、怎么写内容 |
| [GLOSSARY.md](GLOSSARY.md) | 术语表：内容、栏目、草稿、发布等概念的统一说法 |
| [SECURITY.md](SECURITY.md) | 安全措施说明与部署注意事项 |

---

## 已知缺口

| 项 | 状态 |
|---|---|
| 自动化测试 | ✅ 43 个用例，npm test |
| ESLint | ❌ 未配置 |
| CI | ❌ 无 |

## 环境变量

| 变量 | 作用 | 默认 |
|---|---|---|
| `DATABASE_PATH` | 指定数据库文件路径 | `data/site.db` |
| `ADMIN_GATE_TOKEN` | 后台访问口令（≥8 位），设了必须走 `/api/admin-gate?token=口令` | 不启用 |
| `TRUST_PROXY` | 设为 `1` 表示有可信反向代理，才采信 `x-forwarded-for` | 不启用 |

> Cloudflare / Vercel 部署时**不需要**设 `TRUST_PROXY`，代码会自动识别并优先用 `cf-connecting-ip`。

---

## 作者

本项目由 [@yrm2691880588](https://github.com/yrm2691880588) 开发维护。

基于 Next.js 15、SQLite 与 Drizzle ORM 构建，可作为企业官网的起点，修改 `config/site.config.ts` 即可换成自己的品牌。
