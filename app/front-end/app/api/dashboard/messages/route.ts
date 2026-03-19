import { NextResponse } from "next/server";
import { createProxyErrorResponse, getOrIssueVisitor, proxyToBackend, requireHumanGate } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
	try {
		const gateResponse = await requireHumanGate(request);
		if (gateResponse) {
			return gateResponse;
		}

		const { viewerId, cookieValue } = await getOrIssueVisitor();
		const url = new URL(request.url);
		const params = new URLSearchParams();
		const page = url.searchParams.get("page");
		const pageSize = url.searchParams.get("pageSize");

		if (page) {
			params.set("page", page);
		}
		if (pageSize) {
			params.set("pageSize", pageSize);
		}

		return await proxyToBackend(
			params.size > 0 ? `/api/messages?${params.toString()}` : "/api/messages",
			{
				method: "GET",
			},
			{
				viewerId,
				cookieValue,
			},
		);
	} catch (error) {
		return createProxyErrorResponse(error);
	}
}

export async function POST(request: Request): Promise<Response> {
	try {
		const gateResponse = await requireHumanGate(request);
		if (gateResponse) {
			return gateResponse;
		}

		const { viewerId, cookieValue } = await getOrIssueVisitor();
		const payload = (await request.json()) as {
			body?: string;
			humanToken?: string;
		};

		if (typeof payload?.body !== "string" || typeof payload?.humanToken !== "string" || payload.humanToken.trim().length === 0) {
			return NextResponse.json(
				{
					error: "body and humanToken are required",
				},
				{ status: 400 },
			);
		}

		return await proxyToBackend(
			"/api/messages",
			{
				method: "POST",
				body: JSON.stringify({
					body: payload.body,
					humanToken: payload.humanToken,
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				viewerId,
				cookieValue,
			},
		);
	} catch (error) {
		return createProxyErrorResponse(error);
	}
}
