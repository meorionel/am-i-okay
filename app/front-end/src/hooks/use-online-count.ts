"use client";

import { useEffect, useState } from "react";

type OnlineMessage = {
	type: "online-count";
	payload: {
		count: number;
	};
};

function parseOnlineMessage(raw: unknown): number | null {
	if (typeof raw !== "string") {
		return null;
	}

	try {
		const message = JSON.parse(raw) as OnlineMessage;
		if (message.type !== "online-count") {
			return null;
		}

		const count = message.payload?.count;
		if (typeof count !== "number" || !Number.isFinite(count)) {
			return null;
		}

		return count;
	} catch {
		return null;
	}
}

function buildOnlineStreamUrl(pageId: string): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	return `${window.location.origin}/api/online?pageId=${encodeURIComponent(pageId)}`;
}

export function useOnlineCount(enabled: boolean, pageId: string): number | null {
	const [count, setCount] = useState<number | null>(null);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const url = buildOnlineStreamUrl(pageId);
		if (!url) {
			return;
		}

		let eventSource: EventSource | null = null;
		let isActive = true;
		eventSource = new EventSource(url);

		eventSource.onmessage = (event) => {
			if (!isActive) {
				return;
			}

			const nextCount = parseOnlineMessage(event.data);
			if (nextCount !== null) {
				setCount(nextCount);
			}
		};

		eventSource.onerror = () => {
			// EventSource retries automatically; keep the last known count.
		};

		return () => {
			isActive = false;
			if (eventSource) {
				eventSource.close();
			}
		};
	}, [enabled, pageId]);

	return enabled ? count : null;
}
