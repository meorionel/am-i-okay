# am-i-okay

> 前排提醒, 本项目完全由 AI 编写, 本人只是做了一些样式和文案的修改, 如果你也想部署一个, 请询问 AI 如何使用.
>
> 包括这个 README.md 也是 AI 写的.

## 这是什么?

这是一个可以让所有人看到我的设备在做什么的工具 (~~邀请所有人视奸我~~)

## 项目结构

```text
app/
  back-end/       Bun + TypeScript 实时转发服务
  front-end/      Next.js Dashboard
  desktop-agent/  Rust 桌面常驻 Agent(macOS / Windows)
  android-agent/  Android 常驻 Agent(Compose + Foreground Service)
demo.html         静态界面草稿
```

## 这是什么

这个项目在做一件很具体的事: 把"设备现在正在用什么 App、设备想展示什么状态"实时汇总到一个中央面板里.

当前实现里, Dashboard 主要展示:

- 当前在线访客数
- 最近一次设备状态文本
- 当前活跃设备列表
- 最近活动时间线
- WebSocket 连接状态和最后更新时间
- 可选的食物投喂计数器（后端已提供持久化接口）

Agent 当前会上报两类消息:

- `activity`: 前台应用发生变化
- `status`: 设备状态文本

## 端到端数据流

```text
desktop-agent / android-agent
  -> WebSocket /ws/agent
  -> back-end 内存状态
  -> HTTP GET /api/current
  -> WebSocket /ws/dashboard
  -> front-end Dashboard
```

细一点的流程是:

1. Dashboard 首屏先请求 `GET /api/current` 获取快照.
2. 同时建立 `/ws/dashboard` 长连接接收 `snapshot`、`activity`、`status`、`error` 消息.
3. Agent 连接 `/ws/agent` 后持续上报设备事件.
4. 后端将每个 `deviceId` 的最新事件保存在内存里, 并维护最近 10 条活动记录.
5. 当 Agent 断开时, 后端会把该连接关联的设备从当前设备列表中移除, 并向 Dashboard 广播最新快照.

## 子项目说明

### `app/back-end`

技术栈: Bun + TypeScript

职责:

- 提供 `GET /health`
- 提供 `GET /api/current`
- 提供 `/ws/agent` 供 Agent 上报
- 提供 `/ws/dashboard` 供前端实时订阅
- 做基础 JSON / 消息协议校验
- 用内存维护最新设备状态、最新状态文本和最近活动
- 用 SQLite 持久化食物投喂计数（按浏览器指纹区分用户）

特点:

- 无数据库
- 无鉴权
- 断开 Agent 后自动从当前设备列表移除
- 适合本地联调和原型验证

### `app/front-end`

技术栈: Next.js 16 + React 19 + TypeScript

职责:

- 拉取后端当前快照
- 订阅 Dashboard WebSocket
- 在前端合并、去重、排序设备活动
- 渲染 Dashboard UI
- 通过 Next.js Route Handler 代理后端 SSE 在线人数接口 `/api/online`

当前界面不是管理后台风格, 而是一个偏产品展示感的单页实时看板.

### `app/desktop-agent`

技术栈: Rust + Tokio + tokio-tungstenite

支持平台:

- macOS
- Windows

职责:

- 监听系统前台应用切换
- 采集 `app id / app name / pid`
- 通过 WebSocket 上报到后端
- 简单去重, 避免连续相同应用重复上报
- 自动重连

平台实现:

- macOS: `NSWorkspaceDidActivateApplicationNotification` + polling fallback
- Windows: `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)`

### `app/android-agent`

技术栈: Kotlin + Jetpack Compose + Foreground Service + AccessibilityService

职责:

- 提供 Android 端配置页面
- 保存后端地址、Agent 名称和状态文本
- 启动前台服务常驻运行
- 监听前台应用变化
- 建立到后端的 WebSocket 连接
- 连接建立后先上报 `status`, 之后在前台应用变化时上报 `activity`

当前实现特点:

- 依赖辅助功能服务识别前台应用
- 熄屏时暂停采集并主动断开连接, 亮屏后允许重连
- 仅在应用变化时发送一次 activity

## 快速启动

建议至少启动两部分:

1. `back-end`
2. `front-end`

如果要看到真实设备数据, 再额外启动 `desktop-agent` 或 `android-agent`.

### 1. 启动后端

```bash
cd app/back-end
bun install
bun run dev
```

默认地址:

- HTTP: `http://127.0.0.1:3000`
- WebSocket: `ws://127.0.0.1:3000`

### 2. 启动前端

```bash
cd app/front-end
bun install
bun run dev
```

如需显式指定后端地址, 配置环境变量:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_WS_BASE_URL=ws://127.0.0.1:3000
```

前端默认也会回退到上面这两个本地地址.

### 3. 启动桌面 Agent

```bash
cd app/desktop-agent
cargo run
```

启动时会交互式要求输入:

- 后端地址
- 当前设备名称

也可以通过环境变量提供默认值:

```bash
AGENT_SERVER_WS_URL=ws://127.0.0.1:3000/ws/agent
AGENT_DEVICE_ID=my-mac
AGENT_NAME=desktop-agent
```

### 4. 启动 Android Agent

在 Android Studio 中打开 `app/android-agent`, 运行 `app` 模块.

首次运行后需要:

1. 允许通知权限(Android 13+)
2. 打开辅助功能设置
3. 启用 `Android Agent Accessibility`

也可以命令行构建:

```bash
cd app/android-agent
./gradlew assembleDebug
```

## 主要接口

### HTTP

- `GET /health`
- `GET /api/current`

`/api/current` 当前返回:

- `devices`: 每个设备当前最新活动
- `latestStatus`: 最近一次设备状态文本
- `deviceSnapshots`: 每个设备当前状态 + 最近活动
- `recentActivities`: 全局最近 10 条活动

### WebSocket

- `/ws/agent`
  Agent 写入连接, 消息类型为 `activity` / `status`
- `/ws/dashboard`
  Dashboard 只读连接, 消息类型为 `snapshot` / `activity` / `status` / `error`
