# STMS - 定时任务管理系统

基于Cloudflare Worker和Vue.js构建的定时任务管理系统，支持保活任务和通知任务两种类型。

## 功能特性

- 🔄 **保活任务**: 定期发送HTTP请求保持目标应用活跃
- 📢 **通知任务**: 按计划发送提醒通知
- 🔐 **用户认证**: 安全的用户登录和会话管理
- 📊 **日志记录**: 详细的执行日志和系统监控
- 🌐 **Web界面**: 现代化的Vue.js前端界面
- ⚡ **无服务器**: 基于Cloudflare Worker的全球边缘部署

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite
- **后端**: Cloudflare Worker + TypeScript
- **数据库**: Cloudflare D1 (SQLite)
- **通知服务**: NotifyX, Resend平台集成
- **部署**: Cloudflare全球边缘网络

## 目录

- [快速开始](#快速开始)
- [常用命令](#常用命令)
- [项目结构](#项目结构)
- [配置文件说明](#配置文件说明)
- [部署指南](#部署指南)
- [API文档](#api文档)
- [开发指南](#开发指南)

---

## 快速开始

### 环境要求

- Node.js 20.19.0+ 或 22.12.0+
- pnpm 包管理器
- Cloudflare 账户

### 本地开发设置

1. **克隆项目并安装依赖**
   ```bash
   git clone <repository-url>
   cd stms
   pnpm install
   ```

2. **🔄 运行数据库迁移**
   ```bash
   pnpx wrangler d1 migrations apply stms-db --local
   ```

3. **配置环境变量**
   ```bash
   cp .dev.vars.example .dev.vars
   # 编辑 .dev.vars 文件并填入实际配置值
   ```

4. **启动开发服务器**
   ```bash
   # 同时启动前后端开发服务器
   pnpm run dev
   
   # 或分别启动
   pnpm run dev:frontend  # 前端: http://localhost:5173
   pnpm run dev:backend   # 后端: http://localhost:8787
   ```

---

## 常用命令

### 开发

```bash
# 启动开发服务器（前端 + 后端）
pnpm run dev

# 仅启动前端
pnpm run dev:frontend

# 仅启动后端
pnpm run dev:backend
```

### 构建

```bash
# 完整构建（类型检查 + 构建）
pnpm run build

# 仅构建（不进行类型检查）
pnpm run build-only

# 类型检查
pnpm run type-check
```

### 测试

```bash
# 运行所有测试
pnpm run test

# 监听模式运行测试
pnpm run test:watch

# 测试 UI
pnpm run test:ui

# 测试覆盖率
pnpm run test:coverage
```

### 数据库

```bash
# 本地数据库迁移
pnpm run db:migrate

# 创建生产环境数据库
pnpm run db:create:production

# 生产环境数据库迁移
pnpm run db:migrate:production

# 创建预发布环境数据库
pnpm run db:create:staging

# 预发布环境数据库迁移
pnpm run db:migrate:staging

# 查看本地数据库表
pnpm run db:console
```

### 部署

```bash
# 部署到生产环境
pnpm run deploy:production

# 部署到预发布环境
pnpm run deploy:staging

# 使用部署脚本（推荐）
./scripts/deploy.sh production
./scripts/deploy.sh staging
```

### 日志

```bash
# 查看生产环境日志
pnpm run logs:production

# 查看预发布环境日志
pnpm run logs:staging
```

### 密钥管理

```bash
# 设置生产环境密钥
wrangler secret put JWT_SECRET --env production
wrangler secret put NOTIFYX_API_KEY --env production
wrangler secret put EMAIL_API_KEY --env production

# 设置预发布环境密钥
wrangler secret put JWT_SECRET --env staging
wrangler secret put NOTIFYX_API_KEY --env staging
wrangler secret put EMAIL_API_KEY --env staging

# 列出所有密钥
wrangler secret list --env production
```

---

## 项目结构

```
stms/
├── server/              # 后端 Worker 代码
│   ├── index.ts        # Worker 入口
│   ├── routes/         # API 路由
│   │   ├── auth.ts
│   │   ├── tasks.ts
│   │   ├── logs.ts
│   │   └── health.ts
│   ├── services/       # 业务服务
│   │   ├── auth.service.ts
│   │   ├── task.service.ts
│   │   ├── notification.service.ts
│   │   └── cron.service.ts
│   ├── models/         # 数据模型
│   │   ├── user.model.ts
│   │   ├── task.model.ts
│   │   └── log.model.ts
│   ├── utils/          # 工具函数
│   │   ├── database.ts
│   │   └── response.ts
│   └── types/          # TypeScript 类型定义
│       └── index.ts
├── src/                # 前端 Vue 应用
│   ├── main.ts         # Vue 应用入口
│   ├── App.vue         # 根组件
│   ├── components/     # Vue 组件
│   │   ├── auth/
│   │   ├── tasks/
│   │   ├── logs/
│   │   └── common/
│   ├── views/          # 页面组件
│   │   ├── LoginView.vue
│   │   ├── DashboardView.vue
│   │   ├── TasksView.vue
│   │   └── LogsView.vue
│   ├── router/         # Vue Router 配置
│   │   └── index.ts
│   ├── stores/         # Pinia 状态管理
│   │   ├── auth.ts
│   │   ├── tasks.ts
│   │   └── logs.ts
│   ├── api/            # API 客户端
│   │   └── client.ts
│   ├── types/          # 前端类型定义
│   │   └── index.ts
│   └── assets/         # 静态资源
│       └── styles/
├── public/             # 公共静态文件
│   └── favicon.ico
├── migrations/         # 数据库迁移文件
│   └── 0001_initial.sql
├── tests/              # 测试文件
│   ├── unit/
│   ├── integration/
│   └── property/
├── scripts/            # 开发和部署脚本
│   ├── dev-setup.sh
│   └── deploy.sh
├── .github/            # GitHub Actions CI/CD
│   └── workflows/
│       └── deploy.yml
├── vite.config.ts      # Vite 配置
├── wrangler.jsonc      # Wrangler 配置
└── package.json        # 项目依赖和脚本
```

---

## 配置文件说明

本项目使用两种不同的配置文件系统：

### `.dev.vars` - 后端 Worker 配置

**用途**：存储 Cloudflare Worker 后端运行时需要的环境变量和敏感信息。

**特点**：
- 用于后端 Worker 运行时
- 可以安全存储敏感信息（JWT密钥、API密钥等）
- 在代码中通过 `env.VARIABLE_NAME` 访问
- 不会暴露给前端

**示例**：
```bash
# .dev.vars
JWT_SECRET=your_jwt_secret_key
NOTIFYX_API_KEY=your_api_key
EMAIL_API_KEY=your_email_key
```

**生产环境**：使用 `wrangler secret put` 命令设置
```bash
wrangler secret put JWT_SECRET --env production
```

### `.env.*` - 前端 Vite 配置

**用途**：存储 Vite 构建过程和前端代码需要的环境变量。

**特点**：
- 用于前端构建时和客户端代码
- 变量必须以 `VITE_` 开头才能在前端访问
- 在代码中通过 `import.meta.env.VITE_VARIABLE_NAME` 访问
- 会被打包到前端代码中，**不要存储敏感信息**

**文件类型**：
- `.env.development` - 开发环境配置
- `.env.production` - 生产环境配置

**示例**：
```bash
# .env.development
VITE_API_BASE_URL=http://localhost:8787/api
VITE_APP_TITLE=STMS Development
```

### 配置对比表

| 特性 | `.dev.vars` | `.env.*` |
|------|-------------|----------|
| **用途** | 后端 Worker 环境变量 | 前端构建时环境变量 |
| **作用范围** | 后端运行时 | 前端构建和客户端 |
| **命名规则** | 无特殊要求 | 必须以 `VITE_` 开头 |
| **敏感信息** | ✅ 可以存储 | ❌ 不能存储 |
| **访问方式** | `env.VAR` | `import.meta.env.VITE_VAR` |

📖 **详细说明**：查看 [CONFIGURATION.md](./CONFIGURATION.md) 了解更多配置细节和最佳实践。

---

## 部署指南

### 前置要求

1. **Cloudflare 账号**：需要一个 Cloudflare 账号
2. **Node.js**：版本 20.19.0+ 或 22.12.0+
3. **pnpm**：包管理器
4. **Wrangler CLI**：Cloudflare Workers 部署工具（已包含在项目依赖中）

### 环境配置

#### 1. 创建生产环境数据库

```bash
# 创建生产环境数据库
wrangler d1 create stms-db-production

# 创建预发布环境数据库（可选）
wrangler d1 create stms-db-staging
```

记录返回的 `database_id`，并更新 `wrangler.jsonc` 中对应环境的配置。

#### 2. 运行数据库迁移

```bash
# 生产环境
wrangler d1 migrations apply stms-db-production --env production

# 预发布环境
wrangler d1 migrations apply stms-db-staging --env staging
```

#### 3. 配置环境密钥

使用 `wrangler secret put` 命令设置敏感信息：

```bash
# 生产环境
wrangler secret put JWT_SECRET --env production
wrangler secret put NOTIFYX_API_KEY --env production
wrangler secret put EMAIL_API_KEY --env production

# 预发布环境
wrangler secret put JWT_SECRET --env staging
wrangler secret put NOTIFYX_API_KEY --env staging
wrangler secret put EMAIL_API_KEY --env staging
```

### 手动部署

#### 部署到生产环境

```bash
# 使用部署脚本
./scripts/deploy.sh production

# 或直接使用 pnpm 命令
pnpm run deploy:production
```

#### 部署到预发布环境

```bash
# 使用部署脚本
./scripts/deploy.sh staging

# 或直接使用 wrangler
pnpm run deploy:staging
```

### CI/CD 自动部署

项目已配置 GitHub Actions 自动部署流程。

#### 配置 GitHub Secrets

在 GitHub 仓库设置中添加以下 Secrets：

1. `CLOUDFLARE_API_TOKEN`：Cloudflare API Token
   - 在 Cloudflare Dashboard > My Profile > API Tokens 创建
   - 需要 "Edit Cloudflare Workers" 权限

2. `CLOUDFLARE_ACCOUNT_ID`：Cloudflare Account ID
   - 在 Cloudflare Dashboard > Workers & Pages 页面找到

#### 自动部署触发条件

- **推送到 `main` 分支**：自动部署到生产环境
- **推送到 `staging` 分支**：自动部署到预发布环境
- **Pull Request**：运行测试但不部署

### 部署验证

部署完成后，验证以下内容：

1. **健康检查**：访问 `https://your-worker.workers.dev/api/health`
2. **前端应用**：访问 `https://your-worker.workers.dev/`
3. **Cron 任务**：在 Cloudflare Dashboard 查看 Cron 触发器状态
4. **数据库**：验证数据库连接和数据迁移

### 回滚

如果需要回滚到之前的版本：

```bash
# 查看部署历史
wrangler deployments list --env production

# 回滚到指定版本
wrangler rollback [deployment-id] --env production
```

### 监控和日志

1. **实时日志**：
   ```bash
   wrangler tail --env production
   ```

2. **Cloudflare Dashboard**：
   - 访问 Workers & Pages > 你的 Worker
   - 查看请求统计、错误日志和性能指标

### 故障排查

#### 构建失败

- 检查 TypeScript 类型错误：`pnpm run type-check`
- 检查测试失败：`pnpm run test`

#### 部署失败

- 验证 Cloudflare API Token 权限
- 检查 wrangler.jsonc 配置是否正确
- 确认数据库 ID 是否正确

#### 运行时错误

- 使用 `wrangler tail` 查看实时日志
- 检查环境变量和密钥是否正确设置
- 验证数据库迁移是否成功

### 性能优化

1. **启用缓存**：静态资源已配置文件名 hash，可以设置长期缓存
2. **代码分割**：Vite 已配置自动代码分割
3. **压缩**：生产构建自动启用代码压缩
4. **CDN**：Cloudflare 自动提供全球 CDN 加速

### 成本估算

Cloudflare Workers 免费套餐包括：
- 每天 100,000 次请求
- 每次请求 10ms CPU 时间
- D1 数据库：5GB 存储，每天 500 万次读取

对于大多数小型到中型应用，免费套餐已经足够。

---

## API文档

### 认证端点

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

### 任务管理端点

- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建新任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务
- `PATCH /api/tasks/:id/toggle` - 切换任务启用状态

### 日志端点

- `GET /api/logs` - 获取执行日志
- `GET /api/logs/:taskId` - 获取特定任务的日志

### 系统端点

- `GET /api/health` - 健康检查
- `GET /api/system/status` - 系统状态

---

## 开发指南

### 添加新的API端点

1. 在 `server/routes/` 中创建路由文件
2. 在 `server/services/` 中实现业务逻辑
3. 在 `server/index.ts` 中注册路由

### 添加新的Vue组件

1. 在 `src/components/` 中创建组件
2. 在 `src/views/` 中创建页面
3. 在 `src/router/` 中配置路由

### 数据库迁移

1. 在 `migrations/` 中创建新的SQL文件（格式：`XXXX_description.sql`）
2. 运行 `pnpm run db:migrate` 应用迁移到本地
3. 运行 `pnpm run db:migrate:production` 应用到生产环境

### 环境变量

#### 开发环境 (.dev.vars)

```
JWT_SECRET=your-dev-secret
NOTIFYX_API_KEY=your-dev-api-key
EMAIL_API_KEY=your-dev-email-key
```

#### 生产环境

使用 `wrangler secret put` 命令设置，不要提交到代码库。

### 端口配置

- 前端开发服务器：http://localhost:5173
- 后端开发服务器：http://localhost:8787

---

## 有用的链接

- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [D1 数据库文档](https://developers.cloudflare.com/d1/)
- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [NotifyX 平台](https://www.notifyx.cn/)

---

## IDE 推荐设置

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (禁用 Vetur)

### 浏览器开发工具

- **Chromium 浏览器** (Chrome, Edge, Brave 等):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [启用 Custom Object Formatter](http://bit.ly/object-formatters)
- **Firefox**:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [启用 Custom Object Formatter](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

---

## 许可证

MIT License
