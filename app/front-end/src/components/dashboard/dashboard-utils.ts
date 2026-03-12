import { toEpochMs } from "@/src/lib/format";
import type { ActivityEvent, RecentActivity } from "@/src/types/activity";

export type ActivityLike = Pick<ActivityEvent, "deviceId" | "source" | "windowTitle" | "app"> & {
	kind?: string;
};

export function formatTimelineTime(value: string): string {
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

export function formatPlatform(platform: string): string {
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

export function formatDeviceLabel(event: ActivityLike): string {
	const deviceId = event.deviceId.trim();
	return deviceId.length > 0 ? deviceId : "Unknown device";
}

export function formatSecondaryLine(event: ActivityLike): string | null {
	const title = event.windowTitle?.trim() || event.app.title?.trim();
	if (title) {
		return `"${title}"`;
	}

	if (event.kind === "active") {
		return "Currently in focus";
	}

	return null;
}

export function getActivityKey(event: Pick<ActivityEvent | RecentActivity, "eventId" | "deviceId" | "ts">): string {
	return event.eventId ?? `${event.deviceId}-${event.ts}`;
}
