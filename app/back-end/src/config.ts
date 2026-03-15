import { fileURLToPath } from "node:url";

export type RuntimeEnvironment = "development" | "production";
export type AgentPlatform = "macos" | "windows" | "android";

export interface AgentIdentityBinding {
  token: string;
  deviceId: string;
  agentName: string;
  platform?: AgentPlatform;
}

export interface StoredAgentConfig {
  token: string;
  deviceId: string;
  agentName: string;
  platform: AgentPlatform | "";
}

export interface SecurityConfig {
  env: RuntimeEnvironment;
  dashboardToken: string;
  allowedOrigins: string[];
  allowInsecureLocalhost: boolean;
  agentBindings: Map<string, AgentIdentityBinding>;
  humanGateEnabled: boolean;
}

export interface StoredBackendConfig {
  serverEnabled: boolean;
  env: RuntimeEnvironment;
  host: string;
  port: number;
  dashboardToken: string;
  allowedOrigins: string[];
  allowInsecureLocalhost: boolean;
  agents: StoredAgentConfig[];
}

interface AgentBindingRecord {
  deviceId?: unknown;
  agentName?: unknown;
  platform?: unknown;
}

const CONFIG_FILE_PATH = fileURLToPath(
  new URL("../back-end.config.json", import.meta.url),
);

function asNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value.trim();
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asOriginList(value: unknown): string | string[] | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  ) {
    return value;
  }

  return undefined;
}

function parsePort(value: unknown): number {
  const raw = typeof value === "number" ? String(value) : asOptionalString(value);
  const port = Number(raw ?? "3000");

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}

function parseAllowedOrigins(
  env: RuntimeEnvironment,
  rawValue: string | string[] | undefined,
): string[] {
  const fallbackOrigins =
    env === "development"
      ? ["http://127.0.0.1:3001", "http://localhost:3001"]
      : [];

  const values =
    typeof rawValue === "string"
      ? rawValue.split(",")
      : Array.isArray(rawValue)
        ? rawValue
        : [];

  const parsed = values
    .map((origin) => (typeof origin === "string" ? origin.trim() : ""))
    .filter((origin) => origin.length > 0);

  const origins = parsed.length > 0 ? parsed : fallbackOrigins;

  if (env === "production" && origins.length === 0) {
    throw new Error("ALLOWED_ORIGINS is required in production");
  }

  for (const origin of origins) {
    let url: URL;

    try {
      url = new URL(origin);
    } catch {
      throw new Error(`ALLOWED_ORIGINS contains invalid origin: ${origin}`);
    }

    if (url.pathname !== "/" || url.search || url.hash) {
      throw new Error(
        `ALLOWED_ORIGINS entries must be origin-only values: ${origin}`,
      );
    }
  }

  return origins;
}

function parseBindingRecord(
  token: string,
  record: AgentBindingRecord,
): AgentIdentityBinding {
  const binding: AgentIdentityBinding = {
    token,
    deviceId: asNonEmptyString(record.deviceId, `binding ${token}.deviceId`),
    agentName: asNonEmptyString(record.agentName, `binding ${token}.agentName`),
  };

  if (record.platform !== undefined) {
    const platform = asNonEmptyString(
      record.platform,
      `binding ${token}.platform`,
    );

    if (platform !== "macos" && platform !== "windows" && platform !== "android") {
      throw new Error(`binding ${token}.platform must be macos/windows/android`);
    }

    binding.platform = platform;
  }

  return binding;
}

function normalizePlatform(value: unknown): AgentPlatform | "" {
  return value === "macos" || value === "windows" || value === "android"
    ? value
    : "";
}

function normalizeAgent(raw: unknown, index: number): StoredAgentConfig {
  const source = isRecord(raw) ? raw : {};

  return {
    token: asOptionalString(source.token) ?? `agent-${index + 1}`,
    deviceId: asOptionalString(source.deviceId) ?? `agent-device-${index + 1}`,
    agentName: asOptionalString(source.agentName) ?? "desktop-agent",
    platform: normalizePlatform(source.platform),
  };
}

function parseLegacyAgentBindings(rawValue: unknown): StoredAgentConfig[] {
  const rawBindings = asOptionalString(rawValue);
  if (!rawBindings) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBindings);
  } catch {
    return [];
  }

  if (!isRecord(parsed)) {
    return [];
  }

  return Object.entries(parsed).map(([token, value], index) => {
    const agent = normalizeAgent(value, index);
    return {
      ...agent,
      token,
    };
  });
}

function normalizeAgents(source: Record<string, unknown>): StoredAgentConfig[] {
  if (Array.isArray(source.agents)) {
    return source.agents.map((agent, index) => normalizeAgent(agent, index));
  }

  const legacyBindings = parseLegacyAgentBindings(source.agentTokenBindings);
  if (legacyBindings.length > 0) {
    return legacyBindings;
  }

  const legacyToken = asOptionalString(source.agentApiToken);
  if (!legacyToken) {
    return [];
  }

  return [
    {
      token: legacyToken,
      deviceId: asOptionalString(source.agentAllowedDeviceId) ?? "local-agent",
      agentName: asOptionalString(source.agentAllowedAgentName) ?? "desktop-agent",
      platform: normalizePlatform(source.agentAllowedPlatform),
    },
  ];
}

