import { createProxyErrorResponse, getOrIssueFoodViewer, proxyToBackend } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
	try {
		const { viewerId, cookieValue } = await getOrIssueFoodViewer();
		const bodyText = await request.text();

		return await proxyToBackend(
			"/api/food/feed",
			{
				method: "POST",
				body: bodyText,
				headers: {
					"content-type": request.headers.get("content-type") ?? "application/json",
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
