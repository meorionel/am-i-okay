const DEFAULT_BACKEND_API_BASE_URL = "http://127.0.0.1:3000";

function parseBoolean(value: string | undefined, defaultValue = false): boolean {
	return value === undefined ? defaultValue : value === "1" || value === "true";
}

function parseInteger(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "");
}

export function getBackendInternalApiBaseUrl(): string {
	return trimTrailingSlash(
		process.env.BACKEND_INTERNAL_API_BASE_URL ?? DEFAULT_BACKEND_API_BASE_URL,
	);
}

export function getDashboardApiToken(): string {
	const token = process.env.DASHBOARD_API_TOKEN?.trim();
	if (!token) {
		throw new Error("DASHBOARD_API_TOKEN is required for front-end proxy routes");
	}

	return token;
}

export function getFrontendAccessToken(): string | null {
	const token = process.env.FRONTEND_ACCESS_TOKEN?.trim();
	return token && token.length > 0 ? token : null;
}

export function getOnlineMaxConnections(): number {
	return parseInteger(process.env.ONLINE_MAX_CONNECTIONS, 50);
}

export function isDebugPageEnabled(): boolean {
	return parseBoolean(
		process.env.ENABLE_DEBUG_PAGE,
		process.env.NODE_ENV !== "production",
	);
}

export function isOnlineApiEnabled(): boolean {
	return parseBoolean(process.env.ENABLE_ONLINE_API, true);
}
