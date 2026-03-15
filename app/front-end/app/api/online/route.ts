import { createProxyErrorResponse, proxyEventStreamToBackend, requireHumanGate } from "@/src/lib/server/proxy";
import { isOnlineApiEnabled } from "@/src/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
	try {
		if (!isOnlineApiEnabled()) {
			return new Response("Not Found", { status: 404 });
		}

		const gateResponse = await requireHumanGate(request);
		if (gateResponse) {
			return gateResponse;
		}

		return await proxyEventStreamToBackend("/api/online", {
			method: "GET",
			signal: request.signal,
		});
	} catch (error) {
		return createProxyErrorResponse(error);
	}
}
