import { icons as uilIcons } from "@iconify-json/uil";
import { Icon, addCollection } from "@iconify/react";
import type { ActivityEvent } from "@/src/types/activity";
import { formatDeviceLabel, formatPlatform, formatSecondaryLine } from "@/src/components/dashboard/dashboard-utils";

addCollection(uilIcons);

interface ActiveDeviceCardProps {
	device: ActivityEvent;
}

function resolveDeviceIcon(deviceLabel: string): string {
	const normalized = deviceLabel.trim().toLowerCase();

	if (normalized.includes("macos")) {
		return "uil:laptop";
	}

	if (normalized.includes("android")) {
		return "uil:mobile-android";
	}

	if (normalized.includes("windows")) {
		return "uil:desktop";
	}

	return "uil:desktop";
}

function resolveSecondaryLine(device: ActivityEvent): string | null {
	const platform = device.platform.trim().toLowerCase();

	if (platform === "macos" || platform === "android") {
		return device.app.id;
	}

	if (platform === "windows") {
		return device.app.name;
	}

	return formatSecondaryLine(device);
}

export function ActiveDeviceCard({ device }: ActiveDeviceCardProps) {
	const deviceLabel = formatDeviceLabel(device);
	const agentLabel = device.agentName?.trim() || deviceLabel;
	const secondaryLine = resolveSecondaryLine(device);

	return (
		<div className="rounded-[1.8rem] border border-stone-200/80 bg-white/92 p-5 shadow-[0_16px_40px_rgba(120,113,108,0.07)] transition-shadow duration-200 hover:shadow-[0_18px_48px_rgba(120,113,108,0.10)] sm:p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] bg-stone-50 text-stone-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
					<Icon icon={resolveDeviceIcon(formatPlatform(device.platform))} className="h-8 w-8" aria-hidden="true" />
				</div>
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 sm:text-sm">
						<span className="inline-flex items-center gap-3">
							<span className="h-2 w-2 rounded-full bg-[#a3b18a] shadow-[0_0_0_4px_rgba(163,177,138,0.12)]" />
							<span className="truncate">{agentLabel}</span>
						</span>
						<span className="text-stone-300">/</span>
						<span className="rounded-md bg-stone-100 px-2.5 py-1 text-[11px] text-stone-400">{formatPlatform(device.platform)}</span>
					</div>
					<p className="mt-3 text-lg font-normal tracking-[-0.04em] text-stone-800 sm:text-[1.55rem]">
						正在使用 <span className="font-semibold text-[#588157]">{device.app.title}</span>
					</p>
					{secondaryLine ? <p className="mt-1.5 text-xs italic text-stone-400 sm:text-sm">{secondaryLine}</p> : null}
				</div>
			</div>
		</div>
	);
}
