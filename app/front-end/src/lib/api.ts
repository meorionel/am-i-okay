import { getApiBaseUrl } from "@/src/lib/env";
import {
  parseCurrentDevicesResponse,
  type ActivityEvent,
} from "@/src/types/activity";

const CURRENT_DEVICES_PATH = "/api/current";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function fetchCurrentDevices(): Promise<ActivityEvent[]> {
  const url = `${getApiBaseUrl()}${CURRENT_DEVICES_PATH}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn(
        `[api] fetchCurrentDevices failed with HTTP ${response.status}`,
      );
      return [];
    }

    let data: unknown;

    try {
      data = await response.json();
    } catch (error) {
      console.warn(
        `[api] failed to parse /api/current JSON: ${toErrorMessage(error)}`,
      );
      return [];
    }

    return parseCurrentDevicesResponse(data);
  } catch (error) {
    console.warn(
      `[api] failed to fetch /api/current at ${url}: ${toErrorMessage(error)}`,
    );
    return [];
  }
}
