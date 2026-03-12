import type { ServerWebSocket } from "bun";
import { parseAgentMessage } from "./schema";
import type { ActivityStore } from "./store";
import type {
  ActivityBroadcastMessage,
  ActivityEvent,
  ErrorMessage,
  ServerToDashboardMessage,
  SnapshotMessage,
  StatusBroadcastMessage,
  WsClientData,
} from "./types";
import { serializeMessage, toText } from "./utils";

type WsMessage = string | Uint8Array | ArrayBuffer;

export class WebSocketHub {
  private readonly agents = new Set<ServerWebSocket<WsClientData>>();
  private readonly dashboards = new Set<ServerWebSocket<WsClientData>>();
  private readonly deviceIdsByAgent = new Map<
    ServerWebSocket<WsClientData>,
    Set<string>
  >();

  constructor(private readonly store: ActivityStore) {}

  handleOpen(ws: ServerWebSocket<WsClientData>): void {
    if (ws.data.role === "agent") {
      this.agents.add(ws);
      this.deviceIdsByAgent.set(ws, new Set());
      console.log(`[ws] agent connected: ${ws.data.connectionId}`);
      return;
    }

    this.dashboards.add(ws);
    console.log(`[ws] dashboard connected: ${ws.data.connectionId}`);
    this.sendSnapshot(ws);
  }

  handleMessage(ws: ServerWebSocket<WsClientData>, message: WsMessage): void {
    const text = toText(message);

    if (ws.data.role !== "agent") {
      this.sendError(
        ws,
        "dashboard connection is read-only; agent must connect to /ws/agent",
      );
      ws.close(1008, "agent must connect to /ws/agent");
      return;
    }

    const parsed = parseAgentMessage(text);
    if (!parsed.ok) {
      this.sendError(ws, parsed.error);
      console.error(
        `[ws] invalid agent message: ${parsed.error} raw=${text.slice(0, 400)}`,
      );
      return;
    }

    if (parsed.data.type === "activity") {
      const event = parsed.data.payload;
      this.trackAgentDevice(ws, event.deviceId);
      this.store.upsert(event);
      this.broadcastActivity(event);
      console.log(
        `[ws] activity forwarded device=${event.deviceId} app=${event.app.name} eventId=${event.eventId}`,
      );
      return;
    }

    const status = parsed.data.payload;
    this.trackAgentDevice(ws, status.deviceId);
    this.store.upsertStatus(status);
    this.broadcastStatus(status);
    console.log(
      `[ws] status forwarded device=${status.deviceId} text=${JSON.stringify(status.statusText)}`,
    );
  }

  handleClose(
    ws: ServerWebSocket<WsClientData>,
    code: number,
    reason: string,
  ): void {
    if (ws.data.role === "agent") {
      this.agents.delete(ws);
      const deviceIds = this.deviceIdsByAgent.get(ws);
      this.deviceIdsByAgent.delete(ws);
      if (deviceIds && this.store.removeByDeviceIds(deviceIds)) {
        this.broadcastSnapshot();
      }
    } else {
      this.dashboards.delete(ws);
    }

    console.log(
      `[ws] ${ws.data.role} disconnected: ${ws.data.connectionId} code=${code} reason=${reason || "n/a"}`,
    );
  }

  private sendSnapshot(ws: ServerWebSocket<WsClientData>): void {
    const message = this.createSnapshotMessage();
    this.safeSend(ws, message);
  }

  private broadcastSnapshot(): void {
    this.broadcastToDashboards(this.createSnapshotMessage());
  }

  private createSnapshotMessage(): SnapshotMessage {
    const message: SnapshotMessage = {
      type: "snapshot",
      payload: {
        devices: this.store.getAll(),
        latestStatus: this.store.getLatestStatus(),
        deviceSnapshots: this.store.getDeviceSnapshots(),
        recentActivities: this.store.getRecentActivities(),
      },
    };

    return message;
  }

  private broadcastActivity(event: ActivityEvent): void {
    const message: ActivityBroadcastMessage = {
      type: "activity",
      payload: event,
    };

    this.broadcastToDashboards(message);
  }

  private broadcastStatus(status: import("./types").DeviceStatus): void {
    const message: StatusBroadcastMessage = {
      type: "status",
      payload: status,
    };

    this.broadcastToDashboards(message);
  }

  private broadcastToDashboards(message: ServerToDashboardMessage): void {
    const raw = serializeMessage(message);

    for (const ws of this.dashboards) {
      try {
        ws.send(raw);
      } catch (error) {
        console.error("[ws] failed to send dashboard message", error);
      }
    }
  }

  private sendError(ws: ServerWebSocket<WsClientData>, detail: string): void {
    const message: ErrorMessage = {
      type: "error",
      payload: { message: detail },
    };

    this.safeSend(ws, message);
  }

  private safeSend(
    ws: ServerWebSocket<WsClientData>,
    message: ServerToDashboardMessage | ErrorMessage,
  ): void {
    try {
      ws.send(serializeMessage(message));
    } catch (error) {
      console.error("[ws] failed to send websocket message", error);
    }
  }

  private trackAgentDevice(
    ws: ServerWebSocket<WsClientData>,
    deviceId: string,
  ): void {
    const knownDeviceIds = this.deviceIdsByAgent.get(ws);
    if (knownDeviceIds) {
      knownDeviceIds.add(deviceId);
      return;
    }

    this.deviceIdsByAgent.set(ws, new Set([deviceId]));
  }
}
