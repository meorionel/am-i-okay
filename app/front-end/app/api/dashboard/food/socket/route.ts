import { NextResponse } from "next/server";
import { createProxyErrorResponse, createFoodWebSocketUrl, getOrIssueVisitor, requireHumanGate } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
	try {
		const gateResponse = await requireHumanGate(request);
		if (gateResponse) {
			return gateResponse;
		}

		const { viewerId, cookieValue } = await getOrIssueVisitor();
		const response = NextResponse.json(
			{
				url: await createFoodWebSocketUrl(viewerId),
			},
			{
				headers: {
					"cache-control": "no-store",
				},
			},
		);

		if (cookieValue) {
			response.cookies.set("amiokay_viewer", cookieValue, {
				httpOnly: true,
				sameSite: "lax",
				secure: process.env.NODE_ENV === "production",
				path: "/",
			});
		}

		return response;
	} catch (error) {
		return createProxyErrorResponse(error);
	}
}
