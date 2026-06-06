# Know You PWA

Know You 是一款面向情侣的沟通辅助工具原型。当前版本基于 v0 的 UI 原型继续工程化，使用前端状态和 `localStorage` 模拟登录、好友关系、聊天记录和 AI 解读流程。

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide React
- Supabase Auth + PostgreSQL
- DeepSeek API
- PWA manifest + service worker

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:3000
```

## 构建验证

```bash
npm run typecheck
npm run build
```

当前 `build` 脚本使用 `next build --webpack`，用于避开部分本地沙盒环境中 Turbopack 构建 CSS 时的端口权限问题。

## 测试账号

- 邮箱：`demo@knowyou.com`
- 密码：`demo123456`
- 昵称：小鹿

## PWA 测试

生产构建后访问站点，在手机浏览器中选择“添加到主屏幕”。应用配置位于：

- `public/manifest.json`
- `public/sw.js`
- `public/icons/`

service worker 只在生产环境注册，避免开发时缓存干扰调试。

## 后端配置

1. 在 Supabase 新建项目。
2. 打开 Supabase SQL Editor，执行 `supabase/schema.sql`。
3. 在 Supabase Project Settings -> API 复制：
   - Project URL
   - anon public key
4. 在 DeepSeek 控制台创建 API Key。
5. 在 Vercel Project Settings -> Environment Variables 添加：

```text
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon public key
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-chat
```

`deepseek-chat` 对应 V3，`deepseek-reasoner` 对应 R1。当前建议生产先用 `deepseek-chat`，响应更快、成本更稳。

## 部署链路

推荐链路：

```text
GitHub -> Vercel -> Cloudflare DNS
```

Vercel 绑定自定义域名后，到 Cloudflare 添加对应 DNS 记录，并开启 Proxied。
