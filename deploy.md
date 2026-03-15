# am-i-okay 部署步骤

这份文档基于当前已完成的安全加固版本，按“先后端、再前端、最后 agent”的顺序部署。

## 1. 部署前准备

需要准备 2 类 token：

- `DASHBOARD_API_TOKEN`
  - 给前端服务端代理访问 back-end 使用
- `AGENT_API_TOKEN`
  - 给 desktop-agent / android-agent 连接 `/ws/agent` 使用

如果你要限制单个 agent 的身份，推荐直接配置：

```json
{
  "agent-token-1": {
    "deviceId": "macbook-1",
    "agentName": "desktop-agent",
    "platform": "macos"
  },
  "agent-token-2": {
    "deviceId": "android-pixel",
    "agentName": "android-agent",
    "platform": "android"
  }
}
```

把它放进 `AGENT_TOKEN_BINDINGS`。

## 2. 部署 back-end

目录：

```bash
cd app/back-end
```

安装依赖：

```bash
bun install
```

生产环境至少配置这些变量：

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
DASHBOARD_API_TOKEN=replace-with-strong-dashboard-token
AGENT_API_TOKEN=replace-with-strong-agent-token
ALLOWED_ORIGINS=https://your-frontend.example.com
ALLOW_INSECURE_LOCALHOST=false
AGENT_TOKEN_BINDINGS='{"agent-token-1":{"deviceId":"macbook-1","agentName":"desktop-agent","platform":"macos"}}'
```

说明：

- `NODE_ENV=production` 下如果缺少 `DASHBOARD_API_TOKEN`、`AGENT_API_TOKEN`、`ALLOWED_ORIGINS` 或有效 agent 绑定，服务会拒绝启动。
- 生产环境不要开启 `ALLOW_INSECURE_LOCALHOST=true`。
- 对外反向代理请使用 `HTTPS/WSS`。

启动：

```bash
bun run start
```

部署后验证：

```bash
bun run typecheck
BASE_URL=https://your-backend.example.com \
DASHBOARD_API_TOKEN=replace-with-strong-dashboard-token \
AGENT_API_TOKEN=replace-with-strong-agent-token \
ALLOWED_ORIGIN=https://your-frontend.example.com \
bun run security-check
```

## 3. 部署 front-end

目录：

```bash
cd app/front-end
```

安装依赖：

```bash
bun install
```

生产环境建议配置：

```bash
NODE_ENV=production
BACKEND_INTERNAL_API_BASE_URL=https://your-backend.example.com
DASHBOARD_API_TOKEN=replace-with-strong-dashboard-token
FRONTEND_ACCESS_TOKEN=
ENABLE_DEBUG_PAGE=false
```

说明：

- 浏览器不会直接拿到 `DASHBOARD_API_TOKEN`，它只在 Next 服务端代理里使用。
- `ENABLE_DEBUG_PAGE=false` 时，`/debug` 在 production 下返回 404。
- `BACKEND_INTERNAL_API_BASE_URL` 必须指向已经部署好的 hardened back-end。

构建并启动：

```bash
bun run build
bun run start
```

部署后验证：

```bash
bun run typecheck
```

浏览器侧人工检查：

- 打开首页，确认页面正常加载。
- 打开开发者工具 Network，确认请求走的是：
  - `/api/dashboard/current`
  - `/api/dashboard/food`
  - `/api/dashboard/feed`
- 确认浏览器里看不到后端 Bearer token。
- 生产环境访问 `/debug` 应返回 404。

## 4. 部署 desktop-agent

目录：

```bash
cd app/desktop-agent
```

校验：

```bash
cargo test
```

运行时至少提供：

```bash
AGENT_SERVER_WS_URL=wss://your-backend.example.com/ws/agent
AGENT_API_TOKEN=replace-with-strong-agent-token
AGENT_NAME=desktop-agent
AGENT_DEVICE_ID=macbook-1
ALLOW_INSECURE_LOCALHOST=false
```

启动：

```bash
cargo run
```

说明：

- 生产环境必须使用 `wss://`。
- 只有本地开发并且显式设置 `ALLOW_INSECURE_LOCALHOST=true` 时，才允许 `ws://127.0.0.1` 或 `ws://localhost`。
- 启动后会生成或更新 `desktop-agent.config.json`。

## 5. 部署 android-agent

目录：

```bash
cd app/android-agent
```

构建：

```bash
./gradlew assembleDebug
```

当前安全行为：

- release 默认 `usesCleartextTraffic=false`
- 只有 debug 且目标是 `localhost` / `127.0.0.1` / `10.0.2.2` 时允许明文
- 启动前必须填写：
  - `Backend URL`
  - `Agent Name`
  - `Agent API Token`

生产建议：

- `Backend URL` 使用 `https://your-backend.example.com`
- 实际连接会自动转换为 `wss://your-backend.example.com/ws/agent`

本地调试示例：

- 模拟器连接本机后端可填 `http://10.0.2.2:3000`
- 仅 debug 构建允许这种明文本地例外

## 6. 推荐部署顺序

1. 先部署 back-end，并确认 `bun run security-check` 通过。
2. 再部署 front-end，并确认首页只走同源代理接口。
3. 最后配置并启动 desktop-agent / android-agent。
4. 观察 back-end 日志，确认：
   - 未认证请求被拒绝
   - dashboard 可以正常拉取状态
   - agent 连接成功
   - 身份不匹配的 agent 会被关闭

## 7. 上线后检查清单

- 后端公网只通过 `HTTPS/WSS` 暴露
- `ALLOWED_ORIGINS` 只包含真实前端域名
- `DASHBOARD_API_TOKEN` 和 `AGENT_API_TOKEN` 已替换为强随机值
- `AGENT_TOKEN_BINDINGS` 已绑定真实 `deviceId` / `agentName`
- 前端生产环境 `ENABLE_DEBUG_PAGE=false`
- desktop-agent 未启用 `ALLOW_INSECURE_LOCALHOST`
- Android release 包未放开 cleartext
