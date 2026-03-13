"use client";

import type { ActivityEvent } from "@/src/types/activity";
import { ActiveDeviceCard } from "@/src/components/dashboard/active-device-card";
import { getActivityKey } from "@/src/components/dashboard/dashboard-utils";

interface ActiveDevicesSectionProps {
	devices: ActivityEvent[];
}

const sleepingMessage = "我应该是在睡觉😴";
const guessingMessage = "猜猜我现在在做什么🤔️";

function getUtc8Hour() {
	const now = new Date();
	const utc8String = now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
	return new Date(utc8String).getHours();
}

export function ActiveDevicesSection({ devices }: ActiveDevicesSectionProps) {
	const hour = getUtc8Hour();
	const bannerMessage = hour >= 1 && hour < 8 ? sleepingMessage : guessingMessage;

	return (
		<section className="mt-16">
			<p className="text-[11px] font-semibold tracking-[0.28em] text-stone-400 uppercase sm:text-xs">设备列表</p>
			{devices.length > 0 ? (
				<div className="mt-7 space-y-4">
					{devices.map((device) => (
						<ActiveDeviceCard key={getActivityKey(device)} device={device} />
					))}
				</div>
			) : (
				<div className="mt-7 rounded-[1.75rem] border border-stone-200/80 bg-white/90 p-5 shadow-[0_14px_35px_rgba(120,113,108,0.06)] sm:p-6">
					<div className="py-1">
						<p className="text-base tracking-[-0.03em] text-stone-700 sm:text-lg">目前没有任何设备在线哦.</p>
						<p className="mt-1.5 text-xs text-stone-400 sm:text-sm">{bannerMessage}</p>
					</div>
				</div>
			)}
		</section>
	);
}
