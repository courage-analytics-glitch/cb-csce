import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { postJournalSchema, validateBalancedJournal } from "../packages/accounting/index.js";
import { MakerCheckerViolation, OperationsRepository, ORGANIZATION_ID, TradeHoldConflict, type Actor } from "./repository.js";
import { actorOf, requireAuth, requireRole, resolveActor, type SessionResolver } from "./auth.js";

const writeRoutes = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const WINDOW_MS = 60_000;
const READ_LIMIT = 120;
const WRITE_LIMIT = 30;

export type ApiOptions = { resolveSession: SessionResolver };

function rateLimit() {
  const requestWindows = new Map<string, { startedAt: number; count: number }>();
  return (request: Request, response: Response, next: NextFunction) => {
    const key = `${request.ip}:${request.method === "GET" ? "read" : "write"}`;
    const now = Date.now();
    const limit = writeRoutes.has(request.method) ? WRITE_LIMIT : READ_LIMIT;
    const current = requestWindows.get(key);
    const window = !current || now - current.startedAt >= WINDOW_MS ? { startedAt: now, count: 1 } : { ...current, count: current.count + 1 };
    requestWindows.set(key, window);
    response.setHeader("RateLimit-Limit", limit);
    response.setHeader("RateLimit-Remaining", Math.max(0, limit - window.count));
    if (window.count > limit) return response.status(429).json({ error: "RATE_LIMITED", retryAfterSeconds: 60 });
    return next();
  };
}

function publicActor(actor: Actor) {
  return { id: actor.id, role: actor.role, organizationId: actor.organizationId };
}

