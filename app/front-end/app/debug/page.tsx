"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboardStream } from "@/src/hooks/use-dashboard-stream";
import { getApiBaseUrl, getWsBaseUrl } from "@/src/lib/env";

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

async function fetchCurrentRaw(): Promise<CurrentApiDebug> {
  const url = `${getApiBaseUrl()}/api/current`;

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const text = await response.text();
    let pretty = text;
    try {
      pretty = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // Keep original text for debugging when payload is not valid JSON.
    }

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

export default function DebugPage() {
  const { devices, connectionStatus, lastEventAt } = useDashboardStream();
  const [apiDebug, setApiDebug] = useState<CurrentApiDebug>({
    loading: true,
    status: null,
    updatedAt: null,
    body: "",
    error: null,
  });

  const streamJson = useMemo(() => JSON.stringify(devices, null, 2), [devices]);
  const apiBaseUrl = getApiBaseUrl();
  const wsBaseUrl = getWsBaseUrl();

  const refreshCurrent = async (setLoading = true): Promise<void> => {
    if (setLoading) {
      setApiDebug((prev) => ({ ...prev, loading: true }));
    }
    const result = await fetchCurrentRaw();
    setApiDebug(result);
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async (): Promise<void> => {
      const result = await fetchCurrentRaw();
      if (!cancelled) {
        setApiDebug(result);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Debug Dashboard</h1>
      <p className="mt-2 text-sm">apiBaseUrl: {apiBaseUrl}</p>
      <p className="text-sm">wsBaseUrl: {wsBaseUrl}</p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Stream State</h2>
        <p className="mt-2 text-sm">connectionStatus: {connectionStatus}</p>
        <p className="text-sm">lastEventAt: {prettyNow(lastEventAt)}</p>
        <p className="text-sm">deviceCount: {devices.length}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Stream Devices (Hook)</h2>
        <pre className="mt-2 max-h-80 overflow-auto rounded border p-3 text-xs leading-5">
          {streamJson}
        </pre>
      </section>

      <section className="mt-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">HTTP /api/current (Raw)</h2>
          <button
            type="button"
            onClick={() => void refreshCurrent()}
            className="rounded border px-3 py-1 text-sm"
            disabled={apiDebug.loading}
          >
            {apiDebug.loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className="mt-2 text-sm">status: {apiDebug.status ?? "n/a"}</p>
        <p className="text-sm">updatedAt: {prettyNow(apiDebug.updatedAt)}</p>
        {apiDebug.error ? (
          <p className="mt-2 text-sm text-red-600">error: {apiDebug.error}</p>
        ) : null}
        <pre className="mt-2 max-h-80 overflow-auto rounded border p-3 text-xs leading-5">
          {apiDebug.body || "(empty)"}
        </pre>
      </section>
    </main>
  );
}
