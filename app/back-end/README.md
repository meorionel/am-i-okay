# Activity Forwarder Backend (Bun + TypeScript)

一个最小可用的“前台应用活动转发服务”后端：

- 接收 agent 上报的前台应用变化事件
- 内存维护每个 `deviceId` 的最新状态（无数据库）
- 实时转发给 dashboard WebSocket 客户端
- 提供健康检查和当前状态查询接口

## 安装依赖

```bash
bun install
```

## 启动

开发模式（watch）：

```bash
bun run dev
```

生产启动：

```bash
bun run start
```

默认监听：`0.0.0.0:3000`

可通过环境变量覆盖：

- `HOST`（默认 `0.0.0.0`）
- `PORT`（默认 `3000`）

## 脚本

- `bun run dev`: 使用 Bun watch 启动服务
- `bun run start`: 启动服务
- `bun run typecheck`: TypeScript 类型检查

## HTTP 接口

### `GET /health`

响应：

```json
{ "ok": true }
```

### `GET /api/current`

返回所有设备当前最新状态：

```json
{
  "devices": [
    {
      "eventId": "evt_001",
      "ts": "2026-03-11T10:00:00.000Z",
      "deviceId": "macbook-1",
      "platform": "macos",
      "kind": "foreground_changed",
      "app": {
        "id": "com.google.Chrome",
        "name": "Google Chrome",
        "pid": 123
      },
      "windowTitle": "ChatGPT - Google Chrome",
      "source": "nsworkspace"
    }
  ]
}
```

## WebSocket

### 1) Agent 连接

- 路径：`/ws/agent`
- agent 向服务端发送消息格式：

```json
{
  "type": "activity",
  "payload": {
    "eventId": "evt_001",
    "ts": "2026-03-11T10:00:00.000Z",
    "deviceId": "macbook-1",
    "platform": "macos",
    "kind": "foreground_changed",
    "app": {
      "id": "com.google.Chrome",
      "name": "Google Chrome",
      "pid": 123
    },
    "windowTitle": "ChatGPT - Google Chrome",
    "source": "nsworkspace"
  }
}
```

服务端会对消息做运行时校验。非法消息会返回：

```json
{
  "type": "error",
  "payload": {
    "message": "..."
  }
}
```

### 2) Dashboard 连接

- 路径：`/ws/dashboard`
- 连接成功后立即收到快照：

```json
{
  "type": "snapshot",
  "payload": {
    "devices": []
  }
}
```

- 任意 agent 上报后，dashboard 实时收到：

```json
{
  "type": "activity",
  "payload": {
    "eventId": "evt_001",
    "ts": "2026-03-11T10:00:00.000Z",
    "deviceId": "macbook-1",
    "platform": "macos",
    "kind": "foreground_changed",
    "app": {
      "id": "com.google.Chrome",
      "name": "Google Chrome",
      "pid": 123
    },
    "windowTitle": "ChatGPT - Google Chrome",
    "source": "nsworkspace"
  }
}
```

## 项目结构

```text
src/
  index.ts      # Bun HTTP + WebSocket 入口
  types.ts      # 核心类型与消息协议
  schema.ts     # 运行时校验（JSON/message/event）
  store.ts      # 内存状态管理（deviceId -> latest event）
  ws.ts         # WS 连接管理与实时广播
  utils.ts      # 通用工具（JSON 响应、消息转换）
```
