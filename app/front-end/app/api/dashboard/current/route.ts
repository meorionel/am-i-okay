import { createProxyErrorResponse, proxyToBackend, requireHumanGate } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
	try {
		const gateResponse = await requireHumanGate(request);
		if (gateResponse) {
			return gateResponse;
		}

		return await proxyToBackend("/api/current", {
			method: "GET",
		});
	} catch (error) {
		return createProxyErrorResponse(error);
	}
}
