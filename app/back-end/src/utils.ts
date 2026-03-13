import type { SecurityConfig } from "./config";
import type { ErrorMessage, ServerToDashboardMessage } from "./types";
import { createCorsHeaders } from "./security";

const decoder = new TextDecoder();

export function jsonResponse(
  req: Request,
  config: SecurityConfig,
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...createCorsHeaders(req, config),
      ...extraHeaders,
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
