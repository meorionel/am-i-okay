"use client";

import { useDashboardStream } from "@/src/hooks/use-dashboard-stream";
import { toEpochMs } from "@/src/lib/format";
import type { ActivityEvent } from "@/src/types/activity";

type ActivityLike = Pick<ActivityEvent, "deviceId" | "source" | "windowTitle" | "app">;

function formatTimelineTime(value: string): string {
	const ts = toEpochMs(value);
	if (ts === null) {
		return "";
	}

	const date = new Date(ts);
	const now = new Date();
	const sameDay = date.toDateString() === now.toDateString();
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);

	if (date.toDateString() === yesterday.toDateString()) {
		return `Yesterday, ${new Intl.DateTimeFormat("en-US", {
			hour: "numeric",
			minute: "2-digit",
		}).format(ts)}`;
	}

	if (sameDay) {
		return new Intl.DateTimeFormat("en-US", {
			hour: "numeric",
			minute: "2-digit",
		}).format(ts);
	}

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(ts);
}

function formatPlatform(platform: string): string {
	const normalized = platform.trim().toLowerCase();
	if (normalized === "darwin") {
		return "macOS";
	}

	if (normalized === "win32") {
		return "Windows";
	}

	if (normalized === "ios") {
		return "iPhone";
	}

	return platform;
}

function formatDeviceLabel(event: ActivityLike): string {
	const source = event.source?.trim();
	if (source) {
		return source;
	}

	const deviceId = event.deviceId.trim();
	return deviceId.length > 0 ? deviceId : "Unknown device";
}

function formatSecondaryLine(event: ActivityLike): string | null {
	const title = event.windowTitle?.trim() || event.app.title?.trim();
	if (title) {
		return `"${title}"`;
	}

	if ("kind" in event && event.kind === "active") {
		return "Currently in focus";
	}

	return null;
}

function DeviceGlyph() {
	return (
		<svg aria-hidden="true" className="h-11 w-11 text-slate-400" viewBox="0 0 48 48" fill="none">
			<rect x="8" y="10" width="32" height="22" rx="3.5" stroke="currentColor" strokeWidth="2.5" />
			<path d="M18 38h12M24 32v6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
		</svg>
	);
}

export default function Home() {
	const { devices, recentActivities, connectionStatus, lastEventAt } = useDashboardStream();
	const activeDevices = devices;
	const visibleTimeline = recentActivities.slice(0, 4);
	const lastUpdated = lastEventAt ? formatTimelineTime(new Date(lastEventAt).toISOString()) : null;

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(241,242,244,0.96)_52%,_#eceef1)] text-slate-700">
			<div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-7 sm:px-5 sm:py-10">
				<section className="max-w-lg">
					<h1 className="font-[family-name:var(--font-editorial)] text-[2rem] tracking-[-0.04em] text-slate-800 sm:text-[2.7rem]">Am I Okay</h1>
					<p className="mt-2 text-sm font-light italic tracking-[-0.02em] text-slate-400 sm:text-base">A quiet reflection of your digital space.</p>
					<div className="mt-4 flex flex-wrap items-center gap-2.5 text-[11px] text-slate-400 sm:text-xs">
						<span className="rounded-full border border-white/70 bg-white/60 px-2 py-1 shadow-[0_8px_24px_rgba(148,163,184,0.08)] backdrop-blur">
							{connectionStatus}
						</span>
						{lastUpdated ? <span>Last update {lastUpdated}</span> : null}
					</div>
				</section>

				<section className="mt-12">
					<p className="text-[11px] font-semibold tracking-[0.24em] text-slate-400 uppercase sm:text-xs">Active Now</p>
					{activeDevices.length > 0 ? (
						<div className="mt-4 space-y-3">
							{activeDevices.map((device) => (
								<div
									key={device.eventId ?? `${device.deviceId}-${device.ts}`}
									className="rounded-[1.25rem] border border-white/70 bg-white/70 p-3 shadow-[0_14px_30px_rgba(148,163,184,0.10)] backdrop-blur-sm sm:p-4"
								>
									<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
										<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.9rem] bg-slate-50 shadow-inner shadow-white">
											<DeviceGlyph />
										</div>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:text-sm">
												<span className="inline-flex items-center gap-2.5">
													<span className="h-2 w-2 rounded-full bg-[#bcc3ae]" />
													<span className="truncate">{formatDeviceLabel(device)}</span>
												</span>
												<span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-400">{formatPlatform(device.platform)}</span>
											</div>
											<p className="mt-2 text-base tracking-[-0.04em] text-slate-800 sm:text-[1.3rem]">
												Currently using <span className="font-semibold text-[#6d9166]">{device.app.title}</span>
											</p>
											{formatSecondaryLine(device) ? <p className="mt-1.5 text-xs italic text-slate-400 sm:text-sm">{formatSecondaryLine(device)}</p> : null}
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="mt-4 rounded-[1.25rem] border border-white/70 bg-white/70 p-3 shadow-[0_14px_30px_rgba(148,163,184,0.10)] backdrop-blur-sm sm:p-4">
							<div className="py-2">
								<p className="text-base tracking-[-0.03em] text-slate-700 sm:text-lg">No live activity yet</p>
								<p className="mt-1.5 text-xs text-slate-400 sm:text-sm">Waiting for devices to report their foreground app.</p>
							</div>
						</div>
					)}
				</section>

				<section className="mt-12 sm:mt-14">
					<p className="text-[11px] font-semibold tracking-[0.24em] text-slate-400 uppercase sm:text-xs">Recent Activity</p>
					{visibleTimeline.length > 0 ? (
						<div className="relative mt-6 pl-5 sm:pl-10">
							<div className="absolute left-[0.26rem] top-3 bottom-3 w-px bg-slate-200 sm:left-3.5" />
							<div className="space-y-6">
								{visibleTimeline.map((event) => (
									<article key={event.eventId ?? `${event.deviceId}-${event.ts}`} className="relative">
										<span className="absolute -left-5 top-1 h-2 w-2 rounded-full border border-slate-200 bg-slate-100 sm:-left-[2.35rem]" />
										<p className="text-sm leading-none tracking-[-0.04em] text-slate-400 sm:text-[1.05rem]">
											{event.displayTime ?? formatTimelineTime(event.ts)}
										</p>
										<p className="mt-1.5 text-base tracking-[-0.04em] text-slate-700 sm:text-[1.15rem]">
											<span className="font-semibold text-slate-800">{event.app.title}</span>{" "}
											<span className="text-slate-400">on {formatDeviceLabel(event)}</span>
										</p>
										{formatSecondaryLine(event) ? <p className="mt-1 text-xs italic text-slate-400 sm:text-sm">{formatSecondaryLine(event)}</p> : null}
									</article>
								))}
							</div>
						</div>
					) : (
						<p className="mt-5 text-sm text-slate-400">Activity history will appear here once more devices report in.</p>
					)}
				</section>
			</div>
		</main>
	);
}
