import type { DeviceStatus } from "@/src/types/activity";

interface DeviceStatusSectionProps {
	latestStatus: DeviceStatus | null;
}

function resolveGreeting(now: Date): string {
	const hour = now.getHours();

	if (hour < 11) {
		return "早安~ 今天也要晒太阳哦.";
	}

	if (hour < 18) {
		return "中午好~ 久坐记得伸个懒腰.";
	}

	return "该咪觉了, 晚安~";
}

export function DeviceStatusSection({ latestStatus }: DeviceStatusSectionProps) {
	if (!latestStatus || latestStatus.statusText.trim().length === 0) {
		return null;
	}

	return (
		<section className="mt-16 sm:mt-20">
			<p className="text-[11px] font-semibold tracking-[0.28em] text-stone-400 uppercase sm:text-xs">{resolveGreeting(new Date())}</p>
			<p className="mt-4 text-base leading-7 tracking-[-0.02em] text-stone-700 sm:text-lg">
				{latestStatus.statusText.trim()}
			</p>
		</section>
	);
}
