export type Platform = "macos" | "windows" | "android";

export type ActivityKind = "foreground_changed";

export interface ActivityApp {
  id: string;
  name: string;
  pid?: number;
}

export interface ActivityEvent {
  eventId: string;
  ts: string;
  deviceId: string;
  platform: Platform;
  kind: ActivityKind;
  app: ActivityApp;
  windowTitle?: string;
  source: string;
}

export interface AgentActivityMessage {
  type: "activity";
  payload: ActivityEvent;
}

export type AgentIncomingMessage = AgentActivityMessage;

export interface SnapshotMessage {
  type: "snapshot";
  payload: {
    devices: ActivityEvent[];
  };
}

export interface ActivityBroadcastMessage {
  type: "activity";
  payload: ActivityEvent;
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
  | ErrorMessage;

export type ClientRole = "agent" | "dashboard";

export interface WsClientData {
  role: ClientRole;
  connectionId: string;
}
