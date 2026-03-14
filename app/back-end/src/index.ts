import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  text,
} from "@clack/prompts";
import {
  getConfigFilePath,
  getConfigSummary,
  loadStoredConfig,
  parseAllowedOriginsInput,
  saveStoredConfig,
  type StoredAgentConfig,
  type AgentPlatform,
  type RuntimeEnvironment,
  type StoredBackendConfig,
} from "./config";
import { startServer } from "./server";

type MainAction =
  | "toggle-server"
  | "logs"
  | "configure-server"
  | "configure-agent"
  | "view"
  | "exit";

type AgentAction = "list" | "add" | "edit" | "remove" | "back";

class ReturnToMainMenuError extends Error {
  constructor() {
    super("RETURN_TO_MAIN_MENU");
  }
}

function hasSetRawMode(
  stream: NodeJS.ReadStream,
): stream is NodeJS.ReadStream & { setRawMode: (mode: boolean) => void } {
  return typeof (stream as NodeJS.ReadStream & { setRawMode?: unknown }).setRawMode === "function";
}

function unwrapPrompt<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("已取消操作。");
    process.exit(0);
  }

  return value;
}

function unwrapSubmenuPrompt<T>(value: T | symbol): T {
  if (isCancel(value)) {
    throw new ReturnToMainMenuError();
  }

  return value;
}

async function waitForReturnKey(): Promise<void> {
  if (!process.stdin.isTTY || !hasSetRawMode(process.stdin)) {
    await new Promise<void>((resolve) => {
      const handleData = (chunk: Buffer | string) => {
        const input = String(chunk).toLowerCase();
        if (input.includes("q")) {
          process.stdin.off("data", handleData);
          resolve();
        }
      };

      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", handleData);
    });
    return;
  }

  await new Promise<void>((resolve) => {
    const stdin = process.stdin;
    const previousRawMode = stdin.isRaw;

    const cleanup = () => {
      stdin.off("data", handleData);
      stdin.pause();
      stdin.setRawMode(previousRawMode ?? false);
    };

    const handleData = (chunk: Buffer | string) => {
      const input = String(chunk).toLowerCase();

      if (input === "\u0003") {
        cleanup();
        process.exit(0);
      }

      if (input === "q") {
        cleanup();
        resolve();
      }
    };

    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.on("data", handleData);
  });
}

async function openLogsPage(config: StoredBackendConfig): Promise<void> {
  note(getConfigSummary(config), "启动配置");
  log.info("日志页面已打开，按 q 返回主菜单。");

  const server = startServer(config);

  try {
    await waitForReturnKey();
  } finally {
    server.stop(true);
    log.success("后端服务已停止，已返回主菜单。");
  }
}

function validateRequired(label: string, value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return `${label}不能为空`;
  }

  return undefined;
}

function validatePort(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return "端口不能为空";
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return "端口必须是 1 到 65535 之间的整数";
  }

  return undefined;
}

async function promptText(message: string, initialValue: string): Promise<string> {
  const value = await text({
    message,
    initialValue,
    validate: (input) => validateRequired(message, input),
  });
  return unwrapSubmenuPrompt(value);
}

