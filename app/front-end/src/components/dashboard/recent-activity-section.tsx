import type { RecentActivity } from "@/src/types/activity";
import { formatDeviceLabel, formatSecondaryLine, formatTimelineTime, getActivityKey } from "@/src/components/dashboard/dashboard-utils";

interface RecentActivitySectionProps {
	activities: RecentActivity[];
}

export function RecentActivitySection({ activities }: RecentActivitySectionProps) {
	return (
		<section className="mt-16 sm:mt-20">
			<p className="text-[11px] font-semibold tracking-[0.28em] text-stone-400 uppercase sm:text-xs">Recent Activity</p>
			{activities.length > 0 ? (
				<div className="relative mt-7 pl-8 sm:pl-10">
					<div className="absolute left-3 top-3 bottom-4 w-px bg-stone-200 sm:left-3.5" />
					<div className="space-y-9">
						{activities.map((event) => {
							const secondaryLine = formatSecondaryLine(event);

							return (
								<article key={getActivityKey(event)} className="relative">
									<span className="absolute -left-[1.45rem] top-1.5 h-3 w-3 rounded-full border-2 border-[#f5f5f0] bg-stone-200 sm:-left-8" />
									<p className="text-xs leading-none text-stone-400 sm:text-sm">
										{event.displayTime ?? formatTimelineTime(event.ts)}
									</p>
									<p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base tracking-[-0.03em] text-stone-700 sm:text-[1.08rem]">
										<span className="font-medium text-stone-700">{event.app.title}</span>
										<span className="text-xs text-stone-400 sm:text-sm">on {formatDeviceLabel(event)}</span>
									</p>
									{secondaryLine ? <p className="mt-1.5 text-xs italic text-stone-400 sm:text-sm">{secondaryLine}</p> : null}
								</article>
							);
						})}
					</div>
				</div>
			) : (
				<p className="mt-5 text-sm text-stone-400">Activity history will appear here once more devices report in.</p>
			)}
		</section>
	);
}
