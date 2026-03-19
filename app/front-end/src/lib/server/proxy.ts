import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
	getBackendInternalApiBaseUrl,
	getBackendInternalApiBaseUrlCandidates,
	getBackendPublicWebSocketBaseUrl,
	getDashboardApiToken,
	getHumanGateCookieSecret,
} from "@/src/lib/server/env";

const VIEWER_COOKIE = "amiokay_viewer";
const HUMAN_GATE_COOKIE = "amiokay_human_gate";

interface HumanGateCookiePayload {
	expiresAt: number;
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function signValue(value: string): Promise<string> {
	const secret = getDashboardApiToken();
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const digest = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(value),
	);

	return Buffer.from(digest).toString("base64url");
}

async function signHumanGateValue(value: string): Promise<string> {
	const secret = getHumanGateCookieSecret();
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const digest = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(value),
	);

	return Buffer.from(digest).toString("base64url");
}

function encodeWebSocketPayload(payload: {
	role: "food" | "dashboard";
	viewerId?: string;
	expiresAt: number;
}): string {
	return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

async function verifyViewerCookie(
	rawValue: string | undefined,
): Promise<string | null> {
	if (!rawValue) {
		return null;
	}

	const [viewerId, signature] = rawValue.split(".");
	if (!viewerId || !signature) {
		return null;
	}

	const expectedSignature = await signValue(viewerId);
	return signature === expectedSignature ? viewerId : null;
}

export async function createHumanGateCookieValue(): Promise<string> {
	const payload: HumanGateCookiePayload = {
		expiresAt: Date.now() + 24 * 60 * 60_000,
	};
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const signature = await signHumanGateValue(encoded);
	return `${encoded}.${signature}`;
}

async function verifyHumanGateCookie(rawValue: string | undefined): Promise<boolean> {
	if (!rawValue) {
		return false;
	}

	const [encoded, signature] = rawValue.split(".");
	if (!encoded || !signature) {
		return false;
	}

	const expectedSignature = await signHumanGateValue(encoded);
	if (signature !== expectedSignature) {
		return false;
	}

	try {
		const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as HumanGateCookiePayload;
		return Number.isFinite(payload.expiresAt) && payload.expiresAt > Date.now();
	} catch {
		return false;
	}
}

export async function hasValidHumanGate(): Promise<boolean> {
	const cookieStore = await cookies();
	return await verifyHumanGateCookie(cookieStore.get(HUMAN_GATE_COOKIE)?.value);
}

export async function getOrIssueVisitor(): Promise<{
	viewerId: string;
	cookieValue: string | null;
}> {
	const cookieStore = await cookies();
	const existing = await verifyViewerCookie(
		cookieStore.get(VIEWER_COOKIE)?.value,
	);
	if (existing) {
		return {
			viewerId: existing,
			cookieValue: null,
		};
	}

	const viewerId = crypto.randomUUID();
	const cookieValue = `${viewerId}.${await signValue(viewerId)}`;

	return {
		viewerId,
		cookieValue,
	};
}

export async function createFoodWebSocketUrl(viewerId: string): Promise<string> {
	const payload = encodeWebSocketPayload({
		role: "food",
		viewerId,
		expiresAt: Date.now() + 5 * 60_000,
	});
	const signature = await signValue(payload);
	const token = `${payload}.${signature}`;
	const url = new URL("/ws/food", getBackendPublicWebSocketBaseUrl());
	url.searchParams.set("token", token);
	return url.toString();
}

export async function createDashboardWebSocketUrl(): Promise<string> {
	const payload = encodeWebSocketPayload({
		role: "dashboard",
		expiresAt: Date.now() + 5 * 60_000,
	});
	const signature = await signValue(payload);
	const token = `${payload}.${signature}`;
	const url = new URL("/ws/dashboard", getBackendPublicWebSocketBaseUrl());
	url.searchParams.set("token", token);
	return url.toString();
}

export async function proxyToBackend(
	path: string,
	init?: RequestInit,
	options?: {
		viewerId?: string;
		cookieValue?: string | null;
	},
): Promise<NextResponse> {
	const headers = new Headers(init?.headers);
	headers.set("accept", "application/json");
	headers.set("authorization", `Bearer ${getDashboardApiToken()}`);

	if (options?.viewerId) {
		headers.set("x-amiokay-viewer-id", options.viewerId);
	}

	let response: Response | null = null;
	let lastError: unknown = null;

	for (const baseUrl of getBackendInternalApiBaseUrlCandidates()) {
		try {
			response = await fetch(`${baseUrl}${path}`, {
				...init,
				headers,
				cache: "no-store",
			});
			break;
		} catch (error) {
			lastError = error;
		}
	}

	if (!response) {
		throw lastError ?? new Error(`failed to reach backend at ${getBackendInternalApiBaseUrl()}`);
	}

	const contentType = response.headers.get("content-type") ?? "application/json; charset=utf-8";
	const bodyText = await response.text();
	const nextResponse = new NextResponse(bodyText, {
		status: response.status,
		headers: {
			"content-type": contentType,
			"cache-control": "no-store",
		},
	});

	if (options?.cookieValue) {
		nextResponse.cookies.set(VIEWER_COOKIE, options.cookieValue, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
		});
	}

	return nextResponse;
}

export async function requireHumanGate(_request: Request): Promise<NextResponse | null> {
	void _request;
	const isValid = await hasValidHumanGate();
	if (isValid) {
		return null;
	}

	return NextResponse.json(
		{
			error: "human verification required",
		},
		{
			status: 403,
			headers: {
				"cache-control": "no-store",
			},
		},
	);
}

export function createProxyErrorResponse(error: unknown): NextResponse {
	return NextResponse.json(
		{
			error: `proxy request failed: ${toErrorMessage(error)}`,
		},
		{ status: 502 },
	);
}
