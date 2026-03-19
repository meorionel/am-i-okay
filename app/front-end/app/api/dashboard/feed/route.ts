import { NextResponse } from "next/server";
import { createProxyErrorResponse, getOrIssueVisitor, proxyToBackend, requireHumanGate } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
	try {
		const gateResponse = await requireHumanGate(request);
		if (gateResponse) {
			return gateResponse;
		}

		const { viewerId, cookieValue } = await getOrIssueVisitor();
		const payload = (await request.json()) as {
			id?: number;
			humanToken?: string;
		};

		if (!Number.isInteger(payload?.id) || typeof payload?.humanToken !== "string" || payload.humanToken.trim().length === 0) {
			return NextResponse.json(
				{
					error: "body.id and body.humanToken are required",
				},
				{ status: 400 },
			);
		}

		return await proxyToBackend(
			"/api/food/feed",
			{
				method: "POST",
				body: JSON.stringify({
					id: payload.id,
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
