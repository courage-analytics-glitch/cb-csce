import { Router, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { postJournalSchema, validateBalancedJournal } from "../packages/accounting/index.js";
import { OperationsRepository, type DemoActor } from "./repository.js";

const writeRoutes = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const requestWindows = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const READ_LIMIT = 120;
const WRITE_LIMIT = 30;

function demoActor(request: Request): DemoActor {
  return {
    id: request.get("x-csce-actor") ?? "demo.operator",
    role: request.get("x-csce-role") ?? "operations",
    organizationId: request.get("x-csce-organization") ?? "org_demo"
  };
}

export function mutationTokenIsValid(request: Request): boolean {
  const expected = process.env.CSCE_DEMO_MUTATION_TOKEN;
  const supplied = request.get("x-csce-demo-token");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function securityGate(request: Request, response: Response, next: NextFunction) {
  const key = `${request.ip}:${request.method === "GET" ? "read" : "write"}`;
  const now = Date.now();
  const limit = writeRoutes.has(request.method) ? WRITE_LIMIT : READ_LIMIT;
  const current = requestWindows.get(key);
  const window = !current || now - current.startedAt >= WINDOW_MS ? { startedAt: now, count: 1 } : { ...current, count: current.count + 1 };
  requestWindows.set(key, window);
  response.setHeader("RateLimit-Limit", limit);
  response.setHeader("RateLimit-Remaining", Math.max(0, limit - window.count));
  if (window.count > limit) return response.status(429).json({ error: "RATE_LIMITED", retryAfterSeconds: 60 });
  if (writeRoutes.has(request.method) && !mutationTokenIsValid(request)) {
    return response.status(503).json({ error: "DEMO_MUTATIONS_DISABLED", message: "State-changing demo operations require an explicit server-side demo mutation token." });
  }
  return next();
}

export function createApi(repository: OperationsRepository) {
  const router = Router();
  router.use(securityGate);

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "cb-csce-api", readiness: "ready", mode: repository.mode, persistence: "synthetic_repository", checkedAt: new Date().toISOString() });
  });

  router.get("/operations/summary", (_req, res) => res.json(repository.summary()));

  router.get("/trades", (req, res) => res.json({ items: repository.listTrades(typeof req.query.q === "string" ? req.query.q : undefined), provenance: repository.provenance() }));

  router.get("/trades/:tradeId", (req, res) => {
    const trade = repository.getTrade(req.params.tradeId);
    if (!trade) return res.status(404).json({ error: "TRADE_NOT_FOUND" });
    return res.json({ item: trade, provenance: repository.provenance() });
  });

  router.post("/trades/:tradeId/hold", (req, res) => {
    const body = z.object({ reason: z.string().min(10).max(240) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "INVALID_REASON", details: body.error.flatten() });
    const actor = demoActor(req);
    if (actor.organizationId !== "org_demo") return res.status(403).json({ error: "DEMO_ORGANIZATION_SCOPE_REQUIRED" });
    const trade = repository.placeTradeOnHold(req.params.tradeId, actor, body.data.reason);
    if (!trade) return res.status(404).json({ error: "TRADE_NOT_FOUND" });
    return res.json({ item: trade, audit: { action: "TRADE_HOLD_APPLIED", actor, reason: body.data.reason, provenance: repository.provenance() } });
  });

  router.get("/ledger/journals", (_req, res) => res.json({ items: repository.journals(), provenance: repository.provenance() }));

  router.post("/ledger/journals/validate", (req, res) => {
    const parsed = postJournalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ valid: false, error: parsed.error.issues[0]?.message ?? "Invalid journal" });
    try {
      validateBalancedJournal(parsed.data);
      return res.json({ valid: true, posted: false, message: "Journal balances and is eligible for posting; validation did not persist a new record." });
    } catch (error) {
      return res.status(422).json({ valid: false, error: error instanceof Error ? error.message : "Journal failed validation" });
    }
  });

  router.post("/ledger/journals", (req, res) => {
    const parsed = postJournalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid journal" });
    const actor = demoActor(req);
    if (actor.organizationId !== "org_demo" || parsed.data.organizationId !== "org_demo") return res.status(403).json({ error: "DEMO_ORGANIZATION_SCOPE_REQUIRED" });
    try {
      const result = repository.postJournal(parsed.data, actor);
      return res.status(201).json({ item: result, provenance: repository.provenance() });
    } catch (error) {
      return res.status(422).json({ error: error instanceof Error ? error.message : "Journal failed validation" });
    }
  });

  router.post("/ledger/journals/:journalId/reverse", (req, res) => {
    const body = z.object({ idempotencyKey: z.string().min(8).max(120) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "INVALID_REVERSAL_REQUEST" });
    const actor = demoActor(req);
    if (actor.organizationId !== "org_demo") return res.status(403).json({ error: "DEMO_ORGANIZATION_SCOPE_REQUIRED" });
    try {
      const result = repository.reverseJournal(req.params.journalId, body.data.idempotencyKey, actor);
      return res.status(201).json({ item: result, provenance: repository.provenance() });
    } catch (error) {
      return res.status(422).json({ error: error instanceof Error ? error.message : "Reversal failed" });
    }
  });

  router.get("/compliance/cases", (_req, res) => res.json({ items: repository.datasets.complianceCases, provenance: repository.provenance() }));
  router.get("/documents", (_req, res) => res.json({ items: repository.datasets.documents, provenance: repository.provenance() }));
  router.get("/settlements", (_req, res) => res.json({ items: repository.datasets.settlements, provenance: repository.provenance() }));
  router.get("/shipments", (_req, res) => res.json({ items: repository.datasets.shipments, provenance: repository.provenance() }));
  router.get("/treasury/fx-rates", (_req, res) => res.json({ items: repository.datasets.fxRates, provenance: repository.provenance() }));
  router.get("/audit", (_req, res) => res.json({ items: repository.datasets.auditEvents, provenance: repository.provenance() }));

  return router;
}
