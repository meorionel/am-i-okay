import {
	parseCurrentDashboardResponse,
	parseFoodCounterResponse,
	type CurrentDevicesResponse,
	type FoodCounterResponse,
} from "@/src/types/activity";
import {
	parseGuestbookCreateResponse,
	parseGuestbookListResponse,
	type GuestbookCreateResponse,
	type GuestbookListResponse,
} from "@/src/types/guestbook";

const CURRENT_DEVICES_PATH = "/api/dashboard/current";
const FOOD_COUNTER_PATH = "/api/dashboard/food";
const FOOD_FEED_PATH = "/api/dashboard/feed";
const GUESTBOOK_MESSAGES_PATH = "/api/dashboard/messages";

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

export async function fetchGuestbookMessages(pageId: string, page: number, pageSize = 20): Promise<GuestbookListResponse> {
	const url = `${GUESTBOOK_MESSAGES_PATH}?page=${page}&pageSize=${pageSize}`;

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
			throw new Error(`fetchGuestbookMessages failed with HTTP ${response.status}`);
		}

		return parseGuestbookListResponse(await response.json());
	} catch (error) {
		console.warn(`[api] failed to fetch guestbook messages at ${url}: ${toErrorMessage(error)}`);
		throw error;
	}
}

export async function createGuestbookMessage(pageId: string, body: string, humanToken: string): Promise<GuestbookCreateResponse> {
	try {
		const response = await fetch(GUESTBOOK_MESSAGES_PATH, {
			method: "POST",
			cache: "no-store",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				...createHumanHeaders(pageId),
			},
			body: JSON.stringify({
				body,
				humanToken,
			}),
		});

		const payload = await response.json().catch(() => null);
		if (!response.ok) {
			const message = typeof payload?.error === "string" ? payload.error : `createGuestbookMessage failed with HTTP ${response.status}`;
			throw new Error(message);
		}

		const parsed = parseGuestbookCreateResponse(payload);
		if (!parsed) {
			throw new Error("guestbook create response payload is invalid");
		}

		return parsed;
	} catch (error) {
		console.warn(`[api] failed to post guestbook message: ${toErrorMessage(error)}`);
		throw error;
	}
}
