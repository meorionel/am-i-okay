# Dashboard Stream Logic Layer (Next.js + TypeScript)

这个前端子项目只实现“设备前台应用活动流”的数据逻辑层，不包含 UI 组件和页面布局。

核心能力：

- 初始化拉取 `GET /api/current`
- 建立 `ws://<server>/ws/dashboard` 实时连接
- 处理 `snapshot` / `activity` / `error` 消息
- 在前端维护设备最新状态（`Record<string, ActivityEvent>`）
- 暴露 `useDashboardStream()` 给 UI 层使用

## 目录结构

```txt
src/
  types/
    activity.ts
  lib/
    api.ts
    env.ts
    ws.ts
    format.ts
  hooks/
    use-dashboard-stream.ts
```

## 环境变量

复制 `.env.example` 到 `.env.local` 后按需修改：

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_WS_BASE_URL=ws://127.0.0.1:3000
```

默认值：

- `NEXT_PUBLIC_API_BASE_URL`: `http://127.0.0.1:3000`
- `NEXT_PUBLIC_WS_BASE_URL`: `ws://127.0.0.1:3000`

## 运行方式

```bash
bun install
bun run dev
```

可选检查：

```bash
bun run typecheck
bun run lint
```

## Hook 使用示例

```tsx
"use client";

import { useDashboardStream } from "@/src/hooks/use-dashboard-stream";

export function DashboardDataConsumer() {
	const { devices, connectionStatus, lastEventAt } = useDashboardStream();

	// devices 已按 ts 倒序排序
	console.log(devices, connectionStatus, lastEventAt);

	return null;
}
```

## 设计说明

- HTTP / WS / JSON 解析错误都在内部吞掉并记录，不会抛出导致应用崩溃。
- WebSocket 断开后每 2 秒自动重连。
- `useDashboardStream()` 返回：
    - `devices: ActivityEvent[]`
    - `connectionStatus: "connecting" | "connected" | "disconnected" | "error"`
    - `lastEventAt: number | null`
