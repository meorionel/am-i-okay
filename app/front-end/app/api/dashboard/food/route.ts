import {
	createProxyErrorResponse,
	getOrIssueFoodViewer,
	proxyToBackend,
} from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	try {
		const { viewerId, cookieValue } = await getOrIssueFoodViewer();
		return await proxyToBackend(
			"/api/food",
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
