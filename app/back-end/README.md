# Activity Forwarder Backend (Hardened)

这个后端现在默认按“拒绝优先、显式授权”运行：

- 所有 HTTP 和 WebSocket 端点都要求 token
- `dashboard` 与 `agent` token 分权
- `/ws/agent` 绑定固定 `deviceId` / `agentName`
- CORS 仅允许 `ALLOWED_ORIGINS`
- food 计数器不再信任浏览器自报 fingerprint
- `@cap.js` 挑战在后端生成、兑换、校验，页面进入与投喂各自使用独立 token 空间
- production 下缺少关键密钥会直接启动失败

## 配置方式

后端不再依赖 `.env` 文件，而是启动时通过中文 CLI 菜单读写 `back-end.config.json`。  
[`.env.example`](/Users/aliceclodia/Desktop/am-i-okay/app/back-end/.env.example) 现在作为配置项参考，菜单中都可以配置：

- `NODE_ENV=development|production`
- `HOST`, `PORT`
- `DASHBOARD_API_TOKEN`
- 多个 `Agent` 的 `token / deviceId / agentName / platform`
- `ALLOWED_ORIGINS`
- `ALLOW_INSECURE_LOCALHOST`
- `CAP_ENABLED`
- `CAP_PAGE_CHALLENGE_COUNT`
- `CAP_PAGE_CHALLENGE_SIZE`
- `CAP_PAGE_CHALLENGE_DIFFICULTY`
- `CAP_PAGE_EXPIRES_MS`
- `CAP_FEED_CHALLENGE_COUNT`
- `CAP_FEED_CHALLENGE_SIZE`
- `CAP_FEED_CHALLENGE_DIFFICULTY`
- `CAP_FEED_EXPIRES_MS`

开发模式下现在默认允许所有 `http://` / `ws://` 明文连接。  
生产模式下仍然要求安全传输，`ALLOW_INSECURE_LOCALHOST` 只作为本地生产排查时的兼容开关。

现在 Agent 配置改成列表模式，直接在 CLI 里添加、编辑、删除多个 Agent。  
production 下必须至少有一个有效 Agent。

## 运行

```bash
bun install
bun run dev
```

启动后会进入中文菜单，你可以：

- 直接选择“启动后端”进入运行状态，按 `q` 或 `Esc` 返回主菜单
- 配置服务参数
- 配置多个 Agent
- 查看当前配置

配置会保存到 `back-end.config.json`。

## 认证规则

### HTTP

以下端点都要求 `Authorization: Bearer <dashboard-token>`：

- `GET /health`
- `GET /api/current`
- `GET /api/food`
- `POST /api/food/feed`
- `POST /api/human/page/challenge`
- `POST /api/human/page/redeem`
- `POST /api/human/page/verify`
- `POST /api/human/feed/challenge`
- `POST /api/human/feed/redeem`

### WebSocket

- `/ws/dashboard` 要求 dashboard token
- `/ws/agent` 要求 agent token
- `/ws/food` 要求前端签发的短时 viewer token
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
- food 请求必须带可信代理注入的 `x-amiokay-viewer-id`
- 正常浏览器流量应通过前端同源代理访问
- `POST /api/food/feed` 现在还必须带 `humanToken`，并且 token 只能用于一次投喂

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
