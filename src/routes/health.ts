import { Router, type Router as RouterType } from "express";
import { probeDatabase, probeSorobanRpc } from "../lib/probes.js";
import { overallReadinessStatus } from "../lib/readiness.js";
import { isAccepting } from "../lib/lifecycle.js";

const router: RouterType = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "atriumind",
    timestamp: new Date().toISOString(),
  });
});

router.get("/health/ready", async (_req, res) => {
  // During graceful shutdown, fail readiness immediately so load balancers stop
  // routing new traffic while in-flight requests drain.
  if (!isAccepting()) {
    res.status(503).json({
      status: "shutting_down",
      service: "atriumind",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const [database, sorobanRpc] = await Promise.all([probeDatabase(), probeSorobanRpc()]);

  const checks = { database, sorobanRpc };
  const status = overallReadinessStatus(checks);
  const httpStatus = status === "ok" ? 200 : 503;

  res.status(httpStatus).json({
    status,
    service: "atriumind",
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;

// Temporary debug endpoint - shows DB error details
router.get("/debug/db", async (_req, res) => {
  try {
    const { db } = await import("../db/client.js");
    const { publishers, resources } = await import("../db/schema.js");
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(sql`SELECT count(*) as cnt FROM publishers`);
    const rcount = await db.execute(sql`SELECT count(*) as cnt FROM resources`);
    res.json({ 
      status: "db_ok",
      publishers: result.rows[0],
      resources: rcount.rows[0]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,5) });
  }
});
