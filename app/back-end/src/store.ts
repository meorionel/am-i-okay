import type { ActivityEvent } from "./types";

export class ActivityStore {
  private readonly latestByDevice = new Map<string, ActivityEvent>();

  upsert(event: ActivityEvent): void {
    this.latestByDevice.set(event.deviceId, event);
  }

  getAll(): ActivityEvent[] {
    return Array.from(this.latestByDevice.values()).sort((a, b) => {
      return Date.parse(b.ts) - Date.parse(a.ts);
    });
  }

  getByDeviceId(deviceId: string): ActivityEvent | undefined {
    return this.latestByDevice.get(deviceId);
  }
}
