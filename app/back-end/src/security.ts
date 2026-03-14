import type { AgentIdentityBinding, SecurityConfig } from "./config";
import type { ClientRole, WsClientData } from "./types";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const ALLOWED_CORS_METHODS = "GET, POST, OPTIONS";
const ALLOWED_CORS_HEADERS = "authorization, content-type";

export interface AuthenticatedHttpContext {
  role: ClientRole;
  agent?: AgentIdentityBinding;
}

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost");
}

function getRequestProtocol(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim().toLowerCase() ?? "";
  }

  return new URL(req.url).protocol.replace(":", "").toLowerCase();
}

function parseToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    return token.length > 0 ? token : null;
  }

  const queryToken = new URL(req.url).searchParams.get("token")?.trim();
  return queryToken && queryToken.length > 0 ? queryToken : null;
}

function rejectJson(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function createCorsHeaders(
  req: Request,
  config: SecurityConfig,
): Record<string, string> {
  const origin = req.headers.get("origin");

  if (!origin || !config.allowedOrigins.includes(origin)) {
    return {
      vary: "Origin",
    };
  }

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": ALLOWED_CORS_METHODS,
    "access-control-allow-headers": ALLOWED_CORS_HEADERS,
    vary: "Origin",
  };
}

export function handleCorsPreflight(
  req: Request,
  config: SecurityConfig,
): Response | null {
  if (req.method !== "OPTIONS") {
    return null;
  }

  const origin = req.headers.get("origin");
  if (!origin || !config.allowedOrigins.includes(origin)) {
    return rejectJson(403, "origin not allowed");
  }

  return new Response(null, {
    status: 204,
    headers: createCorsHeaders(req, config),
  });
}

export function assertSecureTransport(
  req: Request,
  config: SecurityConfig,
): Response | null {
  const url = new URL(req.url);
  const protocol = getRequestProtocol(req);
  const host = url.hostname;
  const isLocal = isLocalHostname(host);

  if (config.env === "development") {
    return null;
  }

  if (config.allowInsecureLocalhost && isLocal) {
    return null;
  }

  if (protocol === "https" || protocol === "wss") {
    return null;
  }

  return rejectJson(400, "secure transport required");
}

export function authenticateHttpRequest(
  req: Request,
  config: SecurityConfig,
  requiredRole: ClientRole,
): AuthenticatedHttpContext | Response {
  const token = parseToken(req);
  if (!token) {
    return rejectJson(401, "missing bearer token");
  }

  if (requiredRole === "dashboard") {
    if (token !== config.dashboardToken) {
      return rejectJson(403, "forbidden");
    }

    return { role: "dashboard" };
  }

  const agent = config.agentBindings.get(token);
  if (!agent) {
    return rejectJson(403, "forbidden");
  }

  return { role: "agent", agent };
}

export function authenticateWebSocketRequest(
  req: Request,
  config: SecurityConfig,
  requiredRole: ClientRole,
): WsClientData | Response {
  const auth = authenticateHttpRequest(req, config, requiredRole);
  if (auth instanceof Response) {
    return auth;
  }

  return {
    role: auth.role,
    connectionId: crypto.randomUUID(),
    agent: auth.agent,
  };
}
