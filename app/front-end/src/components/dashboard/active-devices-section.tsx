import type { ActivityEvent } from "@/src/types/activity";
import { ActiveDeviceCard } from "@/src/components/dashboard/active-device-card";
import { getActivityKey } from "@/src/components/dashboard/dashboard-utils";

interface ActiveDevicesSectionProps {
	devices: ActivityEvent[];
}

export function ActiveDevicesSection({ devices }: ActiveDevicesSectionProps) {
	return (
		<section className="mt-16">
			<p className="text-[11px] font-semibold tracking-[0.28em] text-stone-400 uppercase sm:text-xs">Active Now</p>
			{devices.length > 0 ? (
				<div className="mt-7 space-y-4">
					{devices.map((device) => (
						<ActiveDeviceCard key={getActivityKey(device)} device={device} />
					))}
				</div>
			) : (
				<div className="mt-7 rounded-[1.75rem] border border-stone-200/80 bg-white/90 p-5 shadow-[0_14px_35px_rgba(120,113,108,0.06)] sm:p-6">
					<div className="py-1">
						<p className="text-base tracking-[-0.03em] text-stone-700 sm:text-lg">No live activity yet</p>
						<p className="mt-1.5 text-xs text-stone-400 sm:text-sm">Waiting for devices to report their foreground app.</p>
					</div>
				</div>
			)}
		</section>
	);
}
