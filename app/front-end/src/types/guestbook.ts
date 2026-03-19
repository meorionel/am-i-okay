export interface GuestbookMessage {
	id: string;
	body: string;
	createdAt: string;
}

export interface GuestbookListResponse {
	items: GuestbookMessage[];
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}

export interface GuestbookCreateResponse {
	item: GuestbookMessage;
	nextAllowedAt: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseGuestbookMessage(input: unknown): GuestbookMessage | null {
	if (!isRecord(input)) {
		return null;
	}

	const id = readString(input.id);
	const body = readString(input.body);
	const createdAt = readString(input.createdAt);
	if (!id || !body || !createdAt) {
		return null;
	}

	return { id, body, createdAt };
}

export function parseGuestbookListResponse(input: unknown): GuestbookListResponse {
	if (!isRecord(input)) {
		return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
	}

	const items = Array.isArray(input.items)
		? input.items.map((item) => parseGuestbookMessage(item)).filter((item): item is GuestbookMessage => item !== null)
		: [];
	const page = readNumber(input.page) ?? 1;
	const pageSize = readNumber(input.pageSize) ?? 20;
	const total = readNumber(input.total) ?? 0;
	const totalPages = readNumber(input.totalPages) ?? 0;

	return {
		items,
		page,
		pageSize,
		total,
		totalPages,
	};
}

export function parseGuestbookCreateResponse(input: unknown): GuestbookCreateResponse | null {
	if (!isRecord(input)) {
		return null;
	}

	const item = parseGuestbookMessage(input.item);
	const nextAllowedAt = readString(input.nextAllowedAt);
	if (!item || !nextAllowedAt) {
		return null;
	}

	return {
		item,
		nextAllowedAt,
	};
}
