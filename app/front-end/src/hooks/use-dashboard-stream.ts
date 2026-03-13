"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { fetchCurrentDevices } from "@/src/lib/api";
import { toEpochMs } from "@/src/lib/format";
import type { ActivityEvent, DeviceStatus, RecentActivity } from "@/src/types/activity";
import type { ConnectionStatus } from "@/src/lib/ws";

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

const POLL_INTERVAL_MS = 3_000;

export function useDashboardStream(): {
	devices: ActivityEvent[];
	latestStatus: DeviceStatus | null;
	recentActivities: RecentActivity[];
	connectionStatus: ConnectionStatus;
	lastEventAt: number | null;
	isBootstrapping: boolean;
} {
	const [deviceState, dispatch] = useReducer(deviceReducer, {});
	const [latestStatus, setLatestStatus] = useState<DeviceStatus | null>(null);
	const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
	const [lastEventAt, setLastEventAt] = useState<number | null>(null);
	const [isBootstrapping, setIsBootstrapping] = useState(true);

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
			try {
				const dashboard = await fetchCurrentDevices();
				if (!isActive) {
					return;
				}

				safeDispatch({ type: "replace", devices: dashboard.devices });
				setLatestStatus(dashboard.latestStatus);
				setRecentActivities(dashboard.recentActivities);
				safeSetLastEventAt(resolveLastEventAt(dashboard.devices));
				setConnectionStatus("connected");
			} finally {
				if (isActive) {
					setIsBootstrapping(false);
				}
			}
		};

		void bootstrap();
		const pollTimer = window.setInterval(() => {
			void fetchCurrentDevices()
				.then((dashboard) => {
					if (!isActive) {
						return;
					}

					const nextDevices = dashboard.devices;
					safeDispatch({ type: "replace", devices: nextDevices });
					setLatestStatus((current) =>
						shouldReplaceStatus(current, dashboard.latestStatus)
							? dashboard.latestStatus
							: current,
					);
					setRecentActivities(dashboard.recentActivities);
					safeSetLastEventAt(resolveLastEventAt(nextDevices));
					setConnectionStatus("connected");
				})
				.catch((error) => {
					if (isActive) {
						setConnectionStatus("error");
					}
					console.warn("[poll]", error);
				});
		}, POLL_INTERVAL_MS);

		return () => {
			isActive = false;
			window.clearInterval(pollTimer);
		};
	}, []);

	const devices = useMemo(() => getDevices(deviceState), [deviceState]);

	return {
		devices,
		latestStatus,
		recentActivities,
		connectionStatus,
		lastEventAt,
		isBootstrapping,
	};
}
