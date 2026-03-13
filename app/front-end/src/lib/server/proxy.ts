import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
	getBackendInternalApiBaseUrl,
	getDashboardApiToken,
} from "@/src/lib/server/env";

const FOOD_VIEWER_COOKIE = "amiokay_food_viewer";

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

export async function getOrIssueFoodViewer(): Promise<{
	viewerId: string;
	cookieValue: string | null;
}> {
	const cookieStore = await cookies();
	const existing = await verifyViewerCookie(
		cookieStore.get(FOOD_VIEWER_COOKIE)?.value,
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
		headers.set("x-food-viewer-id", options.viewerId);
	}

	const response = await fetch(`${getBackendInternalApiBaseUrl()}${path}`, {
		...init,
		headers,
		cache: "no-store",
	});

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
		nextResponse.cookies.set(FOOD_VIEWER_COOKIE, options.cookieValue, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
		});
	}

	return nextResponse;
}

export function createProxyErrorResponse(error: unknown): NextResponse {
	return NextResponse.json(
		{
			error: `proxy request failed: ${toErrorMessage(error)}`,
		},
		{ status: 502 },
	);
}
