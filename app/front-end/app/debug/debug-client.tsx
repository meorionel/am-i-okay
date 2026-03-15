"use client";

import { useEffect, useMemo, useState } from "react";
import { PageGateScreen } from "@/src/components/human/page-gate-screen";
import { useHumanGate } from "@/src/hooks/use-human-gate";
import { useDashboardStream } from "@/src/hooks/use-dashboard-stream";

type CurrentApiDebug = {
	loading: boolean;
	status: number | null;
	updatedAt: number | null;
	body: string;
	error: string | null;
};

function prettyNow(value: number | null): string {
	if (!value) {
		return "null";
	}
	return new Date(value).toISOString();
}

async function fetchCurrentRaw(pageId: string): Promise<CurrentApiDebug> {
	try {
		const response = await fetch("/api/dashboard/current", {
			method: "GET",
			cache: "no-store",
			headers: {
				Accept: "application/json",
				"x-human-page-id": pageId,
			},
		});

		const text = await response.text();
		let pretty = text;
		try {
			pretty = JSON.stringify(JSON.parse(text), null, 2);
		} catch {}

		return {
			loading: false,
			status: response.status,
			updatedAt: Date.now(),
			body: pretty,
			error: null,
		};
	} catch (error) {
		return {
			loading: false,
			status: null,
			updatedAt: Date.now(),
			body: "",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export function DebugClientPage() {
	const { isVerified, isVerifying, progress, errorMessage, pageId, verify } = useHumanGate();
	const { devices, connectionStatus, lastEventAt } = useDashboardStream(isVerified, pageId);
	const [apiDebug, setApiDebug] = useState<CurrentApiDebug>({
		loading: true,
		status: null,
		updatedAt: null,
		body: "",
		error: null,
	});

	const streamJson = useMemo(() => JSON.stringify(devices, null, 2), [devices]);

	const refreshCurrent = async (setLoading = true): Promise<void> => {
		if (setLoading) {
			setApiDebug((prev) => ({ ...prev, loading: true }));
		}
		const result = await fetchCurrentRaw(pageId);
		setApiDebug(result);
	};

	useEffect(() => {
		if (!isVerified) {
			return;
		}

		let cancelled = false;

		const bootstrap = async (): Promise<void> => {
			const result = await fetchCurrentRaw(pageId);
			if (!cancelled) {
				setApiDebug(result);
			}
		};

		void bootstrap();

		return () => {
			cancelled = true;
		};
	}, [isVerified, pageId]);

	if (!isVerified) {
		return <PageGateScreen isVerifying={isVerifying} progress={progress} errorMessage={errorMessage} onVerify={verify} />;
	}

	return (
		<main className="min-h-screen p-6">
			<h1 className="text-2xl font-semibold">Debug Dashboard</h1>

			<section className="mt-6">
				<h2 className="text-lg font-semibold">Stream State</h2>
				<p className="mt-2 text-sm">connectionStatus: {connectionStatus}</p>
				<p className="text-sm">lastEventAt: {prettyNow(lastEventAt)}</p>
				<p className="text-sm">deviceCount: {devices.length}</p>
			</section>

			<section className="mt-6">
				<h2 className="text-lg font-semibold">Stream Devices (Proxy)</h2>
				<pre className="mt-2 max-h-80 overflow-auto rounded border p-3 text-xs leading-5">{streamJson}</pre>
			</section>

			<section className="mt-6">
				<div className="flex items-center gap-3">
					<h2 className="text-lg font-semibold">HTTP /api/dashboard/current</h2>
					<button type="button" onClick={() => void refreshCurrent()} className="rounded border px-3 py-1 text-sm" disabled={apiDebug.loading}>
						{apiDebug.loading ? "Refreshing..." : "Refresh"}
					</button>
				</div>
				<p className="mt-2 text-sm">status: {apiDebug.status ?? "n/a"}</p>
				<p className="text-sm">updatedAt: {prettyNow(apiDebug.updatedAt)}</p>
				{apiDebug.error ? <p className="mt-2 text-sm text-red-600">error: {apiDebug.error}</p> : null}
				<pre className="mt-2 max-h-80 overflow-auto rounded border p-3 text-xs leading-5">{apiDebug.body || "(empty)"}</pre>
			</section>
		</main>
	);
}
