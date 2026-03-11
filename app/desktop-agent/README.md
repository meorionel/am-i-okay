# desktop-agent (macOS + Windows)

一个支持 macOS / Windows 的后台常驻 Rust Agent：监听当前前台应用切换事件，并通过 WebSocket 实时上报到后端。

## 功能

- 监听前台应用切换
  - macOS：`NSWorkspaceDidActivateApplicationNotification` + polling fallback
  - Windows：`SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` 事件回调
- 采集应用信息：`name` / `id` / `pid`
- 按固定协议发送 JSON 到后端 WebSocket
- 断线自动重连
- 简单去重：连续相同 `app id + pid` 不重复发送
- 简单日志输出（`tracing`）

## 平台支持

当前支持：
- **macOS**
- **Windows**

## 环境变量

- `AGENT_SERVER_WS_URL`
  - 作为启动交互的默认值
  - 默认值：`ws://127.0.0.1:3000/ws/agent`
- `AGENT_DEVICE_ID`
  - 未提供时自动使用主机名
  - 若主机名不可用，按平台回退为 `macos-agent` / `windows-agent`

## 运行

```bash
cd app/desktop-agent
cargo run
```

启动后会要求输入后端地址，支持以下形式：

- `ws://127.0.0.1:3000`
- `wss://example.com`
- `http://127.0.0.1:3000`
- `https://example.com`

程序会自动规范成 `/ws/agent` 地址。

## 事件消息格式

Agent 发送到后端的消息结构：

```json
{
  "type": "activity",
  "payload": {
    "eventId": "uuid",
    "ts": "2026-03-11T10:00:00.000Z",
    "deviceId": "my-mac",
    "platform": "windows",
    "kind": "foreground_changed",
    "app": {
      "id": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "name": "chrome.exe",
      "pid": 4321
    },
    "windowTitle": "Inbox - Gmail - Google Chrome",
    "source": "setwineventhook"
  }
}
```

## 当前限制

- macOS 当前 `app.title` 为应用显示名，不是窗口标题
- 无本地持久化
- 无 LaunchAgent 自启动
- 无鉴权与复杂协议
