"use client";

import { useMessageBoard } from "@/src/hooks/use-message-board";

function formatRemainingTime(ms: number): string {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MessageBoardSection({ enabled, pageId }: { enabled: boolean; pageId: string }) {
	const { draft, setDraft, sendMessage, isSending, cooldownRemainingMs } = useMessageBoard(enabled, pageId);
	const isCoolingDown = cooldownRemainingMs > 0;

	return (
		<section className="mt-6">
			<div className="flex flex-col gap-3 sm:flex-row">
				<input
					type="text"
					value={draft}
					maxLength={20}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.nativeEvent.isComposing) {
							event.preventDefault();
							void sendMessage();
						}
					}}
					placeholder="写这里写留言哦"
					className="h-12 flex-1 rounded-2xl border border-stone-200 bg-white/80 px-4 text-sm text-stone-700 outline-none transition focus:border-stone-300 focus:bg-white"
				/>
				<button
					type="button"
					onClick={() => void sendMessage()}
					disabled={isSending || isCoolingDown || !draft.trim()}
					className="inline-flex h-12 min-w-28 items-center justify-center rounded-2xl bg-stone-900 px-5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
				>
					{isSending ? "发送中..." : isCoolingDown ? formatRemainingTime(cooldownRemainingMs) : "发送留言"}
				</button>
			</div>
		</section>
	);
}
