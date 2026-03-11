import type { ErrorMessage, ServerToDashboardMessage } from "./types";

const decoder = new TextDecoder();

export function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
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
