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

export function getBackendInternalApiBaseUrlCandidates(): string[] {
	const primary = getBackendInternalApiBaseUrl();
	const candidates = [primary];

	try {
		const url = new URL(primary);
		const isHttp = url.protocol === "http:" || url.protocol === "https:";
		if (!isHttp) {
			return candidates;
		}

		if (url.hostname === "127.0.0.1") {
			const next = new URL(url.toString());
			next.hostname = "localhost";
			candidates.push(trimTrailingSlash(next.toString()));
		} else if (url.hostname === "localhost") {
			const next = new URL(url.toString());
			next.hostname = "127.0.0.1";
			candidates.push(trimTrailingSlash(next.toString()));
		}
	} catch {
		return candidates;
	}

	return [...new Set(candidates)];
}

export function getBackendPublicWebSocketBaseUrl(): string {
	const explicit = process.env.BACKEND_PUBLIC_WS_BASE_URL?.trim();
	if (explicit) {
		return trimTrailingSlash(explicit);
	}

	const internal = getBackendInternalApiBaseUrl();
	if (internal.startsWith("https://")) {
		return `wss://${internal.slice("https://".length)}`;
	}

	if (internal.startsWith("http://")) {
		return `ws://${internal.slice("http://".length)}`;
	}

	return internal;
}

export function getDashboardApiToken(): string {
	const token = process.env.DASHBOARD_API_TOKEN?.trim();
	if (!token) {
		throw new Error("DASHBOARD_API_TOKEN is required for front-end proxy routes");
	}

	return token;
}

export function getHumanGateCookieSecret(): string {
	const token = process.env.HUMAN_GATE_COOKIE_SECRET?.trim();
	return token && token.length > 0 ? token : getDashboardApiToken();
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
