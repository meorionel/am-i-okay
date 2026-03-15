import { NextResponse } from "next/server";
import {
	createMessageWebSocketUrl,
	createProxyErrorResponse,
	getOrIssueFoodViewer,
	requireHumanGate,
} from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
	try {
		const gateResponse = await requireHumanGate(request);
		if (gateResponse) {
			return gateResponse;
		}

		const { viewerId, cookieValue } = await getOrIssueFoodViewer();
		const response = NextResponse.json(
			{
				url: await createMessageWebSocketUrl(viewerId),
			},
			{
				headers: {
					"cache-control": "no-store",
				},
			},
		);

		if (cookieValue) {
			response.cookies.set("amiokay_food_viewer", cookieValue, {
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
