import { notFound } from "next/navigation";
import { DebugClientPage } from "@/app/debug/debug-client";
import { isDebugPageEnabled } from "@/src/lib/server/env";

export default function DebugPage() {
	if (!isDebugPageEnabled()) {
		notFound();
	}

	return <DebugClientPage />;
}