function parseAgentBindings(
  env: RuntimeEnvironment,
  config: StoredBackendConfig,
): Map<string, AgentIdentityBinding> {
  const bindings = new Map<string, AgentIdentityBinding>();

  for (const agent of config.agents) {
    const token = agent.token.trim();
    if (!token) {
      throw new Error("agent token must be a non-empty string");
    }

    if (bindings.has(token)) {
      throw new Error(`duplicate agent token binding for ${token}`);
    }

    bindings.set(
      token,
      parseBindingRecord(token, {
        deviceId: agent.deviceId,
        agentName: agent.agentName,
        platform: agent.platform || undefined,
      }),
    );
  }

  if (env === "production" && bindings.size === 0) {
    throw new Error("at least one agent token binding is required in production");
  }

  return bindings;
}

function normalizeStoredConfig(raw: unknown): StoredBackendConfig {
  const source = isRecord(raw) ? raw : {};
  const env = source.env === "production" ? "production" : "development";

  return {
    serverEnabled:
      typeof source.serverEnabled === "boolean" ? source.serverEnabled : true,
    env,
    host: asOptionalString(source.host) ?? "0.0.0.0",
    port: parsePort(source.port),
    dashboardToken:
      asOptionalString(source.dashboardToken) ??
      (env === "development" ? "dev-dashboard-token" : ""),
    allowedOrigins: parseAllowedOrigins(env, asOriginList(source.allowedOrigins)),
    allowInsecureLocalhost: source.allowInsecureLocalhost === true,
    agents: normalizeAgents(source),
  };
}

export function getConfigFilePath(): string {
  return CONFIG_FILE_PATH;
}

export function getDefaultStoredConfig(): StoredBackendConfig {
  return normalizeStoredConfig({});
}

export async function loadStoredConfig(): Promise<StoredBackendConfig> {
  const configFile = Bun.file(CONFIG_FILE_PATH);

  if (!(await configFile.exists())) {
    const defaults = getDefaultStoredConfig();
    await saveStoredConfig(defaults);
    return defaults;
  }

  let rawText: string;

  try {
    rawText = await configFile.text();
  } catch {
    const defaults = getDefaultStoredConfig();
    await saveStoredConfig(defaults);
    return defaults;
  }

  try {
    return normalizeStoredConfig(JSON.parse(rawText));
  } catch {
    const defaults = getDefaultStoredConfig();
    await saveStoredConfig(defaults);
    return defaults;
  }
}

export async function saveStoredConfig(
  config: StoredBackendConfig,
): Promise<void> {
  const normalized = validateStoredConfig(config);
  const output = `${JSON.stringify(normalized, null, 2)}\n`;
  await Bun.write(CONFIG_FILE_PATH, output);
}

export function validateStoredConfig(
  config: StoredBackendConfig,
): StoredBackendConfig {
  const normalized = normalizeStoredConfig(config);

  if (
    normalized.env === "production" &&
    normalized.dashboardToken.trim().length === 0
  ) {
    throw new Error("DASHBOARD_API_TOKEN is required in production");
  }

  loadSecurityConfig(normalized);
  return normalized;
}

export function parseAllowedOriginsInput(
  env: RuntimeEnvironment,
  rawValue: string,
): string[] {
  return parseAllowedOrigins(env, rawValue);
}

export function getConfigSummary(config: StoredBackendConfig): string {
  const agents =
    config.agents.length > 0
      ? config.agents
          .map(
            (agent, index) =>
              `${index + 1}. ${agent.agentName} | token=${agent.token} | deviceId=${agent.deviceId} | platform=${agent.platform || "未设置"}`,
          )
          .join("\n")
      : "未配置";

  return [
    `配置文件: ${CONFIG_FILE_PATH}`,
    `运行环境: ${config.env}`,
    `监听地址: ${config.host}:${config.port}`,
    `Dashboard Token: ${config.dashboardToken || "(空)"}`,
    `允许来源: ${config.allowedOrigins.join(", ") || "(空)"}`,
    `允许 localhost 明文: ${config.allowInsecureLocalhost ? "是" : "否"}`,
    `Agent 列表:`,
    agents,
  ].join("\n");
}

export function loadSecurityConfig(config: StoredBackendConfig): SecurityConfig {
  const dashboardToken =
    config.dashboardToken.trim() ||
    (config.env === "development" ? "dev-dashboard-token" : "");

  if (!dashboardToken) {
    throw new Error("DASHBOARD_API_TOKEN is required in production");
  }

  return {
    env: config.env,
    dashboardToken,
    allowedOrigins: parseAllowedOrigins(config.env, config.allowedOrigins),
    allowInsecureLocalhost: config.allowInsecureLocalhost,
    agentBindings: parseAgentBindings(config.env, config),
    humanGateEnabled: process.env.CAP_ENABLED !== "false",
  };
}
