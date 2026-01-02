# AI课程中心

基于 GitHub Pages + Supabase 的无服务器在线课程平台。

## 功能特性

- 🔐 用户登录/注册系统
- ✅ 管理员审核激活机制
- 📚 Markdown 课程内容展示
- 🎨 现代化深色主题 UI
- 📱 响应式设计

## 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Supabase (Auth + PostgreSQL)
- **部署**: GitHub Pages
- **样式**: 纯 CSS (赛博朋克风格)

## 快速开始

### 1. 配置 Supabase

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 进入你的项目 > SQL Editor
3. 执行 `supabase/migrations/001_init.sql` 中的 SQL 创建表和策略

### 2. 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 3. 创建管理员账号

1. 通过网页注册一个账号
2. 在 Supabase Dashboard > Table Editor > profiles 中
3. 找到你的用户，将 `is_active` 和 `is_admin` 设为 `true`

### 4. 批量导入用户 (可选)

1. 创建 `.env.local` 文件:
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

2. 创建 `account.txt` 文件:
```
username1 password1
username2 password2
```

3. 运行导入脚本:
```bash
npm run import:accounts
```

### 5. 同步课程内容

将 Markdown 文件放入 `notebook/` 目录，然后:

```bash
npm run sync:markdown
```

### 6. 部署到 GitHub Pages

1. 将代码推送到 GitHub
2. 在仓库 Settings > Pages 中启用 GitHub Actions 部署
3. 推送到 main 分支会自动触发部署

## 项目结构

```
├── .github/workflows/    # GitHub Actions 部署配置
├── notebook/             # 课程 Markdown 源文件
├── public/               # 静态资源
├── scripts/              # 本地管理脚本
│   ├── import_accounts.mjs        # 批量导入用户
│   └── sync_markdown_from_notebook.mjs  # 同步课程内容
├── src/
│   ├── lib/supabase.ts   # Supabase 客户端
│   ├── pages/            # 页面组件
│   └── index.css         # 全局样式
├── supabase/migrations/  # 数据库迁移 SQL
└── vite.config.ts        # Vite 配置
```

## 环境变量

| 变量 | 用途 | 位置 |
|------|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | 本地脚本使用的管理员密钥 | `.env.local` |

> ⚠️ Service Role Key 拥有完整数据库权限，切勿提交到 Git！

## 自定义

### 修改 Supabase 项目

编辑 `src/lib/supabase.ts` 中的:
- `supabaseUrl`: 你的 Supabase 项目 URL
- `supabaseAnonKey`: 你的 Supabase anon/public key

### 修改部署路径

如果部署到 `username.github.io/repo-name/`，编辑 `vite.config.ts`:

```ts
export default defineConfig({
  base: '/repo-name/',
  // ...
})
```

## 许可证

MIT
