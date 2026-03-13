import { FoodStore } from "./food";
import { ActivityStore } from "./store";
import type { WsClientData } from "./types";
import { corsHeaders, jsonResponse, resolveFingerprint } from "./utils";
import { WebSocketHub } from "./ws";

const host = Bun.env.HOST ?? "0.0.0.0";
const parsedPort = Number(Bun.env.PORT ?? "3000");
const port = Number.isNaN(parsedPort) ? 3000 : parsedPort;

const store = new ActivityStore();
const foodStore = new FoodStore();
const wsHub = new WebSocketHub(store);

Bun.serve<WsClientData>({
  hostname: host,
  port,
  async fetch(req, server) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        foodDatabasePath: foodStore.getDatabasePath(),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/current") {
      return jsonResponse({
        devices: store.getAll(),
        latestStatus: store.getLatestStatus(),
        deviceSnapshots: store.getDeviceSnapshots(),
        recentActivities: store.getRecentActivities(),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/food") {
      const { fingerprint, source } = await resolveFingerprint(req);

      return jsonResponse({
        foods: foodStore.listFoods(fingerprint),
        viewerFingerprint: fingerprint,
        fingerprintSource: source,
        databasePath: foodStore.getDatabasePath(),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/food/feed") {
      let body: unknown;

      try {
        body = await req.json();
      } catch {
        return jsonResponse(
          {
            error: "request body must be valid JSON",
          },
          400,
        );
      }

      if (typeof body !== "object" || body === null) {
        return jsonResponse(
          {
            error: "request body must be a JSON object",
          },
          400,
        );
      }

      const payload = body as Record<string, unknown>;
      const rawFoodId = payload.id ?? payload.foodId;
      if (!Number.isInteger(rawFoodId)) {
        return jsonResponse(
          {
            error: "body.id must be an integer food id",
          },
          400,
        );
      }

      const { fingerprint, source } = await resolveFingerprint(
        req,
        payload.fingerprint,
      );

      try {
        const food = foodStore.toggle(rawFoodId as number, fingerprint);

        return jsonResponse({
          food,
          foods: foodStore.listFoods(fingerprint),
          viewerFingerprint: fingerprint,
          fingerprintSource: source,
          databasePath: foodStore.getDatabasePath(),
        });
      } catch (error) {
        if (error instanceof RangeError) {
          return jsonResponse(
            {
              error: error.message,
            },
            400,
          );
        }

        if (error instanceof Error && error.message === "RATE_LIMITED") {
          return jsonResponse(
            {
              error: "please wait 3 seconds before feeding again",
            },
            429,
          );
        }

        console.error("[food] failed to update counter", error);
        return jsonResponse(
          {
            error: "failed to update food counter",
          },
          500,
        );
      }
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
