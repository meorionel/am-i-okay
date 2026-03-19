import { FoodStore } from "./food";
import { GuestbookStore, parseGuestbookPage, parseGuestbookPageSize } from "./guestbook";
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
  authenticateWebSocketRequest,
  handleCorsPreflight,
} from "./security";
import { moderateMessageContent } from "./message-moderation";
import { MessageRateLimiter } from "./message-rate-limit";
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
  const guestbookStore = new GuestbookStore();
  const messageRateLimiter = new MessageRateLimiter();
  const wsHub = new WebSocketHub(store, foodStore);

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

        const viewerId = req.headers.get("x-amiokay-viewer-id")?.trim();
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

        const viewerId = req.headers.get("x-amiokay-viewer-id")?.trim();
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

      if (req.method === "GET" && url.pathname === "/api/messages") {
        const auth = authenticateHttpRequest(req, security, "dashboard");
        if (auth instanceof Response) {
          return auth;
        }

        try {
          const page = parseGuestbookPage(url.searchParams.get("page"));
          const pageSize = parseGuestbookPageSize(url.searchParams.get("pageSize"));
          return jsonResponse(req, security, guestbookStore.listMessages(page, pageSize));
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

          console.error("[guestbook] failed to list messages", error);
          return jsonResponse(
            req,
            security,
            {
              error: "failed to list guestbook messages",
            },
            500,
          );
        }
      }

      if (req.method === "POST" && url.pathname === "/api/messages") {
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
        const messageBody = typeof payload.body === "string" ? payload.body.trim() : "";
        const humanToken = typeof payload.humanToken === "string" ? payload.humanToken.trim() : "";
        const viewerId = req.headers.get("x-amiokay-viewer-id")?.trim();
        const ip =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("cf-connecting-ip")?.trim() ||
          req.headers.get("x-real-ip")?.trim() ||
          "unknown";

        if (!viewerId) {
          return jsonResponse(
            req,
            security,
            {
              error: "missing viewer identity",
            },
            400,
          );
        }

        if (messageBody.length === 0) {
          return jsonResponse(
            req,
            security,
            {
              error: "留言不能为空",
            },
            400,
          );
        }

        if (messageBody.length > 20) {
          return jsonResponse(
            req,
            security,
            {
              error: "留言不能超过 20 个字符",
            },
            400,
          );
        }

        if (humanToken.length === 0) {
          return jsonResponse(
            req,
            security,
            {
              error: "缺少人机验证结果",
            },
            400,
          );
        }

        const rateLimit = messageRateLimiter.registerAttempt(viewerId, ip);
        if (!rateLimit.ok) {
          return jsonResponse(
            req,
            security,
            {
              error: rateLimit.message,
              code: rateLimit.code,
              retryAfterMs: rateLimit.retryAfterMs,
              frozenUntil: rateLimit.frozenUntil,
            },
            429,
          );
        }

        const isHuman = await validateHumanToken("message", humanToken);
        if (!isHuman) {
          return jsonResponse(
            req,
            security,
            {
              error: "人机验证未通过，请重试",
            },
            403,
          );
        }

        const moderation = await moderateMessageContent(messageBody);
        if (!moderation.ok) {
          return jsonResponse(
            req,
            security,
            {
              error: moderation.detail ?? "留言包含敏感内容，已被拦截。",
            },
            400,
          );
        }

        try {
          const message = guestbookStore.createMessage(messageBody, viewerId);
          return jsonResponse(
            req,
            security,
            {
              item: message,
              nextAllowedAt: messageRateLimiter.markSuccess(viewerId),
            },
            201,
          );
        } catch (error) {
          console.error("[guestbook] failed to create message", error);
          return jsonResponse(
            req,
            security,
            {
              error: "failed to create guestbook message",
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
