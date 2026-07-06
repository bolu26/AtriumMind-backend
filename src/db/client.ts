import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import { rootLogger } from "../lib/logger.js";
import { dbPoolTotal } from "../lib/metrics.js";
import * as schema from "./schema.js";

const dbUrl = config.DATABASE_URL.replace(/\?.*$/, "");
const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");

// Log sanitized URL for debugging (hide password)
const sanitizedUrl = dbUrl.replace(/:([^:@]+)@/, ":***@");
rootLogger.info({ url: sanitizedUrl, ssl: !isLocal }, "DB connecting");

const client = postgres(dbUrl, {
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 3,
  idle_timeout: 20,
  connect_timeout: 30,
  transform: { undefined: null },
});

client`SELECT current_database() as db, current_schema() as schema`.then((rows) => {
  rootLogger.info({ db: rows[0]?.db, schema: rows[0]?.schema }, "DB connected OK");
}).catch((err: any) => {
  rootLogger.error({
    message: String(err?.message),
    code: String(err?.code ?? ""),
    detail: String(err?.detail ?? ""),
    hint: String(err?.hint ?? ""),
    url: sanitizedUrl,
  }, "DB connection FAILED - full error");
});

export const db = drizzle(client, { schema });
export const pgClient = client;

let poolLogInterval: ReturnType<typeof setInterval> | undefined;

export function startPoolMetrics(intervalMs = 30_000): void {
  if (poolLogInterval) return;
  poolLogInterval = setInterval(() => {
    rootLogger.info({ event: "db_pool_stats" }, "DB pool stats");
  }, intervalMs);
  poolLogInterval.unref?.();
}

export function stopPoolMetrics(): void {
  if (poolLogInterval) { clearInterval(poolLogInterval); poolLogInterval = undefined; }
}
