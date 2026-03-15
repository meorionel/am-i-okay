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
    onlineCount: number;
  };
}

export interface OnlineCountMessage {
  type: "online-count";
  payload: {
    count: number;
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

export interface MessageItem {
  id: string;
  body: string;
  createdAt: string;
  expiresAt: string;
}

export interface MessageBroadcastMessage {
  type: "message";
  payload: MessageItem;
}

export interface MessageSnapshotMessage {
  type: "message_snapshot";
  payload: {
    messages: MessageItem[];
  };
}

export interface MessageAckMessage {
  type: "message_ack";
  payload: {
    requestId: string;
    nextAllowedAt: string;
  };
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
    code?: string;
    requestId?: string;
    retryAfterMs?: number;
    frozenUntil?: string;
  };
}

export type ServerToDashboardMessage =
  | SnapshotMessage
  | OnlineCountMessage
  | ActivityBroadcastMessage
  | StatusBroadcastMessage
  | FoodSnapshotMessage
  | FoodUpdateMessage
  | MessageSnapshotMessage
  | MessageBroadcastMessage
  | MessageAckMessage
  | ErrorMessage;

export type ClientRole = "agent" | "dashboard" | "food" | "message";

export interface WsClientData {
  role: ClientRole;
  connectionId: string;
  viewerId?: string;
  ip?: string;
  agent?: {
    token: string;
    deviceId: string;
    agentName: string;
    platform?: Platform;
  };
}
