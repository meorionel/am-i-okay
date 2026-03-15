import {
	parseCurrentDashboardResponse,
	parseFoodCounterResponse,
	type CurrentDevicesResponse,
	type FoodCounterResponse,
} from "@/src/types/activity";

const CURRENT_DEVICES_PATH = "/api/dashboard/current";
const FOOD_COUNTER_PATH = "/api/dashboard/food";
const FOOD_FEED_PATH = "/api/dashboard/feed";

export class FoodRateLimitError extends Error {
	constructor() {
		super("RATE_LIMITED");
		this.name = "FoodRateLimitError";
	}
}

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

export async function fetchCurrentDevices(): Promise<CurrentDevicesResponse> {
	const url = CURRENT_DEVICES_PATH;

	try {
		const response = await fetch(url, {
			method: "GET",
			cache: "no-store",
			headers: {
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			console.warn(`[api] fetchCurrentDevices failed with HTTP ${response.status}`);
			return { devices: [], latestStatus: null, recentActivities: [] };
		}

		let data: unknown;

		try {
			data = await response.json();
		} catch (error) {
			console.warn(`[api] failed to parse /api/current JSON: ${toErrorMessage(error)}`);
			return { devices: [], latestStatus: null, recentActivities: [] };
		}

		return parseCurrentDashboardResponse(data);
	} catch (error) {
		console.warn(`[api] failed to fetch /api/current at ${url}: ${toErrorMessage(error)}`);
		return { devices: [], latestStatus: null, recentActivities: [] };
	}
}

export async function fetchFoodCounter(): Promise<FoodCounterResponse> {
	const url = FOOD_COUNTER_PATH;

	try {
		const response = await fetch(url, {
			method: "GET",
			cache: "no-store",
			headers: {
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			console.warn(`[api] fetchFoodCounter failed with HTTP ${response.status}`);
			return parseFoodCounterResponse(null);
		}

		return parseFoodCounterResponse(await response.json());
	} catch (error) {
		console.warn(`[api] failed to fetch /api/food at ${url}: ${toErrorMessage(error)}`);
		return parseFoodCounterResponse(null);
	}
}

export async function feedFood(foodId: number): Promise<FoodCounterResponse> {
	const url = FOOD_FEED_PATH;

	try {
		const response = await fetch(url, {
			method: "POST",
			cache: "no-store",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id: foodId,
			}),
		});

		if (!response.ok) {
			console.warn(`[api] feedFood failed with HTTP ${response.status}`);
			if (response.status === 429) {
				throw new FoodRateLimitError();
			}
			throw new Error(`feedFood failed with HTTP ${response.status}`);
		}

		return parseFoodCounterResponse(await response.json());
	} catch (error) {
		if (error instanceof FoodRateLimitError) {
			throw error;
		}
		console.warn(`[api] failed to post /api/food/feed at ${url}: ${toErrorMessage(error)}`);
		throw error;
	}
}
