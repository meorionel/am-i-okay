import { mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";
import type { GuestbookListResponse, GuestbookMessage } from "./types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function getDatabaseFilePath(): string {
  return join(homedir(), ".local", "share", "amiokay", "guestbook.sqlite");
}

function toViewerHash(viewerId: string): string {
  return createHash("sha256").update(viewerId).digest("hex");
}

export function parseGuestbookPage(value: string | null): number {
  if (value === null || value.trim().length === 0) {
    return 1;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new RangeError("page must be a positive integer");
  }

  return parsed;
}

export function parseGuestbookPageSize(value: string | null): number {
  if (value === null || value.trim().length === 0) {
    return DEFAULT_PAGE_SIZE;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PAGE_SIZE) {
    throw new RangeError(`pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}`);
  }

  return parsed;
}

export class GuestbookStore {
  private readonly database: Database;
  private readonly countStatement;
  private readonly listStatement;
  private readonly insertStatement;

  constructor() {
    const databaseFilePath = getDatabaseFilePath();
    mkdirSync(dirname(databaseFilePath), { recursive: true });

    this.database = new Database(databaseFilePath, { create: true });
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        viewer_id_hash TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_created_at
      ON messages (created_at DESC, id DESC);
    `);

    this.countStatement = this.database.query("SELECT COUNT(*) AS total FROM messages");
    this.listStatement = this.database.query(
      `SELECT id, body, created_at
       FROM messages
       ORDER BY created_at DESC, id DESC
       LIMIT $limit OFFSET $offset`,
    );
    this.insertStatement = this.database.query(
      `INSERT INTO messages (id, body, created_at, viewer_id_hash)
       VALUES ($id, $body, $createdAt, $viewerIdHash)`,
    );
  }

  listMessages(page: number, pageSize: number): GuestbookListResponse {
    const totalRow = this.countStatement.get() as { total?: number } | null;
    const total = totalRow?.total ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;
    const rows = this.listStatement.all({ $limit: pageSize, $offset: offset }) as Array<{
      id: string;
      body: string;
      created_at: string;
    }>;
    const items = rows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
    }));

    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  createMessage(body: string, viewerId: string): GuestbookMessage {
    const message: GuestbookMessage = {
      id: crypto.randomUUID(),
      body,
      createdAt: new Date().toISOString(),
    };

    this.insertStatement.run({
      $id: message.id,
      $body: message.body,
      $createdAt: message.createdAt,
      $viewerIdHash: toViewerHash(viewerId),
    });

    return message;
  }
}
