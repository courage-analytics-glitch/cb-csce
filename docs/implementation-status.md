# Implementation Status

## Delivered and verified

The current checkpoint delivers a coherent managed-database vertical slice: enterprise shell and complete route manifest; API-backed executive summary; trade register, search, detail, and auditable hold; Decimal-based multi-currency journal validation, transactional idempotent posting, reversal service, account/currency/precision checks, and unit tests; compliance cases; document integrity states; settlement queue; shipment milestones; FX rate registry; durable audit feed; additive MySQL migrations; OpenAPI notes; and operational documentation. Synthetic fixtures are seeded idempotently into managed MySQL and retain explicit provenance labels.

Security hardening in this checkpoint adds a server-side opt-in token for all state-changing demo API requests, constant-time token comparison, anonymous mutation denial when the token is absent, bounded JSON request bodies, API `no-store` responses, request IDs, rate limits, safer error envelopes, additional security headers, dependency auditing and tracked-credential scanning in CI, plus regression tests for the anonymous mutation defect.

`pnpm check`, `pnpm test`, and `pnpm build` pass. The managed sandbox migration applies cleanly; the runtime responds on `/api/health` with `mode: MANAGED_DATABASE` and `persistence: managed_mysql`; durable reads return `MANAGED_DATABASE` provenance; a token-gated journal posts with a durable audit event and the same idempotent journal is returned on retry. The development-only fallback remains explicitly labelled `DEMO_SYNTHETIC` when no `DATABASE_URL` is configured.

## Production gates that remain open

This checkpoint is not a claim of production readiness. Application authentication, server-derived actor identity, full tenant/organization authorization, role enforcement, and maker-checker authorization are not wired. The demo mutation token is only a containment control for synthetic state-changing routes; it is not user authentication, authorization, or a substitute for an enterprise identity provider. The managed database is shared by sandbox and published runtime, so migrations and synthetic fixture writes must be treated as shared operational data changes.

Compliance provider ingestion, document object storage, bank/escrow/L/C connectors, FX provider adapters, queue workers, complete settlement release workflows, shipment/demurrage calculation, reconciliation, reporting, and administrative APIs remain open. Several registered routes currently render an explicit control-surface placeholder rather than pretending those workflows are complete.

Before production use, implement and test a database-backed repository with transactional writes and foreign keys, application authentication and authorization, durable audit events, complete domain migrations, external provider contracts and health checks, restart/persistence tests, cross-tenant negative tests, a full API/UI acceptance suite, centralized monitoring, incident response, backup/restore and disaster-recovery exercises, secure SDLC evidence, and jurisdiction-specific AML/sanctions/payment/privacy controls. Do not remove the demo banner until those gates are satisfied.
