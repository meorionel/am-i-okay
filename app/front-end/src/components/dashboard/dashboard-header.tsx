interface DashboardHeaderProps {
	connectionStatus: string;
	lastUpdated: string | null;
	onlineCount: number | null;
}

export function DashboardHeader({
	connectionStatus,
	onlineCount,
}: DashboardHeaderProps) {
	return (
		<section className="max-w-xl">
			<h1 className="font-(family-name:--font-editorial) text-[2.4rem] font-light tracking-[-0.05em] text-stone-800 sm:text-[3.2rem]">Am I Okay</h1>
			<p className="mt-3 text-sm font-light italic tracking-[-0.01em] text-stone-400 sm:text-base">我是傻福, 我忘记加鉴权了, 后台先关了.</p>
			<div className="mt-6 flex flex-wrap items-center gap-3 text-[11px] text-stone-400 sm:text-xs">
				<span className="rounded-full border border-stone-200/80 bg-white/85 px-3 py-1.5 shadow-[0_10px_25px_rgba(120,113,108,0.06)]">
					{connectionStatus}
				</span>
				<span className="text-xs font-light text-stone-500">
					{onlineCount !== null ? `当前有 ${onlineCount} 个人在偷偷看我在做什么` : "在线人数仅在开发模式显示"}
				</span>
			</div>
		</section>
	);
}
