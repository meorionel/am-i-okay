import type {
  ActivityEvent,
  DeviceActivitySnapshot,
  DeviceStatus,
  RecentActivityItem,
} from "./types";

const RECENT_ACTIVITY_LIMIT = 10;

function formatDisplayTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoTimestamp));
}

function toRecentActivityItem(event: ActivityEvent): RecentActivityItem {
  const displayTime = formatDisplayTime(event.ts);

  return {
    eventId: event.eventId,
    ts: event.ts,
    deviceId: event.deviceId,
    agentName: event.agentName,
    platform: event.platform,
    app: event.app,
    windowTitle: event.windowTitle,
    source: event.source,
    displayTime,
    summary: `${displayTime} ${event.app.name} on ${event.deviceId}`,
  };
}

function sortByTimestampDesc<T extends { ts: string }>(items: T[]): T[] {
  return items.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
}

export class ActivityStore {
  private readonly latestByDevice = new Map<string, ActivityEvent>();
  private latestStatus: DeviceStatus | null = null;
  private readonly recentByDevice = new Map<string, RecentActivityItem[]>();
  private readonly recentGlobal: RecentActivityItem[] = [];

  upsert(event: ActivityEvent): void {
    this.latestByDevice.set(event.deviceId, event);
    this.pushRecentActivity(event);
  }

  getAll(): ActivityEvent[] {
    return sortByTimestampDesc(Array.from(this.latestByDevice.values()));
  }

  upsertStatus(status: DeviceStatus): void {
    this.latestStatus = status;
  }

  getLatestStatus(): DeviceStatus | null {
    return this.latestStatus;
  }

  getDeviceSnapshots(): DeviceActivitySnapshot[] {
    return this.getAll().map((current) => ({
      current,
      recentActivities: [...(this.recentByDevice.get(current.deviceId) ?? [])],
    }));
  }

  getRecentActivities(): RecentActivityItem[] {
    return [...this.recentGlobal];
  }

  getByDeviceId(deviceId: string): ActivityEvent | undefined {
    return this.latestByDevice.get(deviceId);
  }

  removeByDeviceIds(deviceIds: Iterable<string>): boolean {
    let changed = false;

    for (const deviceId of deviceIds) {
      changed = this.latestByDevice.delete(deviceId) || changed;
    }

    return changed;
  }

  private pushRecentActivity(event: ActivityEvent): void {
    const item = toRecentActivityItem(event);
    const existingDeviceHistory = this.recentByDevice.get(event.deviceId) ?? [];
    const nextDeviceHistory = sortByTimestampDesc([item, ...existingDeviceHistory])
      .slice(0, RECENT_ACTIVITY_LIMIT);

    this.recentByDevice.set(event.deviceId, nextDeviceHistory);

    this.recentGlobal.unshift(item);
    this.recentGlobal.splice(RECENT_ACTIVITY_LIMIT);
    sortByTimestampDesc(this.recentGlobal);
  }
}