async function promptServerConfig(
  config: StoredBackendConfig,
): Promise<StoredBackendConfig> {
  const env = await select<RuntimeEnvironment>({
    message: "请选择运行环境",
    initialValue: config.env,
    options: [
      { value: "development", label: "开发环境", hint: "本地调试" },
      { value: "production", label: "生产环境", hint: "严格校验" },
    ],
  });
  const nextEnv = unwrapSubmenuPrompt(env);

  const host = await promptText("请输入监听地址", config.host);

  const portValue = await text({
    message: "请输入监听端口",
    initialValue: String(config.port),
    validate: validatePort,
  });
  const nextPortValue = unwrapSubmenuPrompt(portValue);

  const dashboardToken = await text({
    message: "请输入 Dashboard Token",
    initialValue: config.dashboardToken,
    validate: (input) => {
      if (env === "production") {
        return validateRequired("Dashboard Token", input);
      }
      return undefined;
    },
  });
  const nextDashboardToken = unwrapSubmenuPrompt(dashboardToken);

  const allowedOriginsValue = await text({
    message: "请输入允许的来源，多个用逗号分隔",
    initialValue: config.allowedOrigins.join(","),
    validate: (input) => {
      try {
        parseAllowedOriginsInput(nextEnv, input ?? "");
        return undefined;
      } catch (error) {
        return error instanceof Error ? error.message : "允许来源配置无效";
      }
    },
  });
  const nextAllowedOriginsValue = unwrapSubmenuPrompt(allowedOriginsValue);

  const allowInsecureLocalhost = await confirm({
    message: "是否允许 localhost 使用明文连接",
    initialValue: config.allowInsecureLocalhost,
    active: "允许",
    inactive: "不允许",
  });
  const nextAllowInsecureLocalhost = unwrapSubmenuPrompt(allowInsecureLocalhost);

  return {
    ...config,
    env: nextEnv,
    host: host.trim(),
    port: Number(nextPortValue),
    dashboardToken: nextDashboardToken.trim(),
    allowedOrigins: parseAllowedOriginsInput(nextEnv, nextAllowedOriginsValue),
    allowInsecureLocalhost: nextAllowInsecureLocalhost,
  };
}

async function promptDefaultAgentConfig(
  initialAgent?: StoredAgentConfig,
): Promise<StoredAgentConfig> {
  const token = await text({
    message: "请输入 Agent Token",
    initialValue: initialAgent?.token ?? "",
    validate: (input) => validateRequired("Agent Token", input),
  });
  const nextToken = unwrapSubmenuPrompt(token);

  const deviceId = await promptText(
    "请输入 Agent 设备 ID",
    initialAgent?.deviceId ?? "",
  );
  const agentName = await promptText(
    "请输入 Agent 名称",
    initialAgent?.agentName ?? "desktop-agent",
  );

  const platform = await select<AgentPlatform | "">({
    message: "请选择 Agent 平台",
    initialValue: initialAgent?.platform ?? "",
    options: [
      { value: "", label: "未设置", hint: "可选" },
      { value: "macos", label: "macOS" },
      { value: "windows", label: "Windows" },
      { value: "android", label: "Android" },
    ],
  });
  const nextPlatform = unwrapSubmenuPrompt(platform);

  return {
    token: nextToken.trim(),
    deviceId: deviceId.trim(),
    agentName: agentName.trim(),
    platform: nextPlatform,
  };
}

function getAgentOptions(agents: StoredAgentConfig[]) {
  return agents.map((agent, index) => ({
    value: index,
    label: `${agent.agentName} (${agent.deviceId})`,
    hint: `token=${agent.token} platform=${agent.platform || "未设置"}`,
  }));
}

