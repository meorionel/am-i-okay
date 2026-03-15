const MESSAGE_FINGERPRINT_COOLDOWN_MS = 3 * 60_000;
const MESSAGE_IP_WINDOW_MS = 60_000;
const MESSAGE_IP_MAX_ATTEMPTS = 8;
const MESSAGE_IP_FREEZE_MS = 10 * 60_000;

interface IpWindow {
  attempts: number[];
  frozenUntil: number;
}

export type MessageRateLimitResult =
  | { ok: true }
  | {
      ok: false;
      code: "FINGERPRINT_COOLDOWN" | "IP_FROZEN" | "IP_RATE_LIMITED";
      message: string;
      retryAfterMs: number;
      frozenUntil?: string;
    };

export class MessageRateLimiter {
  private readonly lastMessageAtByFingerprint = new Map<string, number>();
  private readonly ipWindows = new Map<string, IpWindow>();

  registerAttempt(fingerprint: string, ip: string): MessageRateLimitResult {
    const now = Date.now();
    const normalizedFingerprint = fingerprint.trim();
    const normalizedIp = ip.trim() || "unknown";

    const ipWindow = this.getOrCreateIpWindow(normalizedIp, now);
    if (ipWindow.frozenUntil > now) {
      return {
        ok: false,
        code: "IP_FROZEN",
        message: "当前 IP 请求过于频繁，已被冻结 10 分钟。",
        retryAfterMs: ipWindow.frozenUntil - now,
        frozenUntil: new Date(ipWindow.frozenUntil).toISOString(),
      };
    }

    ipWindow.attempts.push(now);
    if (ipWindow.attempts.length > MESSAGE_IP_MAX_ATTEMPTS) {
      ipWindow.frozenUntil = now + MESSAGE_IP_FREEZE_MS;
      ipWindow.attempts = [];
      return {
        ok: false,
        code: "IP_RATE_LIMITED",
        message: "当前 IP 短时间请求过多，已被冻结 10 分钟。",
        retryAfterMs: MESSAGE_IP_FREEZE_MS,
        frozenUntil: new Date(ipWindow.frozenUntil).toISOString(),
      };
    }

    const lastMessageAt = this.lastMessageAtByFingerprint.get(normalizedFingerprint);
    if (lastMessageAt && now - lastMessageAt < MESSAGE_FINGERPRINT_COOLDOWN_MS) {
      return {
        ok: false,
        code: "FINGERPRINT_COOLDOWN",
        message: "同一指纹 3 分钟内只能发送一次留言。",
        retryAfterMs: MESSAGE_FINGERPRINT_COOLDOWN_MS - (now - lastMessageAt),
      };
    }

    return { ok: true };
  }

  markSuccess(fingerprint: string): string {
    const now = Date.now();
    this.lastMessageAtByFingerprint.set(fingerprint.trim(), now);
    return new Date(now + MESSAGE_FINGERPRINT_COOLDOWN_MS).toISOString();
  }

  private getOrCreateIpWindow(ip: string, now: number): IpWindow {
    const existing = this.ipWindows.get(ip);
    if (existing) {
      existing.attempts = existing.attempts.filter((attempt) => now - attempt < MESSAGE_IP_WINDOW_MS);
      if (existing.frozenUntil <= now) {
        existing.frozenUntil = 0;
      }
      return existing;
    }

    const created: IpWindow = {
      attempts: [],
      frozenUntil: 0,
    };
    this.ipWindows.set(ip, created);
    return created;
  }
}
