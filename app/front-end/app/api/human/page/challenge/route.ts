import { createProxyErrorResponse, proxyToBackend } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
	try {
		return await proxyToBackend("/api/human/page/challenge", {
			method: "POST",
		});
	} catch (error) {
		return createProxyErrorResponse(error);
	}
}
