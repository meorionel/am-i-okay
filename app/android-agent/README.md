# Android Agent

Android agent 现在要求：

- 配置 backend URL
- 配置 device ID
- 配置 agent name
- 配置 agent API token

## 运行

```bash
cd app/android-agent
./gradlew assembleDebug
```

## 配置与安全行为

- `Start Agent` 前会校验：
  - URL 非空
  - device ID 非空
  - agent name 非空
  - agent API token 非空
  - URL scheme 合法
- 前台服务会读取保存的 token，并在 websocket 握手时发送：

```text
Authorization: Bearer <agent-token>
```

- Android 现在允许 `http://` 和 `ws://`

## 说明

- 输入 `http://10.0.2.2:3000` 会转换并连接 `ws://10.0.2.2:3000`
- 输入 `https://example.com/custom/socket` 会连接 `wss://example.com/custom/socket`
- 服务会保留你填写的 URL 路径，不再自动补 `/ws/agent`
