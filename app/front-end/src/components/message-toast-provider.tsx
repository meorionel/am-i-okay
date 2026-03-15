"use client";

import { Toaster, toast } from "sonner";

const MESSAGE_POOL_LIMIT = 10;
const messageOrder: string[] = [];

function getToastId(id: string): string {
	return `message-${id}`;
}

function trimMessagePool(): void {
	while (messageOrder.length > MESSAGE_POOL_LIMIT) {
		const oldestId = messageOrder.shift();
		if (!oldestId) {
			return;
		}

		toast.dismiss(getToastId(oldestId));
	}
}

export function pushMessageToast(payload: { id: string; body: string; expiresAt: string }): void {
	if (typeof window === "undefined") {
		return;
	}

	const remainingMs = new Date(payload.expiresAt).getTime() - Date.now();
	if (remainingMs <= 0) {
		return;
	}

	const existingIndex = messageOrder.indexOf(payload.id);
	if (existingIndex >= 0) {
		messageOrder.splice(existingIndex, 1);
	}

	messageOrder.push(payload.id);
	trimMessagePool();

	toast.custom(
		(toastId) => (
			<div className="rounded-2xl border border-stone-200/80 bg-white/95 px-4 py-3 text-sm text-stone-700 shadow-[0_18px_48px_rgba(28,25,23,0.18)] backdrop-blur">
				<div className="flex items-start gap-3">
					<p className="min-w-0 flex-1 break-words whitespace-pre-wrap leading-6">{payload.body}</p>
					<button
						type="button"
						aria-label="关闭留言通知"
						onClick={() => toast.dismiss(toastId)}
						className="pointer-events-auto inline-flex size-6 shrink-0 items-center justify-center text-sm leading-none text-stone-400 transition hover:border-stone-300 hover:text-stone-600"
					>
						<svg
							aria-hidden="true"
							viewBox="0 0 16 16"
							className="size-4"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
						>
							<path d="M4 4l8 8" />
							<path d="M12 4 4 12" />
						</svg>
					</button>
				</div>
			</div>
		),
		{
			id: getToastId(payload.id),
			duration: remainingMs,
			toasterId: "message",
			unstyled: true,
		},
	);
}

export function replaceMessageToasts(messages: { id: string; body: string; expiresAt: string }[]): void {
	if (typeof window === "undefined") {
		return;
	}

	for (const id of messageOrder) {
		toast.dismiss(getToastId(id));
	}
	messageOrder.length = 0;

	for (const message of messages.slice(-MESSAGE_POOL_LIMIT)) {
		pushMessageToast(message);
	}
}

export function MessageToastProvider() {
	return (
		<Toaster
			id="message"
			position="bottom-right"
			offset={24}
			visibleToasts={10}
			closeButton={false}
			expand={false}
			duration={3 * 60_000}
			toastOptions={{
				unstyled: true,
				classNames: {
					toast: "bg-transparent border-0 shadow-none p-0",
					content: "p-0",
				},
			}}
		/>
	);
}
