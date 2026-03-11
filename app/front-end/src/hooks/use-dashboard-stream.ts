"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { fetchCurrentDevices } from "@/src/lib/api";
import { toEpochMs } from "@/src/lib/format";
import {
  DashboardWebSocketClient,
  type ConnectionStatus,
} from "@/src/lib/ws";
import type { ActivityEvent } from "@/src/types/activity";

type DeviceState = Record<string, ActivityEvent>;

type DeviceAction =
  | { type: "upsert"; event: ActivityEvent }
  | { type: "replace"; devices: ActivityEvent[] };

function eventTsMs(event: ActivityEvent): number {
  return toEpochMs(event.ts) ?? 0;
}

export function upsertDevice(
  state: DeviceState,
  event: ActivityEvent,
): DeviceState {
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

function resolveLastEventAt(devices: ActivityEvent[]): number | null {
  if (devices.length === 0) {
    return null;
  }

  return devices
    .map((event) => eventTsMs(event))
    .reduce((max, value) => (value > max ? value : max), 0);
}

export function useDashboardStream(): {
  devices: ActivityEvent[];
  connectionStatus: ConnectionStatus;
  lastEventAt: number | null;
} {
  const [deviceState, dispatch] = useReducer(deviceReducer, {});
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
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
      const devices = await fetchCurrentDevices();
      if (!isActive) {
        return;
      }

      safeDispatch({ type: "replace", devices });
      safeSetLastEventAt(resolveLastEventAt(devices));
    };

    void bootstrap();

    const wsClient = new DashboardWebSocketClient({
      onStatusChange: (status) => {
        if (isActive) {
          setConnectionStatus(status);
        }
      },
      onSnapshot: (devices) => {
        safeDispatch({ type: "replace", devices });
        safeSetLastEventAt(resolveLastEventAt(devices) ?? Date.now());
      },
      onActivity: (event) => {
        safeDispatch({ type: "upsert", event });
        safeSetLastEventAt(eventTsMs(event) || Date.now());
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
    connectionStatus,
    lastEventAt,
  };
}
