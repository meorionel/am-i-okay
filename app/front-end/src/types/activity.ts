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
	agentName?: string;
	platform: string;
	kind: string;
	app: AppInfo;
	windowTitle?: string | null;
	source?: string;
}

export interface RecentActivity {
	eventId?: string;
	ts: string;
	deviceId: string;
	agentName?: string;
	platform: string;
	app: AppInfo;
	kind?: string;
	windowTitle?: string | null;
	source?: string;
	displayTime?: string;
	summary?: string;
}

export interface DashboardSnapshot {
	devices: ActivityEvent[];
}

export interface CurrentDevicesResponse {
	devices: ActivityEvent[];
	recentActivities: RecentActivity[];
}

export interface DashboardErrorPayload {
	message: string;
}

export type DashboardMessage = { type: "snapshot"; payload: DashboardSnapshot } | { type: "activity"; payload: ActivityEvent } | { type: "error"; payload: DashboardErrorPayload };

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
	const agentName = readString(input.agentName);
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
		agentName: agentName ?? undefined,
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
	return parseCurrentDashboardResponse(input).devices;
}

export function parseCurrentDashboardResponse(input: unknown): CurrentDevicesResponse {
	if (!isRecord(input)) {
		return { devices: [], recentActivities: [] };
	}

	const devices = Array.isArray(input.devices) ? input.devices.map((item) => parseActivityEvent(item)).filter((event): event is ActivityEvent => event !== null) : [];

	const recentActivities = Array.isArray(input.recentActivities)
		? input.recentActivities.map((item) => parseRecentActivity(item)).filter((event): event is RecentActivity => event !== null)
		: [];

	return { devices, recentActivities };
}

export function parseRecentActivity(input: unknown): RecentActivity | null {
	if (!isRecord(input)) {
		return null;
	}

	const ts = readString(input.ts);
	const deviceId = readString(input.deviceId);
	const agentName = readString(input.agentName);
	const platform = readString(input.platform);
	const appRaw = isRecord(input.app) ? input.app : null;

	if (!ts || !deviceId || !platform || !appRaw) {
		return null;
	}

	const appId = readString(appRaw.id);
	const appName = readString(appRaw.name);

	if (!appId || !appName) {
		return null;
	}

	const activity: RecentActivity = {
		ts,
		deviceId,
		agentName: agentName ?? undefined,
		platform,
		app: {
			id: appId,
			name: appName,
		},
	};

	const eventId = readString(input.eventId);
	if (eventId) {
		activity.eventId = eventId;
	}

	const kind = readString(input.kind);
	if (kind) {
		activity.kind = kind;
	}

	const pid = readNumber(appRaw.pid);
	if (pid !== undefined) {
		activity.app.pid = pid;
	}

	if (appRaw.title === null) {
		activity.app.title = null;
	} else {
		const appTitle = readString(appRaw.title);
		if (appTitle) {
			activity.app.title = appTitle;
		}
	}

	if (input.windowTitle === null) {
		activity.windowTitle = null;
	} else {
		const windowTitle = readString(input.windowTitle);
		if (windowTitle) {
			activity.windowTitle = windowTitle;
		}
	}

	const source = readString(input.source);
	if (source) {
		activity.source = source;
	}

	const displayTime = readString(input.displayTime);
	if (displayTime) {
		activity.displayTime = displayTime;
	}

	const summary = readString(input.summary);
	if (summary) {
		activity.summary = summary;
	}

	return activity;
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

		const devices = input.payload.devices.map((item) => parseActivityEvent(item)).filter((event): event is ActivityEvent => event !== null);

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
