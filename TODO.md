# CB-CSCE Outcome Checklist

Status uses `[x]` for evidence-backed delivery, `[-]` for a partially delivered slice with explicit open gates, and `[ ]` for work not yet delivered. See `docs/implementation-status.md` for the production boundary.

## 1. Enterprise shell and route coverage

- [x] Provide a responsive desktop-first enterprise shell with collapsible dark navigation, top search, organization and environment indicator, notifications, profile/session controls, breadcrumbs, date range and currency preferences, quick actions, help access, and a persistent demo/sandbox/production banner.
- [x] Expose the required routes: `/dashboard`, `/trades`, `/trades/new`, `/trades/[tradeId]`, `/commodities`, `/ledger`, `/ledger/accounts`, `/ledger/journals`, `/treasury`, `/treasury/fx-rates`, `/treasury/exposures`, `/compliance`, `/compliance/cases`, `/compliance/counterparties`, `/documents`, `/workflows`, `/settlements`, `/settlements/[settlementId]`, `/shipments`, `/shipments/[shipmentId]`, `/analytics/liquidity-risk`, `/analytics/demurrage`, `/reconciliation`, `/reports`, `/audit`, `/administration/users`, `/administration/roles`, `/administration/integrations`, and `/administration/settings`, with explicit loading, empty, error, and unauthorized states. The route manifest is complete and every declared route now has a route-specific workspace or detail view rather than a repeated placeholder.
- [x] Replace repeated placeholder interfaces with distinct operational surfaces for commodity batches, workflow queues, treasury and FX exposure, liquidity risk, demurrage, reconciliation, reporting, administration, chart of accounts, journal posting, counterparties, and new-trade intake. Sandbox browser verification confirmed navigation destinations and rendered page-specific headings/data for the core tabs.
- [x] Ensure all declared operational read resources return JSON contracts: commodities, ledger accounts, FX exposures, counterparties, workflows, liquidity risk, demurrage, reconciliation, and reports. Unknown `/api/*` paths now return JSON 404 responses instead of the SPA HTML shell, with regression coverage.

## 2. Executive operations dashboard

- [-] Drive KPI cards and charts from API data and calculated metrics; display currencies separately and label synthetic demonstration data. Managed MySQL now supplies persisted trades, journals, operational records and audit events; KPI aggregation is live for core trade quantities, while treasury, settlement and provider-backed metrics remain synthetic or adapter-backed.
- [x] Include active trade value, transit volume, cash by currency, receivables, payables, restricted funds, approval queues, compliance review, document verification, demurrage risk, and FX exposure.
- [x] Include operational alerts for missing permits, stale screenings, FX tolerance breaches, L/C discrepancies, escrow conditions, port delay, document hash mismatch, unbalanced journal attempts, integration failure, and unreconciled bank entries when supported by current state. Synthetic alerts are explicitly labeled.

## 3. Trade, batch, document, and shipment lifecycle

- [-] Support trade and batch identifiers, buyer/seller, beneficial ownership, commodity specifications, quantity/unit, origin/destination, ports, Incoterms, pricing/currency, freight/insurance, dates, payment terms, settlement method, expiry, relationship owner, risk classification, and supporting evidence. The delivered trade register/detail covers the primary commercial fields; full batch/document intake persistence remains open.
- [-] Support controlled transitions `DRAFT → UNDER_REVIEW → APPROVED → DOCUMENTATION_IN_PROGRESS → READY_FOR_EXPORT → SHIPPED → ARRIVED → SETTLEMENT_PENDING → SETTLED → CLOSED`, plus `ON_HOLD`, `REJECTED`, `CANCELLED`, and `DISPUTED`; prevent skipped mandatory transitions and audit reopening/cancellation. The UI shows the lifecycle and the demo hold is auditable in-memory; full transition authorization and durable audit persistence remain open.
- [-] Track document versions, type/status, SHA-256 integrity, reviewer state, expiry/staleness, required evidence, post-approval changes, and shipment milestones with ETA/ATA and demurrage/detention risk. Display states are delivered; durable document storage and provider-backed integrity verification remain open.

## 4. Immutable multi-currency ledger

- [x] Support GHS, USD, AED, CNY/RMB display policy, and RUB with centralized precision rules.
- [-] Enforce at least two positive Decimal lines per journal, independent balance by currency, valid accounts and currencies, atomic posting, unique business reference and idempotency key, immutable posted journals, reversal-based corrections, safe retry behavior, and period authorization boundaries. Decimal validation, account/currency/precision checks, business-reference uniqueness, idempotency payload protection, reversal logic, managed MySQL transactions, durable storage, and runtime retry verification are delivered; period controls and approval authorization remain open.
- [-] Provide account balances, journal register/detail, pending approvals, posting history, reversal workflow, trial balance, general ledger, reconciliation, period close, and audit history, with filters for date, currency, account, status, type, and reference. The journal register and audit feed are delivered; the remaining accounting views and approval controls are open.

## 5. Treasury, FX, compliance, and settlement controls

- [-] Persist FX rate provenance and freshness, distinguish indicative/executable/accounting rates, bound conversion routes, expose estimated spread/fees/legs/expiry, and return `NO_ELIGIBLE_ROUTE` when no verified lawful route exists. The rate registry and explicit unavailable/no-route states are displayed; provider adapters and route evaluation are open.
- [-] Screen counterparties and related subjects with source version, timestamps, match evidence, stale/error states, human review, maker-checker controls, escalation, and confirmed-match blocks; never convert unavailable or stale screening into `CLEAR`. Synthetic cases and non-clear states are displayed; provider ingestion, durable evidence, and maker-checker enforcement are open.
- [-] Track escrow, advance T/T, and L/C conditions, received/reserved/settled/outstanding amounts, discrepancies, approvals, release controls, linked journals, liquidity-at-risk, demurrage analytics, and immutable settlement events. Queues and risk labels are displayed; release workflow, durable settlement events, and analytics engines are open.

## 6. Security, audit, and integration boundaries

- [-] Enforce organization scoping, role separation for maker/checker/treasury/compliance/operations/auditor/admin, validated external inputs, idempotency, safe error handling, no secrets in source, and complete actor/system audit events. Request validation, bounded JSON bodies, request IDs, rate limits, security headers, API no-store responses, explicit server-side demo mutation-token gating, explicit demo organization scoping, managed durable audit events, and no-secret configuration are delivered; authentication, server-derived tenant authorization, role enforcement, maker-checker controls, and distributed rate limiting remain mandatory production gates.
- [x] Keep external bank, sanctions, FX, port, and storage integrations behind adapters with explicit provenance, freshness, and failure states; do not claim live clearance, payment, or regulatory success without evidence. The current slice keeps these integrations synthetic/unavailable and visibly labeled.

## 7. Production-oriented documentation and validation

- [x] Include architecture, accounting policy, compliance controls, API/OpenAPI, operations runbook, disaster recovery, deployment, environment, schema/migration, implementation-status, and CI documentation.
- [-] Run type checks, unit/integration/security-oriented tests, production build, health endpoint verification, route-manifest verification, and a read-only requirements validation pass before checkpointing. Type checks, 12 automated tests, build, managed migration, managed health/read persistence, durable journal/idempotency/audit smoke verification, route manifest, and the independent read-only review pass are complete; full authentication, authorization, cross-tenant, provider, and browser acceptance suites remain open.
