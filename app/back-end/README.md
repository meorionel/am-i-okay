# Activity Forwarder Backend (Hardened)

这个后端现在默认按“拒绝优先、显式授权”运行：

- 所有 HTTP 和 WebSocket 端点都要求 token
- `dashboard` 与 `agent` token 分权
- `/ws/agent` 绑定固定 `deviceId` / `agentName`
- CORS 仅允许 `ALLOWED_ORIGINS`
- food 计数器不再信任浏览器自报 fingerprint
- production 下缺少关键密钥会直接启动失败

## 配置方式

后端不再依赖 `.env` 文件，而是启动时通过中文 CLI 菜单读写 `back-end.config.json`。  
[`.env.example`](/Users/aliceclodia/Desktop/am-i-okay/app/back-end/.env.example) 现在作为配置项参考，菜单中都可以配置：

- `NODE_ENV=development|production`
- `HOST`, `PORT`
- `DASHBOARD_API_TOKEN`
- `AGENT_API_TOKEN`
- `AGENT_ALLOWED_DEVICE_ID`
- `AGENT_ALLOWED_AGENT_NAME`
- `AGENT_ALLOWED_PLATFORM`
- `AGENT_TOKEN_BINDINGS`
- `ALLOWED_ORIGINS`
- `ALLOW_INSECURE_LOCALHOST`

`AGENT_TOKEN_BINDINGS` 的格式：

```json
{
  "agent-token-1": {
    "deviceId": "macbook-1",
    "agentName": "desktop-agent",
    "platform": "macos"
  }
}
```

如果只配置 `AGENT_API_TOKEN`，服务会用 `AGENT_ALLOWED_*` 生成一个默认绑定。  
production 下必须至少有一个有效 agent 绑定。

## 运行

```bash
bun install
bun run dev
```

启动后会进入中文菜单，你可以：

- 切换“后端服务”开关
- 进入“日志页面”启动后端并查看日志，按 `q` 返回主菜单
- 配置服务参数
- 配置 Agent
- 查看当前配置

配置会保存到 `back-end.config.json`。

## 认证规则

### HTTP

以下端点都要求 `Authorization: Bearer <dashboard-token>`：

- `GET /health`
- `GET /api/current`
- `GET /api/food`
- `POST /api/food/feed`

### WebSocket

- `/ws/dashboard` 要求 dashboard token
- `/ws/agent` 要求 agent token
- token 可以走 `Authorization: Bearer ...`
- 如客户端库不方便加 header，可在握手时使用受限 query 参数 `?token=...`

### Agent 身份绑定

`/ws/agent` 连接建立后：

- 服务端只信任 token 绑定的 `deviceId` / `agentName`
- 客户端消息中的身份字段必须与绑定一致
- 不一致会返回错误并关闭连接

## CORS

- 不再返回 `Access-Control-Allow-Origin: *`
- 仅对白名单 `ALLOWED_ORIGINS` 回显 ACAO
- 仅允许 `GET, POST, OPTIONS`
- 仅允许 `Authorization, Content-Type`

## Food 身份

- 后端不再接受 `x-browser-fingerprint`
- food 请求必须带可信代理注入的 `x-food-viewer-id`
- 正常浏览器流量应通过前端同源代理访问

## 验证

类型检查：

```bash
bun run typecheck
```

服务启动后跑安全检查：

```bash
DASHBOARD_API_TOKEN=dev-dashboard-token \
AGENT_API_TOKEN=dev-agent-token \
ALLOWED_ORIGIN=http://127.0.0.1:3001 \
bun run security-check
```
