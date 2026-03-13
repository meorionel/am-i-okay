import { createProxyErrorResponse, proxyToBackend } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	try {
		return await proxyToBackend("/api/current", {
			method: "GET",
		});
	} catch (error) {
		return createProxyErrorResponse(error);
	}
}
