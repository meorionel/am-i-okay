import { NextResponse } from "next/server";
import { createProxyErrorResponse, createFoodWebSocketUrl, getOrIssueFoodViewer } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	try {
		const { viewerId, cookieValue } = await getOrIssueFoodViewer();
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
