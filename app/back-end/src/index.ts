import { ActivityStore } from "./store";
import type { WsClientData } from "./types";
import { corsHeaders, jsonResponse } from "./utils";
import { WebSocketHub } from "./ws";

const host = Bun.env.HOST ?? "0.0.0.0";
const parsedPort = Number(Bun.env.PORT ?? "3000");
const port = Number.isNaN(parsedPort) ? 3000 : parsedPort;

const store = new ActivityStore();
const wsHub = new WebSocketHub(store);

Bun.serve<WsClientData>({
  hostname: host,
  port,
  fetch(req, server) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/current") {
      return jsonResponse({
        devices: store.getAll(),
        latestStatus: store.getLatestStatus(),
        deviceSnapshots: store.getDeviceSnapshots(),
        recentActivities: store.getRecentActivities(),
      });
    }

    if (url.pathname === "/ws/agent") {
      const upgraded = server.upgrade(req, {
        data: {
          role: "agent",
          connectionId: crypto.randomUUID(),
        },
      });

      if (upgraded) {
        return;
      }

      return jsonResponse(
        {
          error: "WebSocket upgrade failed for /ws/agent",
        },
        400,
      );
    }

    if (url.pathname === "/ws/dashboard") {
      const upgraded = server.upgrade(req, {
        data: {
          role: "dashboard",
          connectionId: crypto.randomUUID(),
        },
      });

      if (upgraded) {
        return;
      }

      return jsonResponse(
        {
          error: "WebSocket upgrade failed for /ws/dashboard",
        },
        400,
      );
    }

    return jsonResponse(
      {
        error: "Not Found",
      },
      404,
    );
  },
  websocket: {
    open(ws) {
      wsHub.handleOpen(ws);
    },
    message(ws, message) {
      wsHub.handleMessage(ws, message);
    },
    close(ws, code, reason) {
      wsHub.handleClose(ws, code, reason);
    },
  },
});

console.log(`[server] listening on ws/http://${host}:${port}`);
