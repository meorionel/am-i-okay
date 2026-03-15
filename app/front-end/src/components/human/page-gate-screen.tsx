"use client";

interface PageGateScreenProps {
	isVerifying: boolean;
	progress: number;
	errorMessage: string | null;
	onVerify: () => Promise<void>;
}

function formatProgress(progress: number): string {
	return `${Math.max(0, Math.min(100, Math.round(progress)))}%`;
}

export function PageGateScreen({
	isVerifying,
	progress,
	errorMessage,
	onVerify,
}: PageGateScreenProps) {
	return (
		<main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fffdf7_0%,#f6f3e9_48%,#ece8dc_100%)] px-6 text-stone-700">
			<div className="w-full max-w-md rounded-[2rem] border border-stone-200/80 bg-white/80 p-8 shadow-[0_30px_80px_rgba(120,113,108,0.16)] backdrop-blur">
				<p className="text-xs uppercase tracking-[0.32em] text-stone-400">Human Check</p>
				<h1 className="mt-4 font-[family-name:var(--font-editorial)] text-4xl leading-tight text-stone-800">
					进入前先让我们来做一次人机验证
				</h1>
				<div className="mt-7 rounded-2xl bg-stone-100/80 p-4">
					<div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-stone-400">
						<span>{isVerifying ? "Verifying" : errorMessage ? "Retry" : "Queued"}</span>
						<span>{formatProgress(progress)}</span>
					</div>
					<div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
						<div
							className="h-full rounded-full bg-stone-700 transition-[width] duration-300"
							style={{ width: `${Math.max(progress, isVerifying ? 6 : 0)}%` }}
						/>
					</div>
				</div>
				{errorMessage ? (
					<p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
						验证没有完成，原因是: {errorMessage}
					</p>
				) : null}
				{errorMessage ? (
					<button
						type="button"
						onClick={() => void onVerify()}
						disabled={isVerifying}
						className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-700 disabled:cursor-wait disabled:bg-stone-400"
					>
						{isVerifying ? "正在验证..." : "重新验证"}
					</button>
				) : (
					<p className="mt-6 text-center text-sm text-stone-500">
						验证正在进行, 完成之后页面会自动跳转
					</p>
				)}
			</div>
		</main>
	);
}