export function createApi(repository: OperationsRepository, options: ApiOptions) {
  const router = Router();
  router.use(rateLimit());

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "cb-csce-api", readiness: "ready", mode: repository.mode, persistence: repository.mode === "MANAGED_DATABASE" ? "managed_mysql" : "synthetic_repository", checkedAt: new Date().toISOString() });
  });

  // Everything below /health requires a verified Clerk session and an org_demo membership.
  router.use(requireAuth(options.resolveSession), resolveActor(repository));

  router.get("/me", (req, res) => res.json({ item: publicActor(actorOf(req)) }));

  router.get("/operations/summary", async (_req, res) => res.json(await repository.summary()));

  router.get("/trades", async (req, res) => res.json({ items: await repository.listTrades(typeof req.query.q === "string" ? req.query.q : undefined), provenance: repository.provenance() }));

  router.get("/trades/:tradeId", async (req, res) => {
    const trade = await repository.getTrade(req.params.tradeId);
    if (!trade) return res.status(404).json({ error: "TRADE_NOT_FOUND" });
    return res.json({ item: trade, provenance: repository.provenance() });
  });

  router.get("/commodities", async (_req, res) => res.json({ items: await repository.commodityBatches(), provenance: repository.provenance() }));

  router.post("/trades/:tradeId/hold", requireRole("operations", "compliance"), async (req, res) => {
    const body = z.object({ reason: z.string().min(10).max(240) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "INVALID_REASON", details: body.error.flatten() });
    const actor = actorOf(req);
    try {
      const trade = await repository.placeTradeOnHold(req.params.tradeId, actor, body.data.reason);
      if (!trade) return res.status(404).json({ error: "TRADE_NOT_FOUND" });
      return res.json({ item: trade, audit: { action: "TRADE_HOLD_APPLIED", actor: publicActor(actor), reason: body.data.reason, provenance: repository.provenance() } });
    } catch (error) {
      if (error instanceof TradeHoldConflict) return res.status(409).json({ error: error.code });
      throw error;
    }
  });

  router.post("/trades/:tradeId/release", requireRole("compliance", "checker"), async (req, res) => {
    const actor = actorOf(req);
    try {
      const trade = await repository.releaseTradeHold(req.params.tradeId, actor);
      if (!trade) return res.status(404).json({ error: "TRADE_NOT_FOUND" });
      return res.json({ item: trade, audit: { action: "TRADE_HOLD_RELEASED", actor: publicActor(actor), provenance: repository.provenance() } });
    } catch (error) {
      if (error instanceof TradeHoldConflict) return res.status(409).json({ error: error.code });
      if (error instanceof MakerCheckerViolation) return res.status(403).json({ error: "MAKER_CHECKER_VIOLATION", message: error.message });
      throw error;
    }
  });

  router.get("/ledger/journals", async (_req, res) => res.json({ items: await repository.journals(), provenance: repository.provenance() }));
  router.get("/ledger/accounts", async (_req, res) => res.json({ items: await repository.accounts(), provenance: repository.provenance() }));

  router.post("/ledger/journals/validate", requireRole("treasury", "checker"), (req, res) => {
    const parsed = postJournalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ valid: false, error: parsed.error.issues[0]?.message ?? "Invalid journal" });
    try {
      validateBalancedJournal(parsed.data);
      return res.json({ valid: true, posted: false, message: "Journal balances and is eligible for posting; validation did not persist a new record." });
    } catch (error) {
      return res.status(422).json({ valid: false, error: error instanceof Error ? error.message : "Journal failed validation" });
    }
  });

  router.post("/ledger/journals", requireRole("treasury"), async (req, res) => {
    const parsed = postJournalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid journal" });
    const actor = actorOf(req);
    if (parsed.data.organizationId !== ORGANIZATION_ID) return res.status(403).json({ error: "DEMO_ORGANIZATION_SCOPE_REQUIRED" });
    try {
      const result = await repository.postJournal(parsed.data, actor);
      return res.status(201).json({ item: result, provenance: repository.provenance() });
    } catch (error) {
      return res.status(422).json({ error: error instanceof Error ? error.message : "Journal failed validation" });
    }
  });

  router.post("/ledger/journals/:journalId/reverse", requireRole("treasury", "checker"), async (req, res) => {
    const body = z.object({ idempotencyKey: z.string().min(8).max(120) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "INVALID_REVERSAL_REQUEST" });
    try {
      const result = await repository.reverseJournal(req.params.journalId, body.data.idempotencyKey, actorOf(req));
      return res.status(201).json({ item: result, provenance: repository.provenance() });
    } catch (error) {
      if (error instanceof MakerCheckerViolation) return res.status(403).json({ error: "MAKER_CHECKER_VIOLATION", message: error.message });
      return res.status(422).json({ error: error instanceof Error ? error.message : "Reversal failed" });
    }
  });

  router.get("/compliance/cases", async (_req, res) => res.json({ items: (await repository.datasets()).complianceCases, provenance: repository.provenance() }));
  router.get("/documents", async (_req, res) => res.json({ items: (await repository.datasets()).documents, provenance: repository.provenance() }));
  router.get("/settlements", async (_req, res) => res.json({ items: (await repository.datasets()).settlements, provenance: repository.provenance() }));
  router.get("/shipments", async (_req, res) => res.json({ items: (await repository.datasets()).shipments, provenance: repository.provenance() }));
  router.get("/treasury/fx-rates", async (_req, res) => res.json({ items: (await repository.datasets()).fxRates, provenance: repository.provenance() }));
  router.get("/treasury/exposures", async (_req, res) => res.json({ items: await repository.fxExposures(), provenance: repository.provenance() }));
  router.get("/compliance/counterparties", async (_req, res) => res.json({ items: await repository.counterparties(), provenance: repository.provenance() }));
  router.get("/workflows", async (_req, res) => res.json({ items: await repository.workflows(), provenance: repository.provenance() }));
  router.get("/analytics/liquidity-risk", async (_req, res) => res.json({ items: await repository.liquidityRisk(), provenance: repository.provenance() }));
  router.get("/analytics/demurrage", async (_req, res) => res.json({ items: await repository.demurrage(), provenance: repository.provenance() }));
  router.get("/reconciliation", async (_req, res) => res.json({ items: await repository.reconciliation(), provenance: repository.provenance() }));
  router.get("/reports", async (_req, res) => res.json({ items: await repository.reports(), provenance: repository.provenance() }));
  router.get("/ai/review", async (_req, res) => res.json({ items: await repository.agentFindings(), provenance: repository.provenance(), decisionPolicy: "ADVISORY_ONLY_HUMAN_APPROVAL_REQUIRED" }));
  router.get("/audit", async (_req, res) => res.json({ items: (await repository.datasets()).auditEvents, provenance: repository.provenance() }));

  return router;
}
