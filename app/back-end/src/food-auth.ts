import type { SecurityConfig } from "./config";

interface WebSocketTicketPayload {
  role: "food" | "dashboard" | "message";
  viewerId?: string;
  expiresAt: number;
}

function toBase64Url(bytes: Uint8Array | ArrayBuffer): string {
  return Buffer.from(
    bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes,
  ).toString("base64url");
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(digest);
}

async function verifyWebSocketTicket(
  token: string,
  config: Pick<SecurityConfig, "dashboardToken">,
): Promise<WebSocketTicketPayload | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = await signPayload(payload, config.dashboardToken);
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<WebSocketTicketPayload>;
    if (
      (parsed.role !== "food" &&
        parsed.role !== "dashboard" &&
        parsed.role !== "message") ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) {
      return null;
    }

    if (parsed.role === "food" || parsed.role === "message") {
      if (
        typeof parsed.viewerId !== "string" ||
        parsed.viewerId.trim().length === 0
      ) {
        return null;
      }

      return {
        role: parsed.role,
        viewerId: parsed.viewerId.trim(),
        expiresAt: parsed.expiresAt,
      };
    }

    return {
      role: "dashboard",
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function verifyFoodViewerToken(
  token: string,
  config: Pick<SecurityConfig, "dashboardToken">,
): Promise<string | null> {
  const ticket = await verifyWebSocketTicket(token, config);
  return ticket?.role === "food" ? ticket.viewerId ?? null : null;
}

export async function verifyMessageViewerToken(
  token: string,
  config: Pick<SecurityConfig, "dashboardToken">,
): Promise<string | null> {
  const ticket = await verifyWebSocketTicket(token, config);
  return ticket?.role === "message" ? ticket.viewerId ?? null : null;
}

export async function verifyDashboardWebSocketToken(
  token: string,
  config: Pick<SecurityConfig, "dashboardToken">,
): Promise<boolean> {
  const ticket = await verifyWebSocketTicket(token, config);
  return ticket?.role === "dashboard";
}
