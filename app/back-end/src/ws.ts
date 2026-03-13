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

    const agentIdentity = ws.data.agent;
    if (!agentIdentity) {
      this.sendError(ws, "missing authenticated agent identity");
      ws.close(1008, "missing agent identity");
      return;
    }

    if (parsed.data.type === "activity") {
      const event = parsed.data.payload;
      if (
        event.deviceId !== agentIdentity.deviceId ||
        event.agentName !== agentIdentity.agentName ||
        (agentIdentity.platform && event.platform !== agentIdentity.platform)
      ) {
        this.sendError(ws, "agent identity mismatch");
        ws.close(1008, "agent identity mismatch");
        return;
      }

      const trustedEvent: ActivityEvent = {
        ...event,
        deviceId: agentIdentity.deviceId,
        agentName: agentIdentity.agentName,
        platform: agentIdentity.platform ?? event.platform,
      };
      this.trackAgentDevice(ws, trustedEvent.deviceId);
      this.store.upsert(trustedEvent);
      this.broadcastActivity(trustedEvent);
      console.log(
        `[ws] activity forwarded device=${trustedEvent.deviceId} app=${trustedEvent.app.name} eventId=${trustedEvent.eventId}`,
      );
      return;
    }

    const status = parsed.data.payload;
    if (
      status.deviceId !== agentIdentity.deviceId ||
      status.agentName !== agentIdentity.agentName ||
      (agentIdentity.platform && status.platform !== agentIdentity.platform)
    ) {
      this.sendError(ws, "agent identity mismatch");
      ws.close(1008, "agent identity mismatch");
      return;
    }

    const trustedStatus = {
      ...status,
      deviceId: agentIdentity.deviceId,
      agentName: agentIdentity.agentName,
      platform: agentIdentity.platform ?? status.platform,
    };

    this.trackAgentDevice(ws, trustedStatus.deviceId);
    this.store.upsertStatus(trustedStatus);
    this.broadcastStatus(trustedStatus);
    console.log(
      `[ws] status forwarded device=${trustedStatus.deviceId} text=${JSON.stringify(trustedStatus.statusText)}`,
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
