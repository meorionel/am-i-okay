import type { ActivityApp, ActivityEvent, AgentIncomingMessage, Platform } from "./types";

type ParseSuccess<T> = { ok: true; data: T };
type ParseFailure = { ok: false; error: string };
type ParseResult<T> = ParseSuccess<T> | ParseFailure;

const PLATFORM_SET = new Set<Platform>(["macos", "windows", "android"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pickValue(
  input: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (key in input) {
      return input[key];
    }
  }

  return undefined;
}

function parseApp(input: unknown): ParseResult<ActivityApp> {
  if (!isRecord(input)) {
    return { ok: false, error: "payload.app must be an object" };
  }

  const id = input.id;
  const name = input.name;
  const pid = input.pid;

  if (!isNonEmptyString(id)) {
    return { ok: false, error: "payload.app.id must be a non-empty string" };
  }
  if (!isNonEmptyString(name)) {
    return { ok: false, error: "payload.app.name must be a non-empty string" };
  }
  if (pid !== undefined && (typeof pid !== "number" || !Number.isFinite(pid))) {
    return { ok: false, error: "payload.app.pid must be a finite number when provided" };
  }

  return {
    ok: true,
    data: {
      id,
      name,
      pid,
    },
  };
}

export function parseActivityEvent(input: unknown): ParseResult<ActivityEvent> {
  if (!isRecord(input)) {
    return { ok: false, error: "payload must be an object" };
  }

  const eventId = pickValue(input, "eventId", "event_id");
  const ts = input.ts;
  const deviceId = pickValue(input, "deviceId", "device_id");
  const platform = input.platform;
  const kind = input.kind;
  const app = input.app;
  const windowTitle = pickValue(input, "windowTitle", "window_title");
  const source = input.source;

  if (!isNonEmptyString(eventId)) {
    return { ok: false, error: "payload.eventId must be a non-empty string" };
  }
  if (!isNonEmptyString(ts) || Number.isNaN(Date.parse(ts))) {
    return { ok: false, error: "payload.ts must be a valid ISO datetime string" };
  }
  if (!isNonEmptyString(deviceId)) {
    return { ok: false, error: "payload.deviceId must be a non-empty string" };
  }
  if (typeof platform !== "string" || !PLATFORM_SET.has(platform as Platform)) {
    return { ok: false, error: "payload.platform must be one of: macos, windows, android" };
  }
  if (kind !== "foreground_changed") {
    return { ok: false, error: "payload.kind must be foreground_changed" };
  }
  if (
    windowTitle !== undefined &&
    windowTitle !== null &&
    typeof windowTitle !== "string"
  ) {
    return {
      ok: false,
      error: "payload.windowTitle must be a string or null when provided",
    };
  }
  if (!isNonEmptyString(source)) {
    return { ok: false, error: "payload.source must be a non-empty string" };
  }

  const appResult = parseApp(app);
  if (!appResult.ok) {
    return appResult;
  }

  return {
    ok: true,
    data: {
      eventId,
      ts,
      deviceId,
      platform: platform as Platform,
      kind: "foreground_changed",
      app: appResult.data,
      windowTitle: windowTitle === null ? undefined : windowTitle,
      source,
    },
  };
}

export function parseAgentMessage(rawText: string): ParseResult<AgentIncomingMessage> {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "message must be valid JSON" };
  }

  if (!isRecord(parsedJson)) {
    return { ok: false, error: "message must be a JSON object" };
  }

  if (parsedJson.type !== "activity") {
    return { ok: false, error: "message.type must be activity" };
  }

  const payloadResult = parseActivityEvent(parsedJson.payload);
  if (!payloadResult.ok) {
    return payloadResult;
  }

  return {
    ok: true,
    data: {
      type: "activity",
      payload: payloadResult.data,
    },
  };
}
