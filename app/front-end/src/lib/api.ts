import {
	parseCurrentDashboardResponse,
	parseFoodCounterResponse,
	type CurrentDevicesResponse,
	type FoodCounterResponse,
} from "@/src/types/activity";

const CURRENT_DEVICES_PATH = "/api/dashboard/current";
const FOOD_COUNTER_PATH = "/api/dashboard/food";
const FOOD_FEED_PATH = "/api/dashboard/feed";
const MESSAGE_SOCKET_PATH = "/api/dashboard/message/socket";

function createHumanHeaders(pageId: string): HeadersInit {
	return {
		"x-human-page-id": pageId,
	};
}

export class FoodRateLimitError extends Error {
	constructor() {
		super("RATE_LIMITED");
		this.name = "FoodRateLimitError";
	}
}

export async function createMessageSocket(pageId: string): Promise<string> {
	const response = await fetch(MESSAGE_SOCKET_PATH, {
		method: "GET",
		cache: "no-store",
		headers: {
			Accept: "application/json",
			...createHumanHeaders(pageId),
		},
	});

	if (!response.ok) {
		throw new Error(`createMessageSocket failed with HTTP ${response.status}`);
	}

	const data = (await response.json()) as { url?: string };
	if (typeof data.url !== "string" || data.url.length === 0) {
		throw new Error("message socket bootstrap did not return a websocket url");
	}

	return data.url;
}

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

export async function fetchCurrentDevices(pageId: string): Promise<CurrentDevicesResponse> {
	const url = CURRENT_DEVICES_PATH;

	try {
		const response = await fetch(url, {
			method: "GET",
			cache: "no-store",
			headers: {
				Accept: "application/json",
				...createHumanHeaders(pageId),
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

export async function fetchFoodCounter(pageId: string): Promise<FoodCounterResponse> {
	const url = FOOD_COUNTER_PATH;

	try {
		const response = await fetch(url, {
			method: "GET",
			cache: "no-store",
			headers: {
				Accept: "application/json",
				...createHumanHeaders(pageId),
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

export async function feedFood(pageId: string, foodId: number, humanToken: string): Promise<FoodCounterResponse> {
	const url = FOOD_FEED_PATH;

	try {
		const response = await fetch(url, {
			method: "POST",
			cache: "no-store",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				...createHumanHeaders(pageId),
			},
			body: JSON.stringify({
				id: foodId,
				humanToken,
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
