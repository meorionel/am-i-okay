# Android Agent

Android agent 现在要求：

- 配置 backend URL
- 配置 agent name
- 配置 agent API token
- 生产默认仅允许 `https://` / `wss://`
- 仅 debug 且 host 为 `localhost` / `127.0.0.1` / `10.0.2.2` 时允许明文

## 运行

```bash
cd app/android-agent
./gradlew assembleDebug
```

## 配置与安全行为

- `Start Agent` 前会校验：
  - URL 非空
  - agent name 非空
  - agent API token 非空
  - URL scheme 合法
  - 非本地场景不得使用 `http://` 或 `ws://`
- 前台服务会读取保存的 token，并在 websocket 握手时发送：

```text
Authorization: Bearer <agent-token>
```

- release manifest 默认：
  - `usesCleartextTraffic="false"`
- debug manifest 仅对本地开发目标开放 cleartext

## 说明

- 输入 `http://10.0.2.2:3000` 会在 debug 模式下转换并连接 `ws://10.0.2.2:3000/ws/agent`
- 输入 `https://example.com` 会连接 `wss://example.com/ws/agent`
- 如果 URL 路径不是 `/ws/agent`，服务会自动补齐
