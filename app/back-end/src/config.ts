export type RuntimeEnvironment = "development" | "production";

export interface AgentIdentityBinding {
  token: string;
  deviceId: string;
  agentName: string;
  platform?: "macos" | "windows" | "android";
}

export interface SecurityConfig {
  env: RuntimeEnvironment;
  dashboardToken: string;
  allowedOrigins: string[];
  allowInsecureLocalhost: boolean;
  agentBindings: Map<string, AgentIdentityBinding>;
}

interface AgentBindingRecord {
  deviceId?: unknown;
  agentName?: unknown;
  platform?: unknown;
}

function asNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value.trim();
}

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function parseAllowedOrigins(
  env: RuntimeEnvironment,
  rawValue: string | undefined,
): string[] {
  const fallbackOrigins =
    env === "development"
      ? ["http://127.0.0.1:3001", "http://localhost:3001"]
      : [];

  const parsed = (rawValue ?? "")
    .split(",")
    .map((origin) => origin.trim())
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

function parseAgentBindings(env: RuntimeEnvironment): Map<string, AgentIdentityBinding> {
  const bindings = new Map<string, AgentIdentityBinding>();
  const rawBindings = Bun.env.AGENT_TOKEN_BINDINGS;

  if (rawBindings) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawBindings);
    } catch {
      throw new Error("AGENT_TOKEN_BINDINGS must be valid JSON");
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("AGENT_TOKEN_BINDINGS must be a JSON object");
    }

    for (const [token, value] of Object.entries(parsed)) {
      if (bindings.has(token)) {
        throw new Error(`duplicate agent token binding for ${token}`);
      }

      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`AGENT_TOKEN_BINDINGS.${token} must be an object`);
      }

      bindings.set(token, parseBindingRecord(token, value));
    }
  }

  const agentToken = Bun.env.AGENT_API_TOKEN?.trim();
  if (!agentToken) {
    if (env === "production") {
      throw new Error("AGENT_API_TOKEN is required in production");
    }
  } else if (!bindings.has(agentToken)) {
    const defaultBinding = parseBindingRecord(agentToken, {
      deviceId: Bun.env.AGENT_ALLOWED_DEVICE_ID ?? "local-agent",
      agentName: Bun.env.AGENT_ALLOWED_AGENT_NAME ?? "desktop-agent",
      platform: Bun.env.AGENT_ALLOWED_PLATFORM,
    });

    bindings.set(agentToken, defaultBinding);
  }

  if (env === "production" && bindings.size === 0) {
    throw new Error("at least one agent token binding is required in production");
  }

  return bindings;
}

export function loadSecurityConfig(): SecurityConfig {
  const env =
    Bun.env.NODE_ENV === "production" ? "production" : "development";
  const dashboardToken =
    Bun.env.DASHBOARD_API_TOKEN?.trim() ??
    (env === "development" ? "dev-dashboard-token" : "");

  if (!dashboardToken) {
    throw new Error("DASHBOARD_API_TOKEN is required in production");
  }

  return {
    env,
    dashboardToken,
    allowedOrigins: parseAllowedOrigins(env, Bun.env.ALLOWED_ORIGINS),
    allowInsecureLocalhost: parseBoolean(Bun.env.ALLOW_INSECURE_LOCALHOST),
    agentBindings: parseAgentBindings(env),
  };
}
