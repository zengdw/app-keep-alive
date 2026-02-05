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
- **通知服务**: NotifyX平台集成
- **部署**: Cloudflare全球边缘网络

## 快速开始

### 环境要求

- Node.js 20+ 或 22+
- pnpm
- Cloudflare账户和Wrangler CLI

### 开发环境设置

1. **克隆项目并安装依赖**
   ```bash
   git clone <repository-url>
   cd stms
   pnpm install
   ```

2. **运行开发环境设置脚本**
   ```bash
   ./scripts/dev-setup.sh
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

### 数据库管理

```bash
# 创建数据库
pnpm run db:create

# 运行迁移（本地）
pnpm run db:migrate

# 运行迁移（生产）
pnpm run db:migrate:prod

# 数据库控制台
pnpm run db:console
```

### 构建和部署

```bash
# 构建项目
pnpm run build

# 部署到Cloudflare
pnpm run deploy
```

## 项目结构

```
stms/
├── src/                    # Vue.js前端应用
│   ├── components/         # Vue组件
│   ├── views/             # 页面组件
│   ├── stores/            # Pinia状态管理
│   └── api/               # API客户端
├── server/                # Cloudflare Worker后端
│   ├── routes/            # API路由
│   ├── services/          # 业务服务
│   ├── models/            # 数据模型
│   └── utils/             # 工具函数
├── migrations/            # 数据库迁移文件
└── scripts/               # 开发脚本
```

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

### 日志端点
- `GET /api/logs` - 获取执行日志
- `GET /api/logs/:taskId` - 获取特定任务的日志

### 系统端点
- `GET /api/health` - 健康检查

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

1. 在 `migrations/` 中创建新的SQL文件
2. 运行 `pnpm run db:migrate` 应用迁移

## 许可证

MIT License

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```
