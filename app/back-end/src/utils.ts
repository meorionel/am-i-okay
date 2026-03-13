import type { ErrorMessage, ServerToDashboardMessage } from "./types";

const decoder = new TextDecoder();

export type FingerprintSource = "header" | "body" | "derived";

export function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-browser-fingerprint",
  };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

export function toText(message: string | Uint8Array | ArrayBuffer): string {
  if (typeof message === "string") {
    return message;
  }

  if (message instanceof ArrayBuffer) {
    return decoder.decode(new Uint8Array(message));
  }

  return decoder.decode(message);
}

export function serializeMessage(
  message: ServerToDashboardMessage | ErrorMessage,
): string {
  return JSON.stringify(message);
}

function normalizeFingerprint(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized.slice(0, 256) : null;
}

async function hashToHex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function resolveFingerprint(
  req: Request,
  bodyFingerprint?: unknown,
): Promise<{ fingerprint: string; source: FingerprintSource }> {
  const headerFingerprint = normalizeFingerprint(
    req.headers.get("x-browser-fingerprint"),
  );
  if (headerFingerprint) {
    return {
      fingerprint: headerFingerprint,
      source: "header",
    };
  }

  const normalizedBodyFingerprint = normalizeFingerprint(bodyFingerprint);
  if (normalizedBodyFingerprint) {
    return {
      fingerprint: normalizedBodyFingerprint,
      source: "body",
    };
  }

  const seed = [
    req.headers.get("user-agent") ?? "",
    req.headers.get("accept-language") ?? "",
    req.headers.get("accept") ?? "",
    req.headers.get("sec-ch-ua") ?? "",
    req.headers.get("sec-ch-ua-platform") ?? "",
    req.headers.get("sec-ch-ua-mobile") ?? "",
    req.headers.get("dnt") ?? "",
  ].join("|");

  return {
    fingerprint: await hashToHex(seed || "anonymous-browser"),
    source: "derived",
  };
}
