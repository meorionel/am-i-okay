import { NextResponse } from "next/server";
import { hasValidHumanGate } from "@/src/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	return NextResponse.json(
		{
			verified: await hasValidHumanGate(),
		},
		{
			headers: {
				"cache-control": "no-store",
			},
		},
	);
}
