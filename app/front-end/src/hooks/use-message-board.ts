"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { gooeyToast } from "goey-toast";
import { pushMessageToast } from "@/src/components/message-toast-provider";
import { createMessageSocket } from "@/src/lib/api";
import { solveHumanChallenge } from "@/src/lib/human-gate";
import { createRandomId } from "@/src/lib/random";
import { parseMessageSocketMessage } from "@/src/types/activity";

const MESSAGE_SOCKET_RETRY_MS = 2_000;
const MESSAGE_COOLDOWN_STORAGE_KEY = "amiokay_message_cooldown_until";

type PendingRequest = {
	resolve: () => void;
	reject: (error: Error) => void;
	timer: number;
};

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function useMessageBoard(enabled: boolean, pageId: string): {
	draft: string;
	setDraft: (value: string) => void;
	sendMessage: () => Promise<void>;
	isSending: boolean;
	isConnected: boolean;
	cooldownRemainingMs: number;
} {
	const [draft, setDraft] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [isConnected, setIsConnected] = useState(false);
	const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
	const socketRef = useRef<WebSocket | null>(null);
	const reconnectTimerRef = useRef<number | null>(null);
	const seenMessageIdsRef = useRef(new Set<string>());
	const pendingRequestsRef = useRef(new Map<string, PendingRequest>());

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const rawValue = window.localStorage.getItem(MESSAGE_COOLDOWN_STORAGE_KEY);
		if (!rawValue) {
			return;
		}

		const nextAllowedAt = new Date(rawValue).getTime();
		if (!Number.isFinite(nextAllowedAt)) {
			window.localStorage.removeItem(MESSAGE_COOLDOWN_STORAGE_KEY);
			return;
		}

		setCooldownRemainingMs(Math.max(0, nextAllowedAt - Date.now()));
	}, []);

	useEffect(() => {
		if (cooldownRemainingMs <= 0) {
			if (typeof window !== "undefined") {
				window.localStorage.removeItem(MESSAGE_COOLDOWN_STORAGE_KEY);
			}
			return;
		}

		const timer = window.setInterval(() => {
			setCooldownRemainingMs((current) => {
				if (current <= 1_000) {
					window.clearInterval(timer);
					if (typeof window !== "undefined") {
						window.localStorage.removeItem(MESSAGE_COOLDOWN_STORAGE_KEY);
					}
					return 0;
				}

				return current - 1_000;
			});
		}, 1_000);

		return () => {
			window.clearInterval(timer);
		};
	}, [cooldownRemainingMs]);

	const syncCooldown = useEffectEvent((nextAllowedAt: string): void => {
		const nextAllowedAtMs = new Date(nextAllowedAt).getTime();
		if (!Number.isFinite(nextAllowedAtMs)) {
			return;
		}

		const remainingMs = Math.max(0, nextAllowedAtMs - Date.now());
		setCooldownRemainingMs(remainingMs);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(MESSAGE_COOLDOWN_STORAGE_KEY, new Date(nextAllowedAtMs).toISOString());
		}
	});

	const applyRetryAfterMs = useEffectEvent((retryAfterMs: number | undefined): void => {
		if (retryAfterMs === undefined || retryAfterMs <= 0) {
			return;
		}

		const nextAllowedAt = new Date(Date.now() + retryAfterMs).toISOString();
		syncCooldown(nextAllowedAt);
	});

	useEffect(() => {
		if (!enabled) {
			setIsConnected(false);
			socketRef.current?.close();
			socketRef.current = null;
			return;
		}

		let isActive = true;

		const rejectPendingRequests = (message: string): void => {
			for (const [requestId, pending] of pendingRequestsRef.current) {
				window.clearTimeout(pending.timer);
				pending.reject(new Error(message));
				pendingRequestsRef.current.delete(requestId);
			}
		};

		const scheduleReconnect = (): void => {
			if (!isActive || reconnectTimerRef.current !== null) {
				return;
			}

			reconnectTimerRef.current = window.setTimeout(() => {
				reconnectTimerRef.current = null;
				void connectSocket();
			}, MESSAGE_SOCKET_RETRY_MS);
		};

		const connectSocket = async (): Promise<void> => {
			try {
				const url = await createMessageSocket(pageId);
				if (!isActive) {
					return;
				}

				const socket = new WebSocket(url);
				socketRef.current = socket;

				socket.onopen = () => {
					if (!isActive) {
						return;
					}

					setIsConnected(true);
				};

				socket.onmessage = (event) => {
					if (!isActive) {
						return;
					}

					try {
						const message = parseMessageSocketMessage(JSON.parse(event.data));
						if (!message) {
							return;
						}

						if (message.type === "message") {
							if (seenMessageIdsRef.current.has(message.payload.id)) {
								return;
							}

							seenMessageIdsRef.current.add(message.payload.id);
							pushMessageToast(message.payload);
							return;
						}

						if (message.type === "message_ack") {
							const pending = pendingRequestsRef.current.get(message.payload.requestId);
							if (!pending) {
								return;
							}

							window.clearTimeout(pending.timer);
							syncCooldown(message.payload.nextAllowedAt);
							pending.resolve();
							pendingRequestsRef.current.delete(message.payload.requestId);
							return;
						}

						if (message.payload.requestId) {
							const pending = pendingRequestsRef.current.get(message.payload.requestId);
							if (pending) {
								window.clearTimeout(pending.timer);
								applyRetryAfterMs(message.payload.retryAfterMs);
								pending.reject(new Error(message.payload.message));
								pendingRequestsRef.current.delete(message.payload.requestId);
								return;
							}
						}

						applyRetryAfterMs(message.payload.retryAfterMs);
						gooeyToast.error(message.payload.message, {
							duration: 2800,
						});
					} catch (error) {
						console.warn("[message-ws] failed to parse websocket payload", error);
					}
				};

				socket.onclose = () => {
					if (!isActive) {
						return;
					}

					setIsConnected(false);
					socketRef.current = null;
					rejectPendingRequests("留言连接已断开，请稍后重试。");
					scheduleReconnect();
				};

				socket.onerror = (error) => {
					console.warn("[message-ws] websocket error", error);
				};
			} catch (error) {
				console.warn("[message-ws] failed to establish websocket", error);
				if (isActive) {
					setIsConnected(false);
					scheduleReconnect();
				}
			}
		};

		void connectSocket();

		return () => {
			isActive = false;
			setIsConnected(false);

			if (reconnectTimerRef.current !== null) {
				window.clearTimeout(reconnectTimerRef.current);
				reconnectTimerRef.current = null;
			}

			rejectPendingRequests("留言连接已关闭");
			socketRef.current?.close();
			socketRef.current = null;
		};
	}, [enabled, pageId]);

	const sendMessage = async (): Promise<void> => {
		if (isSending) {
			return;
		}

		if (cooldownRemainingMs > 0) {
			gooeyToast.warning("留言冷却中，请稍后再试。", {
				duration: 2200,
			});
			return;
		}

		const body = draft.trim();
		if (!body) {
			gooeyToast.warning("先写点什么再发送吧。", {
				duration: 2200,
			});
			return;
		}

		if (body.length > 20) {
			gooeyToast.warning("留言最多 20 个字。", {
				duration: 2200,
			});
			return;
		}

		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			gooeyToast.error("留言通道还没连上，请稍等一下。", {
				duration: 2600,
			});
			return;
		}

		setIsSending(true);

		try {
			const humanToken = await solveHumanChallenge("/api/human/message");
			const requestId = createRandomId();

			const pending = new Promise<void>((resolve, reject) => {
				const timer = window.setTimeout(() => {
					pendingRequestsRef.current.delete(requestId);
					reject(new Error("留言发送超时，请稍后再试。"));
				}, 10_000);

				pendingRequestsRef.current.set(requestId, {
					resolve,
					reject,
					timer,
				});
			});

			socket.send(
				JSON.stringify({
					type: "message_send",
					requestId,
					body,
					humanToken,
				}),
			);

			await pending;
			setDraft("");
		} catch (error) {
			gooeyToast.error(toErrorMessage(error), {
				duration: 3200,
			});
		} finally {
			setIsSending(false);
		}
	};

	return {
		draft,
		setDraft,
		sendMessage,
		isSending,
		isConnected,
		cooldownRemainingMs,
	};
}
