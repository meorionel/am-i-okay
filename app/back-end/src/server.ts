import { FoodStore } from "./food";
import {
  createHumanChallenge,
  redeemHumanChallenge,
  validateHumanToken,
} from "./cap";
import { loadSecurityConfig, type StoredBackendConfig } from "./config";
import {
  assertSecureTransport,
  authenticateDashboardWebSocketRequest,
  authenticateHttpRequest,
  authenticateFoodWebSocketRequest,
  authenticateMessageWebSocketRequest,
  authenticateWebSocketRequest,
  handleCorsPreflight,
} from "./security";
import { ActivityStore } from "./store";
import type { OnlineCountMessage, WsClientData } from "./types";
import { jsonResponse } from "./utils";
import { WebSocketHub } from "./ws";

export function startServer(config: StoredBackendConfig) {
  const host = config.host;
  const port = config.port;
  const security = loadSecurityConfig(config);
  const store = new ActivityStore();
  const foodStore = new FoodStore();
  const wsHub = new WebSocketHub(store, foodStore);
  const onlineClients = new Set<ReadableStreamDefaultController<string>>();
  const onlineMaxConnections = Number.parseInt(
    process.env.ONLINE_MAX_CONNECTIONS ?? "50",
    10,
  );

  const createOnlinePayload = (count: number): string => {
    const message: OnlineCountMessage = {
      type: "online-count",
      payload: { count },
    };

    return `data: ${JSON.stringify(message)}\n\n`;
  };

  const broadcastOnlineCount = () => {
    const payload = createOnlinePayload(onlineClients.size);

    for (const controller of [...onlineClients]) {
      try {
        controller.enqueue(payload);
      } catch (error) {
        console.error("[online] failed to push online count", error);
        onlineClients.delete(controller);
      }
    }
  };

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

      if (req.method === "GET" && url.pathname === "/api/online") {
        const auth = authenticateHttpRequest(req, security, "dashboard");
        if (auth instanceof Response) {
          return auth;
        }

        if (
          Number.isFinite(onlineMaxConnections) &&
          onlineMaxConnections > 0 &&
          onlineClients.size >= onlineMaxConnections
        ) {
          return jsonResponse(
            req,
            security,
            {
              error: "too many online connections",
            },
            429,
          );
        }

        let controllerRef: ReadableStreamDefaultController<string> | null = null;

        const removeClient = () => {
          if (!controllerRef) {
            return;
          }

          const controller = controllerRef;
          controllerRef = null;

          if (onlineClients.delete(controller)) {
            try {
              controller.close();
            } catch {}
            broadcastOnlineCount();
          }
        };

        const stream = new ReadableStream<string>({
          start(controller) {
            controllerRef = controller;
            onlineClients.add(controller);
            controller.enqueue(createOnlinePayload(onlineClients.size));
            broadcastOnlineCount();

            req.signal.addEventListener("abort", removeClient, { once: true });
          },
          cancel() {
            removeClient();
          },
        });

        return new Response(stream, {
          headers: {
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "content-type": "text/event-stream; charset=utf-8",
          },
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
        const rawHumanToken = payload.humanToken;
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

        if (
          security.humanGateEnabled &&
          (typeof rawHumanToken !== "string" || rawHumanToken.trim().length === 0)
        ) {
          return jsonResponse(
            req,
            security,
            {
              error: "missing human verification token",
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
          if (security.humanGateEnabled) {
            const isHuman = await validateHumanToken("feed", rawHumanToken as string);
            if (!isHuman) {
              return jsonResponse(
                req,
                security,
                {
                  error: "invalid human verification token",
                },
                403,
              );
            }
          }

          const food = foodStore.toggle(rawFoodId as number, viewerId);
          wsHub.broadcastFoodUpdate();

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

      if (req.method === "POST" && url.pathname === "/api/human/page/challenge") {
        const auth = authenticateHttpRequest(req, security, "dashboard");
        if (auth instanceof Response) {
          return auth;
        }

        return jsonResponse(req, security, await createHumanChallenge("page"));
      }

      if (req.method === "POST" && url.pathname === "/api/human/feed/challenge") {
        const auth = authenticateHttpRequest(req, security, "dashboard");
        if (auth instanceof Response) {
          return auth;
        }

        return jsonResponse(req, security, await createHumanChallenge("feed"));
      }

      if (req.method === "POST" && url.pathname === "/api/human/message/challenge") {
        const auth = authenticateHttpRequest(req, security, "dashboard");
        if (auth instanceof Response) {
          return auth;
        }

        return jsonResponse(req, security, await createHumanChallenge("message"));
      }

      if (
        req.method === "POST" &&
        (
          url.pathname === "/api/human/page/redeem" ||
          url.pathname === "/api/human/feed/redeem" ||
          url.pathname === "/api/human/message/redeem"
        )
      ) {
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
              success: false,
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
              success: false,
              error: "request body must be a JSON object",
            },
            400,
          );
        }

        const payload = body as Record<string, unknown>;
        const token = payload.token;
        const solutions = payload.solutions;

        if (typeof token !== "string" || token.trim().length === 0) {
          return jsonResponse(
            req,
            security,
            {
              success: false,
              error: "missing challenge token",
            },
            400,
          );
        }

        if (!Array.isArray(solutions) || !solutions.every((value) => typeof value === "number")) {
          return jsonResponse(
            req,
            security,
            {
              success: false,
              error: "solutions must be a numeric array",
            },
            400,
          );
        }

        const purpose = url.pathname.includes("/page/")
          ? "page"
          : url.pathname.includes("/message/")
            ? "message"
            : "feed";
        const result = await redeemHumanChallenge(purpose, token, solutions);
        return jsonResponse(
          req,
          security,
          result.success
            ? result
            : {
                success: false,
                error: result.message ?? "challenge redeem failed",
              },
          result.success ? 200 : 400,
        );
      }

      if (req.method === "POST" && url.pathname === "/api/human/page/verify") {
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

        const token =
          typeof body === "object" && body !== null
            ? (body as Record<string, unknown>).token
            : null;
        if (typeof token !== "string" || token.trim().length === 0) {
          return jsonResponse(
            req,
            security,
            {
              error: "missing verification token",
            },
            400,
          );
        }

        const isHuman = await validateHumanToken("page", token);
        if (!isHuman) {
          return jsonResponse(
            req,
            security,
            {
              error: "invalid human verification token",
            },
            403,
          );
        }

        return jsonResponse(req, security, {
          success: true,
        });
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
        const auth = await authenticateDashboardWebSocketRequest(req, security);
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

      if (url.pathname === "/ws/food") {
        const auth = await authenticateFoodWebSocketRequest(req, security);
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
            error: "WebSocket upgrade failed for /ws/food",
          },
          400,
        );
      }

      if (url.pathname === "/ws/message") {
        const auth = await authenticateMessageWebSocketRequest(req, security);
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
            error: "WebSocket upgrade failed for /ws/message",
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
        void wsHub.handleMessage(ws, message);
      },
      close(ws, code, reason) {
        wsHub.handleClose(ws, code, reason);
      },
    },
  });

  console.log(`[server] listening on http://${host}:${port} env=${security.env}`);
  return server;
}
