# Cross-Border Commodity Settlement & Compliance Engine (CB-CSCE)

CB-CSCE is a production-oriented control plane for Ghana-origin commodity trade, multi-currency settlement, export evidence, shipment risk, and explainable compliance workflows.

## Current delivery

The current vertical slice includes an operations dashboard, trade register and detail view, controlled hold action, Decimal-based idempotent ledger service, ledger register, compliance case queue, document integrity queue, settlement queue, shipment milestones, FX rate registry, audit trail, route-complete enterprise shell, MySQL-compatible schema/migration baseline, and operating documentation.

The current repository adapter deliberately displays deterministic synthetic records with a persistent `DEMO / SANDBOX` banner. The managed database schema and migration baseline are present, but this slice does not claim live persistence until a database-backed repository is explicitly enabled. Synthetic data is not a bank confirmation, sanctions clearance, regulatory approval, or executed payment. External providers remain explicit adapters and unavailable states remain visible.

## Run locally

```bash
pnpm install
pnpm dev
```

Check readiness with `curl http://localhost:3000/api/health`. Run `pnpm check`, `pnpm test`, and `pnpm build` before checkpointing. For managed persistence, configure the platform-provided `DATABASE_URL` and run `pnpm db:migrate` once for the additive schema baseline.

## Controls

See `docs/accounting-policy.md`, `docs/compliance-controls.md`, `docs/architecture.md`, and `docs/deployment.md`. The accounting domain is independently testable at `packages/accounting/index.ts` and rejects unbalanced, non-positive, mixed debit/credit lines while protecting retries with idempotency.
