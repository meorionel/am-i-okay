# Android Agent MVP

## 1. 项目用途
`android-agent` 是一个 Android 端常驻 Agent 的 MVP，实现移动端后台前台服务运行能力，为后续“采集当前前台应用信息并上报后端”打基础。

## 2. 当前 MVP 功能
- 单页面 Compose UI
- 输入并保存 `backendUrl`（DataStore）
- `Start Agent` 按钮：校验 URL（`trim` 后非空，且需 `http://`、`https://`、`ws://` 或 `wss://` 开头）
- `Stop Agent` 按钮：停止服务
- Foreground Service 常驻运行
- 启动后显示常驻通知（`Activity Agent Running`）
- 启动后自动将 `backendUrl` 转换为 WebSocket 地址并连接后端 `/ws/agent`
- 连接建立后仅在检测到前台应用变化时发送一次 activity 消息
- 前台应用识别使用 `AccessibilityService`
- 熄屏后会主动断开 WebSocket 并暂停前台应用变化采集，亮屏后恢复采集并允许重连
- 点击 `Stop Agent` 时主动关闭 WebSocket 连接
- 页面显示：
  - 服务是否运行
  - WebSocket 连接状态
  - 当前已保存的后端 URL
- 预留 `ActivityMonitor` 扩展点（TODO）

## 3. 如何运行
1. 在 Android Studio 中打开目录：`app/android-agent`
2. 等待 Gradle Sync 完成
3. 使用真机或模拟器运行 `app` 模块
4. 首次运行若系统请求通知权限，请允许（Android 13+）
5. 进入 `Open Accessibility Settings`，在系统辅助功能里启用 `Android Agent Accessibility`

命令行也可在模块目录运行：

```bash
cd app/android-agent
./gradlew assembleDebug
```

## 4. 启动按钮逻辑
`Start Agent` 点击流程：
1. 读取输入框 URL
2. 执行 `trim()`
3. 校验是否为空
4. 校验是否以 `http://`、`https://`、`ws://` 或 `wss://` 开头
5. 校验通过后保存到 DataStore
6. 发送 `ACTION_START` 启动前台服务
7. 服务读取已保存 URL 并连接 `/ws/agent`
8. 辅助功能服务捕获前台窗口变化
9. 前台服务仅在检测到应用变化时上报一次

如果校验失败：
- 不启动服务
- 页面显示明确提示（Snackbar）

## 5. backend URL 必填规则
- 必填：`trim` 后不能为空
- 当前基础格式要求：必须以 `http://`、`https://`、`ws://` 或 `wss://` 开头

## 6. 前台服务通知说明
- 服务：`AgentForegroundService`
- 启动 action：`ACTION_START`
- 停止 action：`ACTION_STOP`
- Notification Channel：`activity_agent_channel`
- 通知标题：`Activity Agent Running`
- 通知文案：`Monitoring app activity in background`
- 服务类型：`dataSync`
- 停止时会主动关闭 WebSocket 连接，再移除前台通知并结束服务

## 7. backend URL 到 WebSocket 地址的转换规则
- 输入 `http://host:3000` 会连接到 `ws://host:3000/ws/agent`
- 输入 `https://host` 会连接到 `wss://host/ws/agent`
- 输入 `ws://host:3000/ws/agent` 会直接连接该地址
- 输入 `wss://host/ws/agent` 会直接连接该地址
- 如果输入路径不是 `/ws/agent`，当前实现会在原路径后追加 `/ws/agent`

## 8. 当前未实现内容（后续扩展）
- 复杂重试/断线恢复策略
- 电池优化适配与厂商保活策略

目前已在 `monitor/ActivityMonitor.kt` 和 `service/AgentForegroundService.kt` 中预留 TODO 扩展点。当前前台应用变化检测已切换为 `AccessibilityService`。
