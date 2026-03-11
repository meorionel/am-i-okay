export function toEpochMs(value: string | number | Date): number | null {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

export function formatTimestamp(
  value: string | number | Date,
  locale = "en-US",
): string {
  const ts = toEpochMs(value);
  if (ts === null) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(ts);
}

