interface ModerationApiResponse {
  code?: number | string;
  num?: number | string;
  desc?: string;
  ci?: string;
}

export interface ModerationResult {
  ok: boolean;
  detail?: string;
}

const MESSAGE_MODERATION_ENDPOINT =
  "https://v.api.aa1.cn/api/api-mgc/index.php";

function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export async function moderateMessageContent(
  content: string,
): Promise<ModerationResult> {
  const url = new URL(MESSAGE_MODERATION_ENDPOINT);
  url.searchParams.set("msg", content);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });
  } catch (error) {
    console.error("[message-moderation] request failed", error);
    return {
      ok: false,
      detail: "敏感词检测服务暂时不可用，请稍后再试。",
    };
  }

  if (!response.ok) {
    console.error(
      `[message-moderation] HTTP ${response.status} when checking content`,
    );
    return {
      ok: false,
      detail: "敏感词检测服务暂时不可用，请稍后再试。",
    };
  }

  let payload: ModerationApiResponse;
  try {
    payload = (await response.json()) as ModerationApiResponse;
  } catch (error) {
    console.error("[message-moderation] failed to parse JSON", error);
    return {
      ok: false,
      detail: "敏感词检测结果无效，请稍后再试。",
    };
  }

  if (String(payload.num ?? "") === "1") {
    const keyword = toText(payload.ci);
    return {
      ok: false,
      detail: keyword
        ? `留言包含敏感内容，已被拦截：${keyword}`
        : toText(payload.desc) ?? "留言包含敏感内容，已被拦截。",
    };
  }

  return { ok: true };
}
