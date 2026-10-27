# CB-CSCE Implementation Plan

## Implementation approach

CB-CSCE will be delivered as a modular monolith: a React + TypeScript operations console served by Vite, with an Express API boundary and domain modules that can later be extracted without changing business contracts. The initial slice prioritizes the executive operating loop: trade readiness, compliance holds, document integrity, shipment risk, settlement conditions, FX exposure, and immutable multi-currency accounting.

The application will use a strict separation between presentation, API contracts, domain services, and persistence adapters:

- `client/` owns route-aware views, the enterprise shell, charts, tables, filters, and accessible interaction states.
- `server/` owns HTTP handlers, request validation, current-user/tenant context, metrics aggregation, and persistence adapters.
- `packages/accounting/` owns currency policy, Decimal arithmetic, journal validation, idempotency, and immutable posting behavior independently of the UI.
- `drizzle/` contains the MySQL-compatible schema and additive migration artifacts for the managed database.
- `docs/` records architecture, accounting policy, compliance controls, operations, recovery, deployment, and API notes.

The managed database is the production persistence target and the committed MySQL-compatible schema is additive. This delivery intentionally keeps the repository adapter in explicit `DEMO_SYNTHETIC` mode because a database-backed repository, application authentication, and tenant authorization are not yet wired. Every response is marked `DEMO_SYNTHETIC` and the UI carries a persistent environment banner; no synthetic result is presented as a verified bank, sanctions, regulatory, or settlement outcome. The persistence adapter boundary is designed so database-backed repositories can be enabled without changing client contracts.

Financial calculations use `decimal.js` only. Journals are balanced independently by currency, require at least two positive lines, reject mixed-currency balancing, enforce idempotency, and never mutate posted records. Corrections are represented as reversals. FX rates carry source, observed time, freshness, and rate type; exposure results are estimates and preserve the original transaction currency.

The UI will expose all requested navigation paths. The initial vertical slice has working data-backed API calls for the dashboard, trades, ledger journals, compliance cases, documents, settlements, shipments, and analytics. Remaining routes use the same shell and explicit empty/coming-soon states rather than fabricated completion claims. All sensitive or unavailable integrations remain adapter boundaries with provenance and health status.

## Build workflow

1. Create the plan and outcome-based TODO before implementation.
2. Add pinned Node tooling, explicit dependency/build policy, route manifest, environment example, and app metadata.
3. Implement the accounting domain and tests before wiring dashboard data.
4. Implement the Express API, seed repository, request validation, health endpoint, and route-level metrics.
5. Implement the shell, dashboard, trade/readiness views, ledger views, compliance/document/settlement/shipment views, and responsive states.
6. Add migration/schema and operating documentation without claiming live external integrations.
7. Run type checks, tests, build, health checks, route-manifest checks, and a read-only requirements validation pass.
8. Commit the accepted implementation to the canonical main branch as a checkpoint. Publication remains separate and is not claimed unless explicitly confirmed by the platform.

## Project structure

```text
cbcsce/
├── client/src/
│   ├── App.tsx                 # route-aware shell and page composition
│   ├── main.tsx                # client bootstrap
│   ├── components/             # UI primitives and data display components
│   ├── data/                   # typed API client and view models
│   └── styles.css              # enterprise treasury visual system
├── server/
│   ├── index.ts                # Express entrypoint and static serving
│   ├── api.ts                  # validated REST endpoints
│   ├── repository.ts           # persistence adapter and deterministic demo repository
│   ├── seed.ts                 # synthetic operational fixtures
│   └── accounting/ledger.ts    # Decimal-based immutable posting service
├── packages/accounting/
│   └── index.ts                # reusable accounting exports
├── drizzle/
│   ├── schema.ts               # MySQL-compatible persistence model
│   └── 0000_initial.sql        # additive migration baseline
├── tests/                      # node:test coverage for controls and API contracts
├── docs/                       # architecture and operations documentation
├── public/manus-routes.json    # complete route manifest
├── Dockerfile
├── app.config.ts
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

## Design direction

### Candidate styles

- **Operations Ledger / 0.07:** Dense Swiss-influenced treasury console with narrow navigation, ledger rules, and typographic hierarchy.
- **Port Authority Modernism / 0.05:** Industrial trade-operations interface using route lines, milestone marks, and restrained signal colors.
- **Quiet Risk Observatory / 0.08:** Calm, data-led risk room with pale surfaces and selective warning accents.

### Chosen style: Operations Ledger

**Design Movement:** Swiss information design translated into a modern treasury-management console.

**Core Principles:** Evidence before emphasis; compact density without clutter; signal colors only for state; every number has a unit, currency, timestamp, or provenance.

**Color Philosophy:** A pale #F5F7FA canvas keeps long operational sessions calm. #111827 anchors navigation like a control ledger. #2563EB marks actionable paths, while green, amber, and red are reserved for status and exceptions rather than decoration.

**Layout Paradigm:** A persistent dark rail and slim command bar frame a wide, asymmetric work surface. The dashboard begins with a vertical risk strip and a broad operations table instead of a centered card grid. Detail views use left-aligned identifiers and right-side evidence panels.

**Signature Elements:** Hairline ledger rules; compact status pills with plain-language labels; “signal rail” markers for blocked, stale, and verified evidence.

**Interaction Philosophy:** Actions are explicit and reversible where possible. Filters preserve context. Any state-changing action names the record, actor role, and downstream control implication.

**Animation:** Use short 120–180ms fades and horizontal status transitions only. Avoid looping motion; animate loading skeletons subtly and let risk signals remain still and legible.

**Typography System:** Inter for interface text, tabular numerals for all amounts, and compact uppercase labels for metadata. Use a clear scale: 12px metadata, 13–14px table text, 16px section headings, 28–36px executive values.

**Brand Essence:** A control plane for commodity trade, money movement, and compliance evidence — precise, explainable, and corridor-aware. Personality: exacting, calm, accountable.

**Brand Voice:** Headlines state operational truth; CTAs describe the next controlled action. Example lines: “Release only when evidence is complete.” “Review the exception, not the assumption.”

**Wordmark & Logo:** A two-line “CSCE” wordmark with a small crossing-arrow ledger mark, evoking a commodity route crossing a settlement rail.

**Signature Brand Color:** Ledger blue `#2563EB`, used as the unmistakable action and identity color.
