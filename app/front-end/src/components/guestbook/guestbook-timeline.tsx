import type { GuestbookMessage } from "@/src/types/guestbook";

function formatMessageTime(isoTimestamp: string): string {
	const date = new Date(isoTimestamp);
	const now = new Date();

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "2-digit",
		...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	}).format(date);
}

export function GuestbookTimeline({
	messages,
	isLoading,
	page,
	totalPages,
	onPrevPage,
	onNextPage,
}: {
	messages: GuestbookMessage[];
	isLoading: boolean;
	page: number;
	totalPages: number;
	onPrevPage: () => void;
	onNextPage: () => void;
}) {
	return (
		<section className="relative pl-8">
			<div className="space-y-10">
				{messages.map((message) => (
					<article key={message.id} className="relative">
						<div className="absolute left-[-26px] top-1 size-[7px] rounded-full bg-stone-300" aria-hidden="true" />
						<div className="flex flex-col gap-2">
							<span className="text-[10px] uppercase tracking-[0.28em] text-stone-400">{formatMessageTime(message.createdAt)}</span>
							<p className="font-[var(--font-editorial)] text-[17px] leading-8 text-stone-700">{message.body}</p>
						</div>
					</article>
				))}
				{!isLoading && messages.length === 0 ? (
					<div className="relative">
						<div className="absolute left-[-26px] top-2 size-[7px] rounded-full bg-stone-200" aria-hidden="true" />
						<p className="text-sm leading-7 text-stone-400">No entries yet. Be the first to leave a note.</p>
					</div>
				) : null}
			</div>

			<div className="mt-12 flex items-center justify-between gap-6">
				<button
					type="button"
					onClick={onPrevPage}
					disabled={page <= 1 || isLoading}
					className="text-[10px] uppercase tracking-[0.28em] text-stone-400 transition hover:text-stone-600 disabled:cursor-not-allowed disabled:text-stone-300"
				>
					← prev
				</button>
				<p className="text-[10px] uppercase tracking-[0.28em] text-stone-400">
					{isLoading ? "Loading..." : totalPages > 0 ? `Page ${page} / ${totalPages}` : "Page 1 / 1"}
				</p>
				<button
					type="button"
					onClick={onNextPage}
					disabled={totalPages === 0 || page >= totalPages || isLoading}
					className="text-[10px] uppercase tracking-[0.28em] text-stone-400 transition hover:text-stone-600 disabled:cursor-not-allowed disabled:text-stone-300"
				>
					next →
				</button>
			</div>
		</section>
	);
}
