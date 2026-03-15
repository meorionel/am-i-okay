# Dashboard Front-End (Server Proxy)

前端不再让浏览器直接访问后端 `/api/current` 或 `/ws/dashboard`。  
当前模式是：

- 浏览器只访问 Next 同源接口
- Next route handler 代后端注入 `DASHBOARD_API_TOKEN`
- food viewer 身份由前端服务端签发 `HttpOnly` cookie
- 页面进入前要先通过一次 `@cap.js` 人机验证，验证成功后才放行 dashboard / food / online 代理
- food 实时数据通过同源接口签发短时 websocket 凭证，再订阅后端 `/ws/food`
- 每次投喂前都会先做一次低难度 `@cap.js` 挑战，再把本次 token 带到投喂代理
- `/debug` 默认仅开发模式可用
- `/api/online` 默认仅开发模式可用

## 环境变量

参考 [`.env.example`](/Users/aliceclodia/Desktop/am-i-okay/app/front-end/.env.example)：

- `BACKEND_INTERNAL_API_BASE_URL`
- `BACKEND_PUBLIC_WS_BASE_URL`
- `DASHBOARD_API_TOKEN`
- `HUMAN_GATE_COOKIE_SECRET`
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
- `GET /api/dashboard/socket`
- `GET /api/dashboard/food`
- `GET /api/dashboard/food/socket`
- `POST /api/dashboard/feed`
- `POST /api/human/page/challenge`
- `POST /api/human/page/redeem`
- `POST /api/human/page/verify`
- `POST /api/human/feed/challenge`
- `POST /api/human/feed/redeem`

这些路由会在服务端调用后端真实接口：

- `/api/current`
- `/api/food`
- `/api/food/feed`

因此浏览器网络面板不会暴露 dashboard token。

## 安全行为

- `production` 下 `/debug` 返回 404，除非显式启用
- `production` 下 `/api/online` 默认返回 404
- 页面验证成功后会签发 `amiokay_human_gate` 的 `HttpOnly` cookie，但它还会绑定当前页面会话 id；刷新页面后需要重新验证
- 全站附带基础安全头：
  - `Content-Security-Policy`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `X-Content-Type-Options`
  - `Permissions-Policy`

## 本地联调

```bash
BACKEND_INTERNAL_API_BASE_URL=http://127.0.0.1:3000
BACKEND_PUBLIC_WS_BASE_URL=ws://127.0.0.1:3000
DASHBOARD_API_TOKEN=dev-dashboard-token
HUMAN_GATE_COOKIE_SECRET=dev-human-gate-secret
ENABLE_DEBUG_PAGE=true
ENABLE_ONLINE_API=true
```
