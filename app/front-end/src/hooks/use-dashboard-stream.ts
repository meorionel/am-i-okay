"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { fetchCurrentDevices } from "@/src/lib/api";
import { toEpochMs } from "@/src/lib/format";
import { DashboardWebSocketClient, type ConnectionStatus } from "@/src/lib/ws";
import type { ActivityEvent, DeviceStatus, RecentActivity } from "@/src/types/activity";

type DeviceState = Record<string, ActivityEvent>;

type DeviceAction = { type: "upsert"; event: ActivityEvent } | { type: "replace"; devices: ActivityEvent[] };

function eventTsMs(event: ActivityEvent): number {
	return toEpochMs(event.ts) ?? 0;
}

export function upsertDevice(state: DeviceState, event: ActivityEvent): DeviceState {
	const current = state[event.deviceId];
	if (current && eventTsMs(current) > eventTsMs(event)) {
		return state;
	}

	return {
		...state,
		[event.deviceId]: event,
	};
}

export function replaceSnapshot(devices: ActivityEvent[]): DeviceState {
	return devices.reduce<DeviceState>((nextState, event) => {
		return upsertDevice(nextState, event);
	}, {});
}

export function getDevices(state: DeviceState): ActivityEvent[] {
	return Object.values(state).sort((a, b) => eventTsMs(b) - eventTsMs(a));
}

function deviceReducer(state: DeviceState, action: DeviceAction): DeviceState {
	if (action.type === "upsert") {
		return upsertDevice(state, action.event);
	}

	return replaceSnapshot(action.devices);
}

function shouldReplaceStatus(current: DeviceStatus | null, next: DeviceStatus | null): boolean {
	if (next === null) {
		return current === null;
	}

	if (current === null) {
		return true;
	}

	return (toEpochMs(next.ts) ?? 0) >= (toEpochMs(current.ts) ?? 0);
}

function resolveLastEventAt(devices: ActivityEvent[]): number | null {
	if (devices.length === 0) {
		return null;
	}

	return devices.map((event) => eventTsMs(event)).reduce((max, value) => (value > max ? value : max), 0);
}

const MAX_RECENT_ACTIVITIES = 10;

function toRecentActivity(event: ActivityEvent): RecentActivity {
	return {
		eventId: event.eventId,
		ts: event.ts,
		deviceId: event.deviceId,
		agentName: event.agentName,
		platform: event.platform,
		kind: event.kind,
		app: {
			...event.app,
		},
		windowTitle: event.windowTitle,
		source: event.source,
	};
}

function mergeRecentActivities(current: RecentActivity[], nextActivity: RecentActivity): RecentActivity[] {
	const nextKey = nextActivity.eventId ?? `${nextActivity.deviceId}-${nextActivity.ts}`;
	const deduped = current.filter((activity) => {
		const key = activity.eventId ?? `${activity.deviceId}-${activity.ts}`;
		return key !== nextKey;
	});

	return [nextActivity, ...deduped].sort((a, b) => (toEpochMs(b.ts) ?? 0) - (toEpochMs(a.ts) ?? 0)).slice(0, MAX_RECENT_ACTIVITIES);
}

export function useDashboardStream(): {
	devices: ActivityEvent[];
	latestStatus: DeviceStatus | null;
	recentActivities: RecentActivity[];
	connectionStatus: ConnectionStatus;
	lastEventAt: number | null;
} {
	const [deviceState, dispatch] = useReducer(deviceReducer, {});
	const [latestStatus, setLatestStatus] = useState<DeviceStatus | null>(null);
	const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
	const [lastEventAt, setLastEventAt] = useState<number | null>(null);

	useEffect(() => {
		let isActive = true;

		const safeSetLastEventAt = (value: number | null): void => {
			if (isActive) {
				setLastEventAt(value);
			}
		};

		const safeDispatch = (action: DeviceAction): void => {
			if (isActive) {
				dispatch(action);
			}
		};

		const bootstrap = async (): Promise<void> => {
			const dashboard = await fetchCurrentDevices();
			if (!isActive) {
				return;
			}

			safeDispatch({ type: "replace", devices: dashboard.devices });
			setLatestStatus(dashboard.latestStatus);
			setRecentActivities(dashboard.recentActivities);
			safeSetLastEventAt(resolveLastEventAt(dashboard.devices));
		};

		void bootstrap();

		const wsClient = new DashboardWebSocketClient({
			onStatusChange: (status) => {
				if (isActive) {
					setConnectionStatus(status);
				}
			},
			onSnapshot: (devices, nextLatestStatus) => {
				safeDispatch({ type: "replace", devices });
				if (isActive) {
					setLatestStatus(nextLatestStatus);
				}
				safeSetLastEventAt(resolveLastEventAt(devices) ?? Date.now());
			},
			onActivity: (event) => {
				safeDispatch({ type: "upsert", event });
				if (isActive) {
					setRecentActivities((current) => mergeRecentActivities(current, toRecentActivity(event)));
				}
				safeSetLastEventAt(eventTsMs(event) || Date.now());
			},
			onStatus: (status) => {
				if (isActive) {
					setLatestStatus((current) => {
						return shouldReplaceStatus(current, status) ? status : current;
					});
				}
			},
			onError: (message) => {
				console.warn("[ws]", message);
			},
		});

		wsClient.connect();

		return () => {
			isActive = false;
			wsClient.disconnect();
		};
	}, []);

	const devices = useMemo(() => getDevices(deviceState), [deviceState]);

	return {
		devices,
		latestStatus,
		recentActivities,
		connectionStatus,
		lastEventAt,
	};
}
