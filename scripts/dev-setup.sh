#!/bin/bash

# 开发环境设置脚本

echo "🚀 设置STMS开发环境..."

# 安装依赖
echo "📦 安装依赖..."
pnpm install

# 检查环境变量文件
if [ ! -f ".dev.vars" ]; then
    echo "⚠️  .dev.vars文件不存在，从示例文件复制..."
    cp .dev.vars.example .dev.vars
    echo "✅ 请编辑 .dev.vars 文件并填入实际配置值"
fi

# 创建本地数据库
echo "🗄️  创建本地D1数据库..."
pnpx wrangler d1 create stms-db || echo "数据库可能已存在"

# 运行数据库迁移
echo "🔄 运行数据库迁移..."
pnpx wrangler d1 migrations apply stms-db --local

# 生成类型定义
echo "📝 生成TypeScript类型定义..."
pnpm run cf-typegen

echo "✅ 开发环境设置完成！"
echo ""
echo "🎯 使用以下命令启动开发服务器："
echo "   pnpm run dev        # 启动前后端开发服务器"
echo "   pnpm run dev:frontend # 仅启动前端开发服务器"
echo "   pnpm run dev:backend  # 仅启动后端开发服务器"
echo ""
echo "🌐 访问地址："
echo "   前端: http://localhost:5173"
echo "   后端API: http://localhost:8787"