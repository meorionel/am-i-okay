"use client";

import { ActiveDevicesSection } from "@/src/components/dashboard/active-devices-section";
import { DashboardHeader } from "@/src/components/dashboard/dashboard-header";
import { RecentActivitySection } from "@/src/components/dashboard/recent-activity-section";
import { formatTimelineTime } from "@/src/components/dashboard/dashboard-utils";
import { useDashboardStream } from "@/src/hooks/use-dashboard-stream";

export default function Home() {
	const { devices, recentActivities, connectionStatus, lastEventAt } = useDashboardStream();
	const visibleTimeline = recentActivities.slice(0, 4);
	const lastUpdated = lastEventAt ? formatTimelineTime(new Date(lastEventAt).toISOString()) : null;

	return (
		<main className="min-h-screen bg-[linear-gradient(180deg,#fbfbf9_0%,#f5f5f1_42%,#efefe9_100%)] text-stone-700">
			<div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16 sm:px-8 sm:py-20">
				<DashboardHeader connectionStatus={connectionStatus} lastUpdated={lastUpdated} />
				<ActiveDevicesSection devices={devices} />
				<RecentActivitySection activities={visibleTimeline} />
			</div>
		</main>
	);
}
