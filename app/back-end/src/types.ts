export type Platform = "macos" | "windows" | "android";

export type ActivityKind = "foreground_changed";

export interface ActivityApp {
  id: string;
  name: string;
  title?: string;
  pid?: number;
}

export interface ActivityEvent {
  eventId: string;
  ts: string;
  deviceId: string;
  agentName: string;
  platform: Platform;
  kind: ActivityKind;
  app: ActivityApp;
  windowTitle?: string;
  source: string;
}

export interface DeviceStatus {
  ts: string;
  deviceId: string;
  agentName: string;
  platform: Platform;
  statusText: string;
  source: string;
}

export interface RecentActivityItem {
  eventId: string;
  ts: string;
  deviceId: string;
  agentName: string;
  platform: Platform;
  app: ActivityApp;
  windowTitle?: string;
  source: string;
  displayTime: string;
  summary: string;
}

export interface DeviceActivitySnapshot {
  current: ActivityEvent;
  recentActivities: RecentActivityItem[];
}

export interface AgentActivityMessage {
  type: "activity";
  payload: ActivityEvent;
}

export interface AgentStatusMessage {
  type: "status";
  payload: DeviceStatus;
}

export type AgentIncomingMessage = AgentActivityMessage | AgentStatusMessage;

export interface SnapshotMessage {
  type: "snapshot";
  payload: {
    devices: ActivityEvent[];
    latestStatus: DeviceStatus | null;
    deviceSnapshots: DeviceActivitySnapshot[];
    recentActivities: RecentActivityItem[];
  };
}

export interface FoodCounterPayload {
  foods: {
    id: number;
    emoji: string;
    totalCount: number;
    viewerCount: number;
  }[];
}

export interface FoodSnapshotMessage {
  type: "food_snapshot";
  payload: FoodCounterPayload;
}

export interface FoodUpdateMessage {
  type: "food_update";
  payload: FoodCounterPayload;
}

export interface ActivityBroadcastMessage {
  type: "activity";
  payload: ActivityEvent;
}

export interface StatusBroadcastMessage {
  type: "status";
  payload: DeviceStatus;
}

export interface ErrorMessage {
  type: "error";
  payload: {
    message: string;
  };
}

export type ServerToDashboardMessage =
  | SnapshotMessage
  | ActivityBroadcastMessage
  | StatusBroadcastMessage
  | FoodSnapshotMessage
  | FoodUpdateMessage
  | ErrorMessage;

export type ClientRole = "agent" | "dashboard" | "food";

export interface WsClientData {
  role: ClientRole;
  connectionId: string;
  viewerId?: string;
  agent?: {
    token: string;
    deviceId: string;
    agentName: string;
    platform?: Platform;
  };
}
