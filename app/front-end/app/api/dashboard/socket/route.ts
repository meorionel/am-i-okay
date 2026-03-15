import { NextResponse } from "next/server";
import { createDashboardWebSocketUrl, createProxyErrorResponse, requireHumanGate } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
	try {
		const gateResponse = await requireHumanGate(request);
		if (gateResponse) {
			return gateResponse;
		}

		return NextResponse.json(
			{
				url: await createDashboardWebSocketUrl(),
			},
			{
				headers: {
					"cache-control": "no-store",
				},
			},
		);
	} catch (error) {
		return createProxyErrorResponse(error);
	}
}
