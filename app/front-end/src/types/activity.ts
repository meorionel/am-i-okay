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

export interface DeviceStatus {
	ts: string;
	deviceId: string;
	agentName?: string;
	platform: string;
	statusText: string;
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
	latestStatus: DeviceStatus | null;
	recentActivities: RecentActivity[];
	onlineCount: number | null;
}

export interface CurrentDevicesResponse {
	devices: ActivityEvent[];
	latestStatus: DeviceStatus | null;
	recentActivities: RecentActivity[];
}

export interface FoodItem {
	id: number;
	emoji: string;
	totalCount: number;
	viewerCount: number;
}

export interface FoodCounterResponse {
	foods: FoodItem[];
}

export type FoodSocketMessage =
	| { type: "food_snapshot"; payload: FoodCounterResponse }
	| { type: "food_update"; payload: FoodCounterResponse }
	| { type: "error"; payload: DashboardErrorPayload };

export interface DashboardErrorPayload {
	message: string;
	code?: string;
	requestId?: string;
	retryAfterMs?: number;
	frozenUntil?: string;
}

export type DashboardMessage =
	| { type: "snapshot"; payload: DashboardSnapshot }
	| { type: "online-count"; payload: { count: number } }
	| { type: "activity"; payload: ActivityEvent }
	| { type: "status"; payload: DeviceStatus }
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

export function parseDeviceStatus(input: unknown): DeviceStatus | null {
	if (!isRecord(input)) {
		return null;
	}

	const ts = readString(input.ts);
	const deviceId = readString(input.deviceId);
	const agentName = readString(input.agentName);
	const platform = readString(input.platform);
	const statusText = readString(input.statusText);

	if (!ts || !deviceId || !platform || statusText === null) {
		return null;
	}

	const status: DeviceStatus = {
		ts,
		deviceId,
		agentName: agentName ?? undefined,
		platform,
		statusText,
	};

	const source = readString(input.source);
	if (source) {
		status.source = source;
	}

	return status;
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
		return { devices: [], latestStatus: null, recentActivities: [] };
	}

	const devices = Array.isArray(input.devices) ? input.devices.map((item) => parseActivityEvent(item)).filter((event): event is ActivityEvent => event !== null) : [];
	const latestStatus = parseDeviceStatus(input.latestStatus);

	const recentActivities = Array.isArray(input.recentActivities)
		? input.recentActivities.map((item) => parseRecentActivity(item)).filter((event): event is RecentActivity => event !== null)
		: [];

	return { devices, latestStatus, recentActivities };
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

export function parseFoodCounterResponse(input: unknown): FoodCounterResponse {
	if (!isRecord(input)) {
		return {
			foods: [],
		};
	}

	const foods = Array.isArray(input.foods)
		? input.foods
				.map((item) => parseFoodItem(item))
				.filter((item): item is FoodItem => item !== null)
		: [];

	return {
		foods,
	};
}

export function parseFoodSocketMessage(input: unknown): FoodSocketMessage | null {
	if (!isRecord(input)) {
		return null;
	}

	const type = readString(input.type);
	if (!type || !isRecord(input.payload)) {
		return null;
	}

	if (type === "food_snapshot" || type === "food_update") {
		return {
			type,
			payload: parseFoodCounterResponse(input.payload),
		};
	}

	if (type === "error") {
		const errorPayload = parseErrorPayload(input.payload);
		return errorPayload ? { type: "error", payload: errorPayload } : null;
	}

	return null;
}

function parseFoodItem(input: unknown): FoodItem | null {
	if (!isRecord(input)) {
		return null;
	}

	const id = readNumber(input.id);
	const emoji = readString(input.emoji);
	const totalCount = readNumber(input.totalCount);
	const viewerCount = readNumber(input.viewerCount);

	if (id === undefined || !emoji || totalCount === undefined || viewerCount === undefined) {
		return null;
	}

	return {
		id,
		emoji,
		totalCount,
		viewerCount,
	};
}

function parseErrorPayload(input: unknown): DashboardErrorPayload | null {
	if (!isRecord(input)) {
		return null;
	}

	const message = readString(input.message);
	if (!message) {
		return null;
	}

	const payload: DashboardErrorPayload = { message };
	const code = readString(input.code);
	const requestId = readString(input.requestId);
	const retryAfterMs = readNumber(input.retryAfterMs);
	const frozenUntil = readString(input.frozenUntil);

	if (code) {
		payload.code = code;
	}

	if (requestId) {
		payload.requestId = requestId;
	}

	if (retryAfterMs !== undefined) {
		payload.retryAfterMs = retryAfterMs;
	}

	if (frozenUntil) {
		payload.frozenUntil = frozenUntil;
	}

	return payload;
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
		const latestStatus = parseDeviceStatus(input.payload.latestStatus);
		const recentActivities = Array.isArray(input.payload.recentActivities)
			? input.payload.recentActivities.map((item) => parseRecentActivity(item)).filter((event): event is RecentActivity => event !== null)
			: [];

		return {
			type: "snapshot",
			payload: {
				devices,
				latestStatus,
				recentActivities,
				onlineCount: readNumber(input.payload.onlineCount) ?? null,
			},
		};
	}

	if (type === "online-count") {
		if (!isRecord(input.payload)) {
			return null;
		}

		const count = readNumber(input.payload.count);
		if (count === undefined) {
			return null;
		}

		return {
			type: "online-count",
			payload: { count },
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

	if (type === "status") {
		const status = parseDeviceStatus(input.payload);
		if (!status) {
			return null;
		}

		return {
			type: "status",
			payload: status,
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
