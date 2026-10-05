# MyNav · 个人导航站

单文件 Cloudflare Workers 导航站：公开导航 + 密码保护的私密卡片 + 后台管理页。数据持久化在 Workers KV。

## 功能

- **公开导航**：深色星空主题，顶部多分类导航，多搜索引擎切换（Google / 百度 / Bing / GitHub / 站内搜索），玻璃拟态链接卡片（图标自动获取，悬停显示描述）
- **🔒 私密卡片**：独立密码保护的私密链接区，解锁后才可见
- **⚙️ 后台管理**（网址后加 `#admin`）：增删改查公开/私密链接、管理分类、修改网站标题、修改管理密码与私密密码，所有修改实时保存

## 安全设计

- 管理密码、私密密码均以 SHA-256 哈希存于 KV，公开接口永不返回哈希
- 登录会话为 HMAC 签名、带过期时间的 `HttpOnly; Secure` Cookie（密钥来自 `ADMIN_SECRET` 环境变量，防伪造）
- 部署时会提示是否仍在使用默认会话密钥

## 部署

### 1. 创建 KV 命名空间

```bash
npx wrangler kv:namespace create NAV_KV
```

把返回的 `id` 填到 `wrangler.toml` 的 `[[kv_namespaces]]` 中。

### 2. 设置会话密钥（重要）

```bash
npx wrangler secret put ADMIN_SECRET
# 输入一串随机字符串，例如：openssl rand -hex 32
```

### 3. 部署

```bash
npx wrangler deploy
```

部署后访问 `https://<worker名>.<子域名>.workers.dev`。

### 默认密码（首次登录后台后请立即修改）

- 管理密码：`admin123`
- 私密访问密码：`123456`

## 文件说明

| 文件 | 说明 |
|---|---|
| `worker.js` | 全部代码：后端 API + 前端页面（单文件） |
| `wrangler.toml` | Wrangler 部署配置 |

## API 一览

| 接口 | 说明 |
|---|---|
| `GET /` | 导航首页 |
| `GET /api/config` | 公开配置（分类/链接，不含私密与密码哈希） |
| `POST /api/private/unlock` | 私密区解锁 |
| `GET /api/private` | 私密链接（需 Cookie） |
| `POST /api/admin/login` | 后台登录 |
| `GET /api/admin/data` | 完整配置（需登录） |
| `POST /api/admin/save` | 保存配置（需登录） |
| `POST /api/admin/password` | 修改密码（需登录） |
