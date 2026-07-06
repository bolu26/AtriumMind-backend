import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import { rootLogger } from "../lib/logger.js";
import { dbPoolTotal, dbPoolIdle } from "../lib/metrics.js";
import * as schema from "./schema.js";

const POOL_WARN_THRESHOLD = 5;
let totalConnections = 0;
const seenConnections = new Set<number>();

const dbUrl = config.DATABASE_URL.replace(/\?.*$/, "");
const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");

const client = postgres(dbUrl, {
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 3,
  idle_timeout: 20,
  connect_timeout: 30,
  transform: { undefined: null },
  debug: (_connId: number, query: string, params: unknown[]) => {
    rootLogger.debug({ query: query.slice(0, 200), params }, "db query");
  },
  onnotice: (notice: unknown) => {
    rootLogger.warn({ notice }, "db notice");
  },
});

// Test connection on startup and log any errors
client`SELECT current_database(), current_schema(), version()`.then((rows) => {
  rootLogger.info({ db: rows[0] }, "DB connected successfully");
}).catch((err: Error) => {
  rootLogger.error({ err: { message: err.message, code: (err as any).code, detail: (err as any).detail } }, "DB connection test FAILED");
});

export const db = drizzle(client, { schema });
export const pgClient = client;

let poolLogInterval: ReturnType<typeof setInterval> | undefined;

export function startPoolMetrics(intervalMs = 30_000): void {
  if (poolLogInterval) return;
  poolLogInterval = setInterval(() => {
    const total = totalConnections;
    const max = (client.options.max as number) ?? 10;
    rootLogger.info({ event: "db_pool_stats", total, max }, "DB pool stats");
  }, intervalMs);
  poolLogInterval.unref?.();
}

export function stopPoolMetrics(): void {
  if (poolLogInterval) {
    clearInterval(poolLogInterval);
    poolLogInterval = undefined;
  }
}
