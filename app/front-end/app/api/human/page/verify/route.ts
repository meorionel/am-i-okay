import {
	createHumanGateCookieValue,
	createProxyErrorResponse,
	proxyToBackend,
} from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
	try {
		const response = await proxyToBackend("/api/human/page/verify", {
			method: "POST",
			body: await request.text(),
			headers: {
				"content-type": request.headers.get("content-type") ?? "application/json",
			},
		});

		if (!response.ok) {
			return response;
		}

		response.cookies.set("amiokay_human_gate", await createHumanGateCookieValue(), {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: 24 * 60 * 60,
		});

		return response;
	} catch (error) {
		return createProxyErrorResponse(error);
	}
}
