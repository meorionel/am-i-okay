function formatRemainingTime(ms: number): string {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function GuestbookComposer({
	draft,
	setDraft,
	onSubmit,
	isSending,
	cooldownRemainingMs,
}: {
	draft: string;
	setDraft: (value: string) => void;
	onSubmit: () => void;
	isSending: boolean;
	cooldownRemainingMs: number;
}) {
	return (
		<section className="mb-20">
			<textarea
				value={draft}
				maxLength={20}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event) => {
					if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing) {
						event.preventDefault();
						onSubmit();
					}
				}}
				placeholder="What's on your mind?"
				className="min-h-28 w-full resize-none border-none bg-transparent p-0 text-lg leading-relaxed text-stone-700 outline-none placeholder:text-stone-300"
			/>
			<div className="mt-4 flex items-center justify-end">
				<button
					type="button"
					onClick={onSubmit}
					disabled={isSending || cooldownRemainingMs > 0 || !draft.trim()}
					className="text-sm font-medium uppercase tracking-[0.28em] text-stone-400 transition hover:text-stone-700 disabled:cursor-not-allowed disabled:text-stone-300"
				>
					{isSending ? "Posting" : cooldownRemainingMs > 0 ? formatRemainingTime(cooldownRemainingMs) : "Post"}
				</button>
			</div>
		</section>
	);
}
