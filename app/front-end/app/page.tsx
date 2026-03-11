"use client";

import { useDashboardStream } from "@/src/hooks/use-dashboard-stream";

export default function Home() {
  const { devices, connectionStatus, lastEventAt } = useDashboardStream();

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-xl font-semibold">Device Activity Stream</h1>
      <p className="mt-2 text-sm">
        connectionStatus: <strong>{connectionStatus}</strong>
      </p>
      <p className="mt-1 text-sm">
        lastEventAt:{" "}
        <strong>{lastEventAt ? new Date(lastEventAt).toISOString() : "null"}</strong>
      </p>

      <pre className="mt-4 overflow-auto rounded border p-4 text-xs leading-5">
        {JSON.stringify(devices, null, 2)}
      </pre>
    </main>
  );
}

