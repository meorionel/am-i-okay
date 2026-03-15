import {
	createProxyErrorResponse,
	getOrIssueFoodViewer,
	proxyToBackend,
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
