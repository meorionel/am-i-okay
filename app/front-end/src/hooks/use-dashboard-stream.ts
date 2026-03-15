"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { fetchCurrentDevices } from "@/src/lib/api";
import { toEpochMs } from "@/src/lib/format";
import { parseDashboardMessage, type ActivityEvent, type DeviceStatus, type RecentActivity } from "@/src/types/activity";
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

const DASHBOARD_SOCKET_RETRY_MS = 2_000;

function getRecentActivityKey(event: Pick<RecentActivity, "eventId" | "deviceId" | "ts">): string {
	return event.eventId ?? `${event.deviceId}-${event.ts}`;
}

function toRecentActivity(event: ActivityEvent): RecentActivity {
	return {
		eventId: event.eventId,
		ts: event.ts,
		deviceId: event.deviceId,
		agentName: event.agentName,
		platform: event.platform,
		app: event.app,
		kind: event.kind,
		windowTitle: event.windowTitle,
		source: event.source,
	};
}

export function useDashboardStream(enabled: boolean, pageId: string): {
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
		if (!enabled) {
			setConnectionStatus("connecting");
			setIsBootstrapping(true);
			return;
		}

		let isActive = true;
		let reconnectTimer: number | null = null;
		let socket: WebSocket | null = null;

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

		const connectSocket = async (): Promise<void> => {
			if (!isActive) {
				return;
			}

			setConnectionStatus("connecting");

			try {
				const response = await fetch("/api/dashboard/socket", {
					method: "GET",
					cache: "no-store",
					headers: {
						Accept: "application/json",
						"x-human-page-id": pageId,
					},
				});

				if (!isActive) {
					return;
				}

				if (!response.ok) {
					throw new Error(`dashboard socket bootstrap failed with HTTP ${response.status}`);
				}

				const data = (await response.json()) as { url?: string };
				if (!data.url) {
					throw new Error("dashboard socket bootstrap did not return a websocket url");
				}

				socket = new WebSocket(data.url);
				socket.onopen = () => {
					if (isActive) {
						setConnectionStatus("connected");
					}
				};
				socket.onmessage = (event) => {
					if (!isActive) {
						return;
					}

					try {
						const message = parseDashboardMessage(JSON.parse(event.data));
						if (!message) {
							return;
						}

						if (message.type === "error") {
							console.warn(`[dashboard-ws] ${message.payload.message}`);
							setConnectionStatus("error");
							return;
						}

						if (message.type === "snapshot") {
							safeDispatch({ type: "replace", devices: message.payload.devices });
							setLatestStatus(message.payload.latestStatus);
							setRecentActivities(message.payload.recentActivities);
							safeSetLastEventAt(resolveLastEventAt(message.payload.devices));
							setConnectionStatus("connected");
							return;
						}

						if (message.type === "activity") {
							safeDispatch({ type: "upsert", event: message.payload });
							setRecentActivities((current) => {
								const next = [toRecentActivity(message.payload), ...current];
								const seen = new Set<string>();
								return next.filter((item) => {
									const key = getRecentActivityKey(item);
									if (seen.has(key)) {
										return false;
									}
									seen.add(key);
									return true;
								}).slice(0, 20);
							});
							setLastEventAt((current) => {
								const nextTs = eventTsMs(message.payload);
								return current === null || nextTs > current ? nextTs : current;
							});
							setConnectionStatus("connected");
							return;
						}

						setLatestStatus((current) =>
							shouldReplaceStatus(current, message.payload) ? message.payload : current,
						);
						setConnectionStatus("connected");
					} catch (error) {
						console.warn("[dashboard-ws] failed to parse websocket payload", error);
					}
				};
				socket.onerror = (error) => {
					console.warn("[dashboard-ws] websocket error", error);
					if (isActive) {
						setConnectionStatus("error");
					}
				};
				socket.onclose = () => {
					if (!isActive) {
						return;
					}

					setConnectionStatus("disconnected");
					reconnectTimer = window.setTimeout(() => {
						void connectSocket();
					}, DASHBOARD_SOCKET_RETRY_MS);
				};
			} catch (error) {
				console.warn("[dashboard-ws] failed to establish websocket", error);
				if (isActive) {
					setConnectionStatus("error");
					reconnectTimer = window.setTimeout(() => {
						void connectSocket();
					}, DASHBOARD_SOCKET_RETRY_MS);
				}
			}
		};

		const bootstrap = async (): Promise<void> => {
			try {
				const dashboard = await fetchCurrentDevices(pageId);
				if (!isActive) {
					return;
				}

				safeDispatch({ type: "replace", devices: dashboard.devices });
				setLatestStatus(dashboard.latestStatus);
				setRecentActivities(dashboard.recentActivities);
				safeSetLastEventAt(resolveLastEventAt(dashboard.devices));
			} finally {
				if (isActive) {
					setIsBootstrapping(false);
				}
			}
		};

		void bootstrap();
		void connectSocket();

		return () => {
			isActive = false;
			if (reconnectTimer !== null) {
				window.clearTimeout(reconnectTimer);
			}
			socket?.close();
		};
	}, [enabled, pageId]);

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