async function promptAgentMenu(
  config: StoredBackendConfig,
): Promise<StoredBackendConfig> {
  let nextConfig = config;

  while (true) {
    const action = await select<AgentAction>({
      message: "请选择 Agent 配置项",
      options: [
        { value: "list", label: "查看 Agent 列表" },
        { value: "add", label: "添加 Agent" },
        {
          value: "edit",
          label: "编辑 Agent",
          hint: nextConfig.agents.length > 0 ? "修改已有 Agent" : "暂无 Agent",
          disabled: nextConfig.agents.length === 0,
        },
        {
          value: "remove",
          label: "删除 Agent",
          hint: nextConfig.agents.length > 0 ? "移除已有 Agent" : "暂无 Agent",
          disabled: nextConfig.agents.length === 0,
        },
        { value: "back", label: "返回上一级" },
      ],
    });
    const nextAction = unwrapSubmenuPrompt(action);

    if (nextAction === "back") {
      return nextConfig;
    }

    if (nextAction === "list") {
      note(
        nextConfig.agents.length > 0
          ? nextConfig.agents
              .map(
                (agent, index) =>
                  `${index + 1}. ${agent.agentName}\nToken: ${agent.token}\n设备 ID: ${agent.deviceId}\n平台: ${agent.platform || "未设置"}`,
              )
              .join("\n\n")
          : "当前还没有 Agent。",
        "Agent 列表",
      );
      continue;
    }

    if (nextAction === "add") {
      const agent = await promptDefaultAgentConfig();
      nextConfig = {
        ...nextConfig,
        agents: [...nextConfig.agents, agent],
      };
      await saveStoredConfig(nextConfig);
      log.success("Agent 已添加。");
      continue;
    }

    if (nextAction === "edit") {
      const agentIndex = await select<number>({
        message: "请选择要编辑的 Agent",
        options: getAgentOptions(nextConfig.agents),
      });
      const nextAgentIndex = unwrapSubmenuPrompt(agentIndex);
      const updatedAgent = await promptDefaultAgentConfig(
        nextConfig.agents[nextAgentIndex],
      );
      nextConfig = {
        ...nextConfig,
        agents: nextConfig.agents.map((agent, index) =>
          index === nextAgentIndex ? updatedAgent : agent,
        ),
      };
      await saveStoredConfig(nextConfig);
      log.success("Agent 已更新。");
      continue;
    }

    const agentIndex = await select<number>({
      message: "请选择要删除的 Agent",
      options: getAgentOptions(nextConfig.agents),
    });
    const nextAgentIndex = unwrapSubmenuPrompt(agentIndex);
    const shouldClear = await confirm({
      message: `确定要删除 Agent「${nextConfig.agents[nextAgentIndex]?.agentName ?? ""}」吗`,
      initialValue: false,
      active: "确定",
      inactive: "取消",
    });
    const nextShouldClear = unwrapSubmenuPrompt(shouldClear);

    if (nextShouldClear) {
      nextConfig = {
        ...nextConfig,
        agents: nextConfig.agents.filter((_, index) => index !== nextAgentIndex),
      };
      await saveStoredConfig(nextConfig);
      log.success("Agent 已删除。");
    }
  }
}

async function main(): Promise<void> {
  intro("后端 CLI 控制台");

  let config = await loadStoredConfig();
  log.info(`配置文件位置：${getConfigFilePath()}`);

  while (true) {
    const action = await select<MainAction>({
      message: "请选择操作",
      options: [
        {
          value: "toggle-server",
          label: `后端服务（当前：${config.serverEnabled ? "开启" : "关闭"}）`,
          hint: "仅切换是否允许启动",
        },
        {
          value: "logs",
          label: "进入日志页面",
          hint: config.serverEnabled ? "启动后端并查看日志" : "请先开启后端服务",
          disabled: !config.serverEnabled,
        },
        { value: "configure-server", label: "配置服务参数" },
        { value: "configure-agent", label: "配置 Agent" },
        { value: "view", label: "查看当前配置" },
        { value: "exit", label: "退出" },
      ],
    });
    const nextAction = unwrapPrompt(action);

    if (nextAction === "exit") {
      outro("已退出后端 CLI。");
      return;
    }

    if (nextAction === "view") {
      note(getConfigSummary(config), "当前配置");
      continue;
    }

    if (nextAction === "toggle-server") {
      config = {
        ...config,
        serverEnabled: !config.serverEnabled,
      };
      await saveStoredConfig(config);
      log.success(`后端服务已${config.serverEnabled ? "开启" : "关闭"}。`);
      continue;
    }

    if (nextAction === "logs") {
      await openLogsPage(config);
      continue;
    }

    if (nextAction === "configure-server") {
      try {
        config = await promptServerConfig(config);
        await saveStoredConfig(config);
        log.success("服务配置已保存。");
      } catch (error) {
        if (error instanceof ReturnToMainMenuError) {
          log.step("已取消服务配置，返回主菜单。");
          continue;
        }

        throw error;
      }
      continue;
    }

    if (nextAction === "configure-agent") {
      try {
        config = await promptAgentMenu(config);
      } catch (error) {
        if (error instanceof ReturnToMainMenuError) {
          log.step("已取消 Agent 配置，返回主菜单。");
          continue;
        }

        throw error;
      }
      continue;
    }
  }
}

void main().catch((error) => {
  cancel(error instanceof Error ? error.message : "后端启动失败");
  process.exit(1);
});
