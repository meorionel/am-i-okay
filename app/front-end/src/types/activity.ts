export interface AppInfo {
  id: string;
  name: string;
  title?: string | null;
  pid?: number;
}

export interface ActivityEvent {
  eventId?: string;
  ts: string;
  deviceId: string;
  platform: string;
  kind: string;
  app: AppInfo;
  windowTitle?: string | null;
  source?: string;
}

export interface DashboardSnapshot {
  devices: ActivityEvent[];
}

export interface DashboardErrorPayload {
  message: string;
}

export type DashboardMessage =
  | { type: "snapshot"; payload: DashboardSnapshot }
  | { type: "activity"; payload: ActivityEvent }
  | { type: "error"; payload: DashboardErrorPayload };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseActivityEvent(input: unknown): ActivityEvent | null {
  if (!isRecord(input)) {
    return null;
  }

  const ts = readString(input.ts);
  const deviceId = readString(input.deviceId);
  const platform = readString(input.platform);
  const kind = readString(input.kind);
  const appRaw = isRecord(input.app) ? input.app : null;

  if (!ts || !deviceId || !platform || !kind || !appRaw) {
    return null;
  }

  const appId = readString(appRaw.id);
  const appName = readString(appRaw.name);

  if (!appId || !appName) {
    return null;
  }

  const event: ActivityEvent = {
    ts,
    deviceId,
    platform,
    kind,
    app: {
      id: appId,
      name: appName,
    },
  };

  const eventId = readString(input.eventId);
  if (eventId) {
    event.eventId = eventId;
  }

  const pid = readNumber(appRaw.pid);
  if (pid !== undefined) {
    event.app.pid = pid;
  }

  if (appRaw.title === null) {
    event.app.title = null;
  } else {
    const appTitle = readString(appRaw.title);
    if (appTitle) {
      event.app.title = appTitle;
    }
  }

  if (input.windowTitle === null) {
    event.windowTitle = null;
  } else {
    const windowTitle = readString(input.windowTitle);
    if (windowTitle) {
      event.windowTitle = windowTitle;
    }
  }

  const source = readString(input.source);
  if (source) {
    event.source = source;
  }

  return event;
}

export function parseCurrentDevicesResponse(input: unknown): ActivityEvent[] {
  if (!isRecord(input) || !Array.isArray(input.devices)) {
    return [];
  }

  return input.devices
    .map((item) => parseActivityEvent(item))
    .filter((event): event is ActivityEvent => event !== null);
}

export function parseDashboardMessage(input: unknown): DashboardMessage | null {
  if (!isRecord(input)) {
    return null;
  }

  const type = readString(input.type);
  if (!type) {
    return null;
  }

  if (type === "snapshot") {
    if (!isRecord(input.payload) || !Array.isArray(input.payload.devices)) {
      return null;
    }

    const devices = input.payload.devices
      .map((item) => parseActivityEvent(item))
      .filter((event): event is ActivityEvent => event !== null);

    return {
      type: "snapshot",
      payload: { devices },
    };
  }

  if (type === "activity") {
    const event = parseActivityEvent(input.payload);
    if (!event) {
      return null;
    }

    return {
      type: "activity",
      payload: event,
    };
  }

  if (type === "error") {
    if (!isRecord(input.payload)) {
      return null;
    }

    const message = readString(input.payload.message);
    if (!message) {
      return null;
    }

    return {
      type: "error",
      payload: { message },
    };
  }

  return null;
}
