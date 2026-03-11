import type { ServerWebSocket } from "bun";
import { parseAgentMessage } from "./schema";
import type { ActivityStore } from "./store";
import type {
  ActivityBroadcastMessage,
  ActivityEvent,
  ErrorMessage,
  ServerToDashboardMessage,
  SnapshotMessage,
  WsClientData,
} from "./types";
import { serializeMessage, toText } from "./utils";

type WsMessage = string | Uint8Array | ArrayBuffer;

export class WebSocketHub {
  private readonly agents = new Set<ServerWebSocket<WsClientData>>();
  private readonly dashboards = new Set<ServerWebSocket<WsClientData>>();

  constructor(private readonly store: ActivityStore) {}

  handleOpen(ws: ServerWebSocket<WsClientData>): void {
    if (ws.data.role === "agent") {
      this.agents.add(ws);
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
      this.sendError(ws, "dashboard connection is read-only");
      return;
    }

    const parsed = parseAgentMessage(text);
    if (!parsed.ok) {
      this.sendError(ws, parsed.error);
      console.error(`[ws] invalid agent message: ${parsed.error}`);
      return;
    }

    const event = parsed.data.payload;
    this.store.upsert(event);
    this.broadcastActivity(event);
    console.log(
      `[ws] activity forwarded device=${event.deviceId} app=${event.app.name} eventId=${event.eventId}`,
    );
  }

  handleClose(
    ws: ServerWebSocket<WsClientData>,
    code: number,
    reason: string,
  ): void {
    if (ws.data.role === "agent") {
      this.agents.delete(ws);
    } else {
      this.dashboards.delete(ws);
    }

    console.log(
      `[ws] ${ws.data.role} disconnected: ${ws.data.connectionId} code=${code} reason=${reason || "n/a"}`,
    );
  }

  private sendSnapshot(ws: ServerWebSocket<WsClientData>): void {
    const message: SnapshotMessage = {
      type: "snapshot",
      payload: {
        devices: this.store.getAll(),
      },
    };
    this.safeSend(ws, message);
  }

  private broadcastActivity(event: ActivityEvent): void {
    const message: ActivityBroadcastMessage = {
      type: "activity",
      payload: event,
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
}
