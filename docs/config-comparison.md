# 配置文件快速对比

## 一图看懂两种配置文件

```
┌─────────────────────────────────────────────────────────────────┐
│                         STMS 配置系统                            │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐        ┌──────────────────────────┐
│     .dev.vars            │        │     .env.*               │
│  (后端 Worker 配置)       │        │  (前端 Vite 配置)         │
└──────────────────────────┘        └──────────────────────────┘
         │                                    │
         │                                    │
         ▼                                    ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│  Cloudflare Worker       │        │  Vite 构建过程           │
│  (后端运行时)             │        │  (前端构建时)             │
│                          │        │                          │
│  • JWT_SECRET            │        │  • VITE_API_BASE_URL     │
│  • NOTIFYX_API_KEY       │        │  • VITE_APP_TITLE        │
│  • EMAIL_API_KEY         │        │  • VITE_*                │
│  • 任何敏感信息           │        │  • 只能是公开信息         │
└──────────────────────────┘        └──────────────────────────┘
         │                                    │
         │                                    │
         ▼                                    ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│  访问方式：               │        │  访问方式：               │
│  env.JWT_SECRET          │        │  import.meta.env         │
│  env.NOTIFYX_API_KEY     │        │    .VITE_API_BASE_URL    │
└──────────────────────────┘        └──────────────────────────┘
```

## 使用场景决策树

```
需要配置环境变量？
    │
    ├─ 是后端使用的？
    │   │
    │   ├─ 是 → 使用 .dev.vars
    │   │      示例：JWT_SECRET, API密钥
    │   │
    │   └─ 否 → 继续判断
    │
    └─ 是前端使用的？
        │
        ├─ 是敏感信息？
        │   │
        │   ├─ 是 → ❌ 不能用 .env.*
        │   │      应该通过后端API获取
        │   │
        │   └─ 否 → ✅ 使用 .env.*
        │          记得加 VITE_ 前缀
        │          示例：VITE_API_BASE_URL
        │
        └─ 两者都需要？
            │
            └─ 分别配置：
               • 后端部分 → .dev.vars
               • 前端部分 → .env.*
```

## 实际例子

### ❌ 错误示例

```bash
# .env.development (错误！)
JWT_SECRET=my_secret_key          # ❌ 敏感信息不能放这里
API_BASE_URL=http://localhost     # ❌ 缺少 VITE_ 前缀，前端访问不到
```

### ✅ 正确示例

```bash
# .dev.vars (后端配置)
JWT_SECRET=my_secret_key          # ✅ 后端密钥放这里
NOTIFYX_API_KEY=notifyx_key       # ✅ 后端API密钥放这里

# .env.development (前端配置)
VITE_API_BASE_URL=http://localhost:8787/api  # ✅ 前端配置加 VITE_ 前缀
VITE_APP_TITLE=STMS Development              # ✅ 公开信息可以放这里
```

## 代码中的使用

### 后端代码（Worker）

```typescript
// server/services/auth.service.ts
export default {
  async fetch(request: Request, env: Env) {
    // 直接访问 .dev.vars 中的变量
    const secret = env.JWT_SECRET;
    const apiKey = env.NOTIFYX_API_KEY;
    
    // 使用密钥进行认证
    const token = jwt.sign(payload, secret);
  }
}
```

### 前端代码（Vue）

```typescript
// src/api/client.ts
// 访问 .env.* 中的变量（必须以 VITE_ 开头）
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const appTitle = import.meta.env.VITE_APP_TITLE;

// ❌ 这样访问不到（没有 VITE_ 前缀）
const wrong = import.meta.env.API_BASE_URL;  // undefined

// ❌ 这样也访问不到（.dev.vars 的变量）
const wrong2 = import.meta.env.JWT_SECRET;   // undefined
```

## 环境切换

### 开发环境

```bash
# 后端使用 .dev.vars
pnpm run dev:backend

# 前端使用 .env.development
pnpm run dev:frontend
```

### 生产环境

```bash
# 后端使用 wrangler secret
wrangler secret put JWT_SECRET --env production

# 前端使用 .env.production
pnpm run build  # 自动使用 .env.production
```

## 快速检查清单

### 配置后端变量时

- [ ] 是否需要在 Worker 中使用？
- [ ] 是否包含敏感信息？
- [ ] 是否已添加到 `.dev.vars`？
- [ ] 生产环境是否使用 `wrangler secret put` 设置？

### 配置前端变量时

- [ ] 是否需要在前端代码中使用？
- [ ] 是否为公开信息（不敏感）？
- [ ] 变量名是否以 `VITE_` 开头？
- [ ] 是否已添加到 `.env.development` 或 `.env.production`？

## 常见错误

1. **在 .env.* 中存储密钥** ❌
   - 问题：会被打包到前端代码，任何人都能看到
   - 解决：密钥放在 .dev.vars 中

2. **前端变量忘记加 VITE_ 前缀** ❌
   - 问题：前端代码访问不到
   - 解决：所有前端变量必须以 VITE_ 开头

3. **混淆两种配置文件** ❌
   - 问题：在错误的文件中配置变量
   - 解决：记住 .dev.vars = 后端，.env.* = 前端

4. **提交配置文件到 Git** ❌
   - 问题：泄露敏感信息
   - 解决：确保 .gitignore 包含这些文件

## 总结

| 我需要... | 使用文件 | 变量名规则 | 示例 |
|----------|---------|-----------|------|
| 后端密钥 | `.dev.vars` | 无要求 | `JWT_SECRET=xxx` |
| 前端API地址 | `.env.*` | 必须 `VITE_` 开头 | `VITE_API_BASE_URL=xxx` |
| 数据库配置 | `.dev.vars` | 无要求 | `DB_NAME=xxx` |
| 应用标题 | `.env.*` | 必须 `VITE_` 开头 | `VITE_APP_TITLE=xxx` |

**记住**：
- 🔒 敏感信息 → `.dev.vars`（后端）
- 🌐 公开配置 → `.env.*`（前端，加 `VITE_` 前缀）
