import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export const FOOD_EMOJIS = [
  "🍎",
  "🍐",
  "🍊",
  "🍓",
  "🍑",
  "🥝",
  "🥐",
  "🍞",
  "🍔",
  "🍟",
  "🍣",
  "🧋",
  "🍬",
] as const;

const MIN_FOOD_ID = 1;
const MAX_FOOD_ID = FOOD_EMOJIS.length;
const FEED_COOLDOWN_MS = 3_000;

export interface FoodSummary {
	id: number;
	emoji: string;
	totalCount: number;
	viewerCount: number;
}

interface FoodRow {
  id: number;
  totalCount: number;
  viewerCount: number;
}

function resolveFoodDatabasePath(): string {
  const baseDir = join(homedir(), ".local", "share", "amiokay");
  mkdirSync(baseDir, { recursive: true });
  return join(baseDir, "food.db");
}

function assertFoodId(foodId: number): void {
  if (!Number.isInteger(foodId) || foodId < MIN_FOOD_ID || foodId > MAX_FOOD_ID) {
    throw new RangeError(
      `food id must be an integer between ${MIN_FOOD_ID} and ${MAX_FOOD_ID}`,
    );
  }
}

export function getFoodEmoji(foodId: number): string {
  assertFoodId(foodId);
  const emoji = FOOD_EMOJIS[foodId - 1];
  if (!emoji) {
    throw new RangeError(`no emoji configured for food id ${foodId}`);
  }

  return emoji;
}

export class FoodStore {
  private readonly db: Database;

  constructor(private readonly databasePath = resolveFoodDatabasePath()) {
    mkdirSync(dirname(this.databasePath), { recursive: true });
    this.db = new Database(this.databasePath, { create: true, strict: true });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS food_counts (
        id INTEGER NOT NULL,
        fingerprint TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, fingerprint)
      );

      CREATE INDEX IF NOT EXISTS idx_food_counts_id
      ON food_counts (id);

      CREATE INDEX IF NOT EXISTS idx_food_counts_fingerprint
      ON food_counts (fingerprint);

      CREATE TABLE IF NOT EXISTS food_rate_limits (
        fingerprint TEXT PRIMARY KEY,
        last_action_ms INTEGER NOT NULL
      );
    `);
  }

  getDatabasePath(): string {
    return this.databasePath;
  }

  listFoods(fingerprint: string): FoodSummary[] {
    const rows = this.db
      .query(
        `
          SELECT
            id,
            SUM(count) AS totalCount,
            SUM(CASE WHEN fingerprint = ?1 THEN count ELSE 0 END) AS viewerCount
          FROM food_counts
          GROUP BY id
        `,
      )
      .all(fingerprint) as FoodRow[];

    const byId = new Map<number, FoodRow>(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          totalCount: Number(row.totalCount) || 0,
          viewerCount: Number(row.viewerCount) || 0,
        },
      ]),
    );

    return FOOD_EMOJIS.map((emoji, index) => {
      const id = index + 1;
      const row = byId.get(id);

      return {
        id,
        emoji,
        totalCount: row?.totalCount ?? 0,
        viewerCount: row?.viewerCount ?? 0,
      };
    });
  }

	toggle(foodId: number, fingerprint: string): FoodSummary {
		assertFoodId(foodId);
		const now = Date.now();

		this.db.transaction(() => {
			const rateLimit = this.db
				.query(
					`
						SELECT last_action_ms
						FROM food_rate_limits
						WHERE fingerprint = ?1
					`,
				)
				.get(fingerprint) as { last_action_ms: number } | null;

			if (
				rateLimit &&
				Number.isFinite(Number(rateLimit.last_action_ms)) &&
				now - Number(rateLimit.last_action_ms) < FEED_COOLDOWN_MS
			) {
				throw new Error("RATE_LIMITED");
			}

			const existing = this.db
				.query(
					`
						SELECT count
						FROM food_counts
						WHERE id = ?1 AND fingerprint = ?2
					`,
				)
				.get(foodId, fingerprint) as { count: number } | null;

			const isCurrentlySelected = Boolean(existing && Number(existing.count) > 0);

			// A fingerprint can only have one active food at a time.
			this.db
				.query(
					`
						UPDATE food_counts
						SET count = 0, updated_at = CURRENT_TIMESTAMP
						WHERE fingerprint = ?1 AND count > 0
					`,
				)
				.run(fingerprint);

			if (!isCurrentlySelected) {
				this.db
					.query(
						`
							INSERT INTO food_counts (id, fingerprint, count, updated_at)
							VALUES (?1, ?2, 1, CURRENT_TIMESTAMP)
							ON CONFLICT(id, fingerprint) DO UPDATE SET
								count = 1,
								updated_at = CURRENT_TIMESTAMP
						`,
					)
					.run(foodId, fingerprint);
			}

			this.db
				.query(
					`
						INSERT INTO food_rate_limits (fingerprint, last_action_ms)
						VALUES (?1, ?2)
						ON CONFLICT(fingerprint) DO UPDATE SET
							last_action_ms = excluded.last_action_ms
					`,
				)
				.run(fingerprint, now);
		})();

		const result = this.listFoods(fingerprint).find((food) => food.id === foodId);
		if (!result) {
			throw new Error(`failed to read food summary for id ${foodId}`);
		}

		return result;
	}
}
