# desktop-agent (macOS + Windows)

桌面端 agent 现在要求显式 token，并默认拒绝非本地明文 `ws://`。

## 环境变量

- `AGENT_SERVER_WS_URL`
- `AGENT_API_TOKEN`
- `AGENT_DEVICE_ID`
- `AGENT_NAME`
- `ALLOW_INSECURE_LOCALHOST`

推荐：

- 生产使用 `wss://.../ws/agent`
- 本地开发如需 `ws://127.0.0.1:3000/ws/agent`，必须显式设置 `ALLOW_INSECURE_LOCALHOST=true`

## 运行

```bash
cd app/desktop-agent
cargo run
```

## 行为变化

- 启动时会读取或保存 `desktop-agent.config.json`
- 配置文件现在会保存：
  - `server_ws_url`
  - `device_id`
  - `api_token`
- websocket 握手会自动附带：

```text
Authorization: Bearer <AGENT_API_TOKEN>
```

- 非本地 `ws://example.com/...` 会在启动前被拒绝
- `/ws/dashboard` 地址会被自动纠正到 `/ws/agent`

## 测试

```bash
cargo test
```
