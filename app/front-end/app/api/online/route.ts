import { NextRequest } from "next/server";
import { getOnlineMaxConnections, isOnlineApiEnabled } from "@/src/lib/server/env";

export const dynamic = "force-dynamic";

interface OnlineMessage {
	type: "online-count";
	payload: {
		count: number;
	};
}

type OnlineStreamController = ReadableStreamDefaultController<string>;

type OnlineGlobal = typeof globalThis & {
	__amIOkayOnlineClients?: Set<OnlineStreamController>;
};

const globalWithOnlineClients = globalThis as OnlineGlobal;
const onlineClients =
	globalWithOnlineClients.__amIOkayOnlineClients ??
	new Set<OnlineStreamController>();

if (!globalWithOnlineClients.__amIOkayOnlineClients) {
	globalWithOnlineClients.__amIOkayOnlineClients = onlineClients;
}

function createPayload(count: number): string {
	const message: OnlineMessage = {
		type: "online-count",
		payload: { count },
	};

	return `data: ${JSON.stringify(message)}\n\n`;
}

function broadcastOnlineCount(): void {
	const payload = createPayload(onlineClients.size);

	for (const controller of [...onlineClients]) {
		try {
			controller.enqueue(payload);
		} catch (error) {
			console.error("[api/online] failed to push online count", error);
			onlineClients.delete(controller);
		}
	}
}

export async function GET(request: NextRequest): Promise<Response> {
	if (!isOnlineApiEnabled()) {
		return new Response("Not Found", { status: 404 });
	}

	if (onlineClients.size >= getOnlineMaxConnections()) {
		return new Response("Too Many Connections", { status: 429 });
	}

	let controllerRef: OnlineStreamController | null = null;

	const removeClient = () => {
		if (!controllerRef) {
			return;
		}

		const controller = controllerRef;
		controllerRef = null;

		if (onlineClients.delete(controller)) {
			try {
				controller.close();
			} catch {}
			broadcastOnlineCount();
		}
	};

	const stream = new ReadableStream<string>({
		start(controller) {
			controllerRef = controller;
			onlineClients.add(controller);
			controller.enqueue(createPayload(onlineClients.size));
			broadcastOnlineCount();

			request.signal.addEventListener("abort", removeClient, { once: true });
		},
		cancel() {
			removeClient();
		},
	});

	return new Response(stream, {
		headers: {
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"Content-Type": "text/event-stream; charset=utf-8",
		},
	});
}
