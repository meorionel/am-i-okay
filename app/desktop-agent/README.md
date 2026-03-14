# desktop-agent (macOS + Windows)

桌面端 agent 现在要求显式 token。

## 环境变量

- `AGENT_SERVER_WS_URL`
- `AGENT_API_TOKEN`
- `AGENT_DEVICE_ID`
- `AGENT_NAME`

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
  - `agent_name`
  - `api_token`
- websocket 握手会自动附带：

```text
Authorization: Bearer <AGENT_API_TOKEN>
```
- `/ws/dashboard` 地址会被自动纠正到 `/ws/agent`

## 测试

```bash
cargo test
```
