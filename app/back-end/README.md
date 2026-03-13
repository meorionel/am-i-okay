# Activity Forwarder Backend (Bun + TypeScript)

一个最小可用的“前台应用活动转发服务”后端：

- 接收 agent 上报的前台应用变化事件
- 内存维护每个 `deviceId` 的最新状态（无数据库）
- 内存维护所有 agent 的最近 10 次 app 使用记录
- 实时转发给 dashboard WebSocket 客户端
- 提供健康检查和当前状态查询接口
- 提供基于浏览器指纹的食物投喂计数器（SQLite 持久化）

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

食物计数器数据库默认保存到：

`~/.local/share/amiokay/food.db`

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

返回所有设备当前最新状态，同时附带最近 10 条 app 使用记录：

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
  ],
  "deviceSnapshots": [
    {
      "current": {
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
      },
      "recentActivities": [
        {
          "eventId": "evt_001",
          "ts": "2026-03-11T10:00:00.000Z",
          "deviceId": "macbook-1",
          "platform": "macos",
          "app": {
            "id": "com.google.Chrome",
            "name": "Google Chrome",
            "pid": 123
          },
          "windowTitle": "ChatGPT - Google Chrome",
          "source": "nsworkspace",
          "displayTime": "10:00 AM",
          "summary": "10:00 AM Google Chrome on macbook-1"
        }
      ]
    }
  ],
  "recentActivities": [
    {
      "eventId": "evt_001",
      "ts": "2026-03-11T10:00:00.000Z",
      "deviceId": "macbook-1",
      "platform": "macos",
      "app": {
        "id": "com.google.Chrome",
        "name": "Google Chrome",
        "pid": 123
      },
      "windowTitle": "ChatGPT - Google Chrome",
      "source": "nsworkspace",
      "displayTime": "10:00 AM",
      "summary": "10:00 AM Google Chrome on macbook-1"
    }
  ]
}
```

字段说明：

- `devices`: 每个 device 当前最新一条状态
- `deviceSnapshots`: 每个 device 的当前状态 + 最近 10 条使用记录
- `recentActivities`: 所有 agent 合并后的最近 10 条使用记录，格式类似 `6:30 AM <app> on <device>`

### `GET /api/food`

返回 13 种食物的总投喂数，以及当前请求方指纹对应的个人投喂状态。

指纹来源优先级：

- 请求头 `x-browser-fingerprint`
- 请求体里的 `fingerprint`（仅 `POST /api/food/feed`）
- 服务端根据浏览器请求头生成的哈希值

响应示例：

```json
{
  "foods": [
    {
      "id": 1,
      "emoji": "🍎",
      "totalCount": 12,
      "viewerCount": 3
    }
  ],
  "viewerFingerprint": "9f4d...",
  "fingerprintSource": "derived",
  "databasePath": "/Users/you/.local/share/amiokay/food.db"
}
```

食物 ID 与 emoji 对应关系：

- `1` -> `🍎`
- `2` -> `🍐`
- `3` -> `🍊`
- `4` -> `🍓`
- `5` -> `🍑`
- `6` -> `🥝`
- `7` -> `🥐`
- `8` -> `🍞`
- `9` -> `🍔`
- `10` -> `🍟`
- `11` -> `🍣`
- `12` -> `🧋`
- `13` -> `🍬`

### `POST /api/food/feed`

按“用户指纹 + 食物 ID”切换投喂状态。

同一个指纹在任意时刻只能投喂一种食物：

- 第一次点击某个食物：该食物的 `viewerCount` 变成 `1`
- 再点同一个食物：取消投喂，`viewerCount` 回到 `0`
- 点另一个食物：旧食物自动取消，新食物变成 `1`
- 因此一个用户视角下，13 种食物里最多只有一种 `viewerCount = 1`
- 同一个指纹 3 秒内只能提交一次，超出时接口返回 `429`

请求示例：

```json
{
  "id": 1
}
```

也支持：

```json
{
  "foodId": 1,
  "fingerprint": "custom-browser-fingerprint"
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
    "devices": [],
    "deviceSnapshots": [],
    "recentActivities": []
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
