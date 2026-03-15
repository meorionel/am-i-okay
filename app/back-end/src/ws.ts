import { validateHumanToken } from "./cap";
import { moderateMessageContent } from "./message-moderation";
import { MessageRateLimiter } from "./message-rate-limit";
import type { FoodStore } from "./food";
import type { ServerWebSocket } from "bun";
import { parseAgentMessage } from "./schema";
import type { ActivityStore } from "./store";
import type {
  ActivityBroadcastMessage,
  ActivityEvent,
  ErrorMessage,
  FoodSnapshotMessage,
  FoodUpdateMessage,
  MessageAckMessage,
  MessageBroadcastMessage,
  MessageItem,
  MessageSnapshotMessage,
  OnlineCountMessage,
  ServerToDashboardMessage,
  SnapshotMessage,
  StatusBroadcastMessage,
  WsClientData,
} from "./types";
import { serializeMessage, toText } from "./utils";

type WsMessage = string | Uint8Array | ArrayBuffer;
const MESSAGE_POOL_LIMIT = 10;

export class WebSocketHub {
  private readonly agents = new Set<ServerWebSocket<WsClientData>>();
  private readonly dashboards = new Set<ServerWebSocket<WsClientData>>();
  private readonly foodSubscribers = new Set<ServerWebSocket<WsClientData>>();
  private readonly messageSubscribers = new Set<ServerWebSocket<WsClientData>>();
  private readonly messageRateLimiter = new MessageRateLimiter();
  private readonly messagePool: MessageItem[] = [];
  private readonly deviceIdsByAgent = new Map<
    ServerWebSocket<WsClientData>,
    Set<string>
  >();

  constructor(
    private readonly store: ActivityStore,
    private readonly foodStore: FoodStore,
  ) {}

  handleOpen(ws: ServerWebSocket<WsClientData>): void {
    if (ws.data.role === "agent") {
      this.agents.add(ws);
      this.deviceIdsByAgent.set(ws, new Set());
      console.log(`[ws] agent connected: ${ws.data.connectionId}`);
      return;
    }

    if (ws.data.role === "food") {
      this.foodSubscribers.add(ws);
      console.log(`[ws] food subscriber connected: ${ws.data.connectionId}`);
      this.sendFoodSnapshot(ws);
      return;
    }

    if (ws.data.role === "message") {
      this.messageSubscribers.add(ws);
      console.log(`[ws] message subscriber connected: ${ws.data.connectionId}`);
      this.sendMessageSnapshot(ws);
      return;
    }

    this.dashboards.add(ws);
    console.log(`[ws] dashboard connected: ${ws.data.connectionId}`);
    this.sendSnapshot(ws);
    this.broadcastOnlineCount();
  }

