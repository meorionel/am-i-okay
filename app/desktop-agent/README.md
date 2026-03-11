# desktop-agent (macOS MVP)

一个仅支持 macOS 的后台常驻 Rust Agent：监听当前前台应用切换事件，并通过 WebSocket 实时上报到后端。

## 功能

- 监听前台应用切换（`NSWorkspaceDidActivateApplicationNotification`）
- 采集应用信息：`name` / `bundle id` / `pid`
- 按固定协议发送 JSON 到后端 WebSocket
- 断线自动重连
- 简单去重：连续相同 `bundle id + pid` 不重复发送
- 简单日志输出（`tracing`）

## 平台支持

当前仅支持 **macOS**。

## 环境变量

- `AGENT_SERVER_WS_URL`
  - 默认值：`ws://127.0.0.1:3000/ws/agent`
- `AGENT_DEVICE_ID`
  - 未提供时自动使用主机名
  - 若主机名不可用，回退为 `macos-agent`

## 运行

```bash
cd app/desktop-agent
cargo run
```

## 事件消息格式

Agent 发送到后端的消息结构：

```json
{
  "type": "activity",
  "payload": {
    "eventId": "uuid",
    "ts": "2026-03-11T10:00:00.000Z",
    "deviceId": "my-mac",
    "platform": "macos",
    "kind": "foreground_changed",
    "app": {
      "id": "com.google.Chrome",
      "name": "Google Chrome",
      "pid": 123
    },
    "source": "nsworkspace"
  }
}
```

## 当前限制

- 无窗口标题采集（当前不发送 `windowTitle` 字段）
- 无本地持久化
- 无 LaunchAgent 自启动
- 无鉴权与复杂协议
