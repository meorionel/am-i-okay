import { NextResponse } from "next/server";
import { createDashboardWebSocketUrl, createProxyErrorResponse } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	try {
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