  async handleMessage(
    ws: ServerWebSocket<WsClientData>,
    message: WsMessage,
  ): Promise<void> {
    const text = toText(message);

    if (ws.data.role === "message") {
      await this.handleMessageBoardInput(ws, text);
      return;
    }

    if (ws.data.role !== "agent") {
      this.sendError(ws, `${ws.data.role} connection is read-only`, "READ_ONLY");
      ws.close(1008, `${ws.data.role} is read-only`);
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
    } else if (ws.data.role === "food") {
      this.foodSubscribers.delete(ws);
    } else if (ws.data.role === "message") {
      this.messageSubscribers.delete(ws);
    } else {
      this.dashboards.delete(ws);
      this.broadcastOnlineCount();
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

  broadcastFoodUpdate(): void {
    for (const ws of this.foodSubscribers) {
      const viewerId = ws.data.viewerId;
      if (!viewerId) {
        continue;
      }

      const message: FoodUpdateMessage = {
        type: "food_update",
        payload: {
          foods: this.foodStore.listFoods(viewerId),
        },
      };
      this.safeSend(ws, message);
    }
  }

  private createSnapshotMessage(): SnapshotMessage {
    const message: SnapshotMessage = {
      type: "snapshot",
      payload: {
        devices: this.store.getAll(),
        latestStatus: this.store.getLatestStatus(),
        deviceSnapshots: this.store.getDeviceSnapshots(),
        recentActivities: this.store.getRecentActivities(),
        onlineCount: this.dashboards.size,
      },
    };

    return message;
  }

  private broadcastOnlineCount(): void {
    const message: OnlineCountMessage = {
      type: "online-count",
      payload: {
        count: this.dashboards.size,
      },
    };

    this.broadcastToDashboards(message);
  }

  private sendFoodSnapshot(ws: ServerWebSocket<WsClientData>): void {
    const viewerId = ws.data.viewerId;
    if (!viewerId) {
      this.sendError(ws, "missing food viewer identity");
      ws.close(1008, "missing food viewer identity");
      return;
    }

    const message: FoodSnapshotMessage = {
      type: "food_snapshot",
      payload: {
        foods: this.foodStore.listFoods(viewerId),
      },
    };
    this.safeSend(ws, message);
  }

  private sendMessageSnapshot(ws: ServerWebSocket<WsClientData>): void {
    this.pruneExpiredMessages();
    const message: MessageSnapshotMessage = {
      type: "message_snapshot",
      payload: {
        messages: this.messagePool,
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

  private sendError(
    ws: ServerWebSocket<WsClientData>,
    detail: string,
    code?: string,
    requestId?: string,
    retryAfterMs?: number,
    frozenUntil?: string,
  ): void {
    const message: ErrorMessage = {
      type: "error",
      payload: {
        message: detail,
        code,
        requestId,
        retryAfterMs,
        frozenUntil,
      },
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

  private async handleMessageBoardInput(
    ws: ServerWebSocket<WsClientData>,
    rawMessage: string,
  ): Promise<void> {
    const viewerId = ws.data.viewerId;
    const ip = ws.data.ip ?? "unknown";
    if (!viewerId) {
      this.sendError(ws, "missing message viewer identity", "MISSING_VIEWER");
      ws.close(1008, "missing message viewer identity");
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawMessage);
    } catch {
      this.sendError(ws, "message payload must be valid JSON", "INVALID_JSON");
      return;
    }

    if (typeof payload !== "object" || payload === null) {
      this.sendError(ws, "message payload must be a JSON object", "INVALID_PAYLOAD");
      return;
    }

    const candidate = payload as Record<string, unknown>;
    const type = candidate.type;
    const requestId = typeof candidate.requestId === "string" ? candidate.requestId.trim() : "";
    const body = typeof candidate.body === "string" ? candidate.body.trim() : "";
    const humanToken =
      typeof candidate.humanToken === "string" ? candidate.humanToken.trim() : "";

    if (type !== "message_send") {
      this.sendError(ws, "unsupported message websocket event", "UNSUPPORTED_EVENT", requestId);
      return;
    }

    if (!requestId) {
      this.sendError(ws, "missing requestId", "INVALID_REQUEST_ID");
      return;
    }

    if (body.length === 0) {
      this.sendError(ws, "留言不能为空", "EMPTY_MESSAGE", requestId);
      return;
    }

    if (body.length > 20) {
      this.sendError(ws, "留言不能超过 20 个字符", "MESSAGE_TOO_LONG", requestId);
      return;
    }

    if (humanToken.length === 0) {
      this.sendError(ws, "缺少人机验证结果", "MISSING_HUMAN_TOKEN", requestId);
      return;
    }

    const rateLimit = this.messageRateLimiter.registerAttempt(viewerId, ip);
    if (!rateLimit.ok) {
      this.sendError(
        ws,
        rateLimit.message,
        rateLimit.code,
        requestId,
        rateLimit.retryAfterMs,
        rateLimit.frozenUntil,
      );
      return;
    }

    const isHuman = await validateHumanToken("message", humanToken);
    if (!isHuman) {
      this.sendError(ws, "人机验证未通过，请重试", "INVALID_HUMAN_TOKEN", requestId);
      return;
    }

    const moderation = await moderateMessageContent(body);
    if (!moderation.ok) {
      this.sendError(
        ws,
        moderation.detail ?? "留言包含敏感内容，已被拦截。",
        "SENSITIVE_WORD",
        requestId,
      );
      return;
    }

    this.pruneExpiredMessages();

    const messageItem: MessageItem = {
      id: crypto.randomUUID(),
      body,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3 * 60_000).toISOString(),
    };

    this.messagePool.push(messageItem);
    if (this.messagePool.length > MESSAGE_POOL_LIMIT) {
      this.messagePool.splice(0, this.messagePool.length - MESSAGE_POOL_LIMIT);
    }

    const message: MessageBroadcastMessage = {
      type: "message",
      payload: messageItem,
    };

    this.broadcastToMessages(message);

    const ack: MessageAckMessage = {
      type: "message_ack",
      payload: {
        requestId,
        nextAllowedAt: this.messageRateLimiter.markSuccess(viewerId),
      },
    };
    this.safeSend(ws, ack);
  }

  private broadcastToMessages(message: MessageBroadcastMessage): void {
    for (const ws of this.messageSubscribers) {
      this.safeSend(ws, message);
    }
  }

  private pruneExpiredMessages(): void {
    const now = Date.now();
    const nextMessages = this.messagePool.filter((message) => {
      const expiresAt = new Date(message.expiresAt).getTime();
      return Number.isFinite(expiresAt) && expiresAt > now;
    });

    if (nextMessages.length === this.messagePool.length) {
      return;
    }

    this.messagePool.splice(0, this.messagePool.length, ...nextMessages);
  }
}
