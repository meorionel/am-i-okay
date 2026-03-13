const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const dashboardToken = process.env.DASHBOARD_API_TOKEN ?? "dev-dashboard-token";
const agentToken = process.env.AGENT_API_TOKEN ?? "dev-agent-token";
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "http://127.0.0.1:3001";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectStatus(
  path: string,
  expectedStatus: number,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(`${baseUrl}${path}`, init);
  assert(
    response.status === expectedStatus,
    `${path} expected HTTP ${expectedStatus}, received ${response.status}`,
  );
  return response;
}

async function expectWebSocketFailure(path: string): Promise<void> {
  const target = `${baseUrl.replace("http://", "ws://").replace("https://", "wss://")}${path}`;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(target);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`${path} unexpectedly stayed open`));
    }, 1500);

    ws.onopen = () => {
      clearTimeout(timer);
      ws.close();
      reject(new Error(`${path} unexpectedly opened`));
    };

    ws.onerror = () => {
      clearTimeout(timer);
      resolve();
    };

    ws.onclose = () => {
      clearTimeout(timer);
      resolve();
    };
  });
}

async function expectAgentIdentityMismatch(): Promise<void> {
  const target = `${baseUrl.replace("http://", "ws://").replace("https://", "wss://")}/ws/agent?token=${encodeURIComponent(agentToken)}`;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(target);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("agent mismatch connection did not close"));
    }, 2000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "status",
          payload: {
            ts: new Date().toISOString(),
            deviceId: "spoofed-device",
            agentName: "spoofed-agent",
            platform: "macos",
            statusText: "bad",
            source: "security-check",
          },
        }),
      );
    };

    ws.onmessage = () => {
      // The server may send an error before closing; wait for close.
    };

    ws.onerror = () => {
      clearTimeout(timer);
      resolve();
    };

    ws.onclose = (event) => {
      clearTimeout(timer);
      assert(event.code === 1008 || event.code === 1006, `unexpected close code ${event.code}`);
      resolve();
    };
  });
}

async function main(): Promise<void> {
  await expectStatus("/api/current", 401);
  await expectStatus("/api/current", 403, {
    headers: {
      Authorization: `Bearer ${agentToken}`,
    },
  });

  const currentResponse = await expectStatus("/api/current", 200, {
    headers: {
      Authorization: `Bearer ${dashboardToken}`,
    },
  });
  const currentBody = await currentResponse.text();
  assert(!currentBody.includes("databasePath"), "/api/current must not leak databasePath");

  const foodResponse = await expectStatus("/api/food", 400, {
    headers: {
      Authorization: `Bearer ${dashboardToken}`,
    },
  });
  const foodBody = await foodResponse.text();
  assert(!foodBody.includes("viewerFingerprint"), "/api/food must not leak viewerFingerprint");

  const preflight = await expectStatus("/api/current", 403, {
    method: "OPTIONS",
    headers: {
      Origin: "https://evil.example",
      "Access-Control-Request-Method": "GET",
    },
  });
  assert(
    preflight.headers.get("access-control-allow-origin") !== "*",
    "preflight must not return wildcard ACAO",
  );

  const allowedPreflight = await expectStatus("/api/current", 204, {
    method: "OPTIONS",
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "GET",
    },
  });
  assert(
    allowedPreflight.headers.get("access-control-allow-origin") === allowedOrigin,
    "allowed origin preflight must echo configured origin",
  );

  await expectWebSocketFailure("/ws/dashboard");
  await expectWebSocketFailure("/ws/agent");
  await expectAgentIdentityMismatch();

  console.log("security-check: all assertions passed");
}

await main();
