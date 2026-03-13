# Dashboard Front-End (Server Proxy)

前端不再让浏览器直接访问后端 `/api/current` 或 `/ws/dashboard`。  
当前模式是：

- 浏览器只访问 Next 同源接口
- Next route handler 代后端注入 `DASHBOARD_API_TOKEN`
- food viewer 身份由前端服务端签发 `HttpOnly` cookie
- `/debug` 默认仅开发模式可用
- `/api/online` 默认仅开发模式可用

## 环境变量

参考 [`.env.example`](/Users/aliceclodia/Desktop/am-i-okay/app/front-end/.env.example)：

- `BACKEND_INTERNAL_API_BASE_URL`
- `DASHBOARD_API_TOKEN`
- `FRONTEND_ACCESS_TOKEN`
- `ONLINE_MAX_CONNECTIONS`
- `ENABLE_DEBUG_PAGE`
- `ENABLE_ONLINE_API`

## 运行

```bash
bun install
bun run dev
```

检查：

```bash
bun run typecheck
bun run lint
```

## 关键接口

浏览器访问的是这些同源代理：

- `GET /api/dashboard/current`
- `GET /api/dashboard/food`
- `POST /api/dashboard/feed`

这些路由会在服务端调用后端真实接口：

- `/api/current`
- `/api/food`
- `/api/food/feed`

因此浏览器网络面板不会暴露 dashboard token。

## 安全行为

- `production` 下 `/debug` 返回 404，除非显式启用
- `production` 下 `/api/online` 默认返回 404
- 全站附带基础安全头：
  - `Content-Security-Policy`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `X-Content-Type-Options`
  - `Permissions-Policy`

## 本地联调

```bash
BACKEND_INTERNAL_API_BASE_URL=http://127.0.0.1:3000
DASHBOARD_API_TOKEN=dev-dashboard-token
ENABLE_DEBUG_PAGE=true
ENABLE_ONLINE_API=true
```
