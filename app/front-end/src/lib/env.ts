const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_WS_BASE_URL = "ws://127.0.0.1:3000";

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
	return trimTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL);
}

export function getWsBaseUrl(): string {
	return trimTrailingSlash(process.env.NEXT_PUBLIC_WS_BASE_URL ?? DEFAULT_WS_BASE_URL);
}

export function getDashboardWsUrl(): string {
	return `${getWsBaseUrl()}/ws/dashboard`;
}
