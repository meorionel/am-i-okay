import { getDashboardWsUrl } from "@/src/lib/env";
import { parseDashboardMessage, type ActivityEvent } from "@/src/types/activity";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface DashboardWebSocketHandlers {
	onStatusChange?: (status: ConnectionStatus) => void;
	onSnapshot?: (devices: ActivityEvent[]) => void;
	onActivity?: (event: ActivityEvent) => void;
	onError?: (message: string) => void;
}

interface DashboardWebSocketOptions {
	wsUrl?: string;
	reconnectDelayMs?: number;
}

const DEFAULT_RECONNECT_DELAY_MS = 2000;

export class DashboardWebSocketClient {
	private ws: WebSocket | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private shouldReconnect = true;
	private readonly wsUrl: string;
	private readonly reconnectDelayMs: number;
	private readonly handlers: DashboardWebSocketHandlers;

	constructor(handlers: DashboardWebSocketHandlers, options?: DashboardWebSocketOptions) {
		this.handlers = handlers;
		this.wsUrl = options?.wsUrl ?? getDashboardWsUrl();
		this.reconnectDelayMs = options?.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
	}

	connect(): void {
		this.shouldReconnect = true;
		this.clearReconnectTimer();
		this.updateStatus("connecting");

		try {
			this.ws = new WebSocket(this.wsUrl);
		} catch (error) {
			this.updateStatus("error");
			this.handlers.onError?.("websocket initialization failed");
			this.scheduleReconnect();
			console.error("[ws] failed to create websocket", error);
			return;
		}

		this.ws.onopen = () => {
			this.updateStatus("connected");
		};

		this.ws.onmessage = (event: MessageEvent) => {
			this.handleMessage(event.data);
		};

		this.ws.onerror = () => {
			this.updateStatus("error");
			this.handlers.onError?.("websocket error");
		};

		this.ws.onclose = () => {
			this.ws = null;
			this.updateStatus("disconnected");

			if (this.shouldReconnect) {
				this.scheduleReconnect();
			}
		};
	}

	disconnect(): void {
		this.shouldReconnect = false;
		this.clearReconnectTimer();

		if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
			this.ws.close();
		}

		this.ws = null;
		this.updateStatus("disconnected");
	}

	private handleMessage(rawData: unknown): void {
		if (typeof rawData !== "string") {
			this.handlers.onError?.("unsupported websocket message format");
			return;
		}

		let parsed: unknown;

		try {
			parsed = JSON.parse(rawData);
		} catch (error) {
			this.handlers.onError?.("failed to parse websocket JSON");
			console.error("[ws] failed to parse message", error);
			return;
		}

		const message = parseDashboardMessage(parsed);
		if (!message) {
			this.handlers.onError?.("invalid websocket message");
			return;
		}

		if (message.type === "snapshot") {
			this.handlers.onSnapshot?.(message.payload.devices);
			return;
		}

		if (message.type === "activity") {
			this.handlers.onActivity?.(message.payload);
			return;
		}

		if (message.type === "error") {
			this.updateStatus("error");
			this.handlers.onError?.(message.payload.message);
		}
	}

	private scheduleReconnect(): void {
		if (!this.shouldReconnect || this.reconnectTimer) {
			return;
		}

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, this.reconnectDelayMs);
	}

	private clearReconnectTimer(): void {
		if (!this.reconnectTimer) {
			return;
		}

		clearTimeout(this.reconnectTimer);
		this.reconnectTimer = null;
	}

	private updateStatus(status: ConnectionStatus): void {
		this.handlers.onStatusChange?.(status);
	}
}
