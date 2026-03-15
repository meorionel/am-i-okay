import { createProxyErrorResponse, proxyToBackend } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
	try {
		return await proxyToBackend("/api/human/page/redeem", {
			method: "POST",
			body: await request.text(),
			headers: {
				"content-type": request.headers.get("content-type") ?? "application/json",
			},
		});
	} catch (error) {
		return createProxyErrorResponse(error);
	}
}
