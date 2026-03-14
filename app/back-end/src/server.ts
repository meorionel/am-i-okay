import { FoodStore } from "./food";
import { loadSecurityConfig, type StoredBackendConfig } from "./config";
import {
  assertSecureTransport,
  authenticateHttpRequest,
  authenticateWebSocketRequest,
  handleCorsPreflight,
} from "./security";
import { ActivityStore } from "./store";
import type { WsClientData } from "./types";
import { jsonResponse } from "./utils";
import { WebSocketHub } from "./ws";

export function startServer(config: StoredBackendConfig) {
  const host = config.host;
  const port = config.port;
  const security = loadSecurityConfig(config);
  const store = new ActivityStore();
  const foodStore = new FoodStore();
  const wsHub = new WebSocketHub(store);

  const server = Bun.serve<WsClientData>({
    hostname: host,
    port,
    async fetch(req, bunServer) {
      const url = new URL(req.url);

      const preflight = handleCorsPreflight(req, security);
      if (preflight) {
        return preflight;
      }

      const secureTransportError = assertSecureTransport(req, security);
      if (secureTransportError) {
        return secureTransportError;
      }

      if (req.method === "GET" && url.pathname === "/health") {
        const auth = authenticateHttpRequest(req, security, "dashboard");
        if (auth instanceof Response) {
          return auth;
        }

        return jsonResponse(req, security, {
          ok: true,
        });
      }

      if (req.method === "GET" && url.pathname === "/api/current") {
        const auth = authenticateHttpRequest(req, security, "dashboard");
        if (auth instanceof Response) {
          return auth;
        }

        return jsonResponse(req, security, {
          devices: store.getAll(),
          latestStatus: store.getLatestStatus(),
          deviceSnapshots: store.getDeviceSnapshots(),
          recentActivities: store.getRecentActivities(),
        });
      }

      if (req.method === "GET" && url.pathname === "/api/food") {
        const auth = authenticateHttpRequest(req, security, "dashboard");
        if (auth instanceof Response) {
          return auth;
        }

        const viewerId = req.headers.get("x-food-viewer-id")?.trim();
        if (!viewerId) {
          return jsonResponse(
            req,
            security,
            {
              error: "missing food viewer identity",
            },
            400,
          );
        }

        return jsonResponse(req, security, {
          foods: foodStore.listFoods(viewerId),
        });
      }

      if (req.method === "POST" && url.pathname === "/api/food/feed") {
        const auth = authenticateHttpRequest(req, security, "dashboard");
        if (auth instanceof Response) {
          return auth;
        }

        let body: unknown;

        try {
          body = await req.json();
        } catch {
          return jsonResponse(
            req,
            security,
            {
              error: "request body must be valid JSON",
            },
            400,
          );
        }

        if (typeof body !== "object" || body === null) {
          return jsonResponse(
            req,
            security,
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
            req,
            security,
            {
              error: "body.id must be an integer food id",
            },
            400,
          );
        }

        const viewerId = req.headers.get("x-food-viewer-id")?.trim();
        if (!viewerId) {
          return jsonResponse(
            req,
            security,
            {
              error: "missing food viewer identity",
            },
            400,
          );
        }

        try {
          const food = foodStore.toggle(rawFoodId as number, viewerId);

          return jsonResponse(req, security, {
            food,
            foods: foodStore.listFoods(viewerId),
          });
        } catch (error) {
          if (error instanceof RangeError) {
            return jsonResponse(
              req,
              security,
              {
                error: error.message,
              },
              400,
            );
          }

          if (error instanceof Error && error.message === "RATE_LIMITED") {
            return jsonResponse(
              req,
              security,
              {
                error: "please wait 3 seconds before feeding again",
              },
              429,
            );
          }

          console.error("[food] failed to update counter", error);
          return jsonResponse(
            req,
            security,
            {
              error: "failed to update food counter",
            },
            500,
          );
        }
      }

      if (url.pathname === "/ws/agent") {
        const auth = authenticateWebSocketRequest(req, security, "agent");
        if (auth instanceof Response) {
          return auth;
        }

        const upgraded = bunServer.upgrade(req, {
          data: auth,
        });

        if (upgraded) {
          return;
        }

        return jsonResponse(
          req,
          security,
          {
            error: "WebSocket upgrade failed for /ws/agent",
          },
          400,
        );
      }

      if (url.pathname === "/ws/dashboard") {
        const auth = authenticateWebSocketRequest(req, security, "dashboard");
        if (auth instanceof Response) {
          return auth;
        }

        const upgraded = bunServer.upgrade(req, {
          data: auth,
        });

        if (upgraded) {
          return;
        }

        return jsonResponse(
          req,
          security,
          {
            error: "WebSocket upgrade failed for /ws/dashboard",
          },
          400,
        );
      }

      return jsonResponse(
        req,
        security,
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

  console.log(`[server] listening on http://${host}:${port} env=${security.env}`);
  return server;
}
