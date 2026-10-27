# CB-CSCE Architecture

CB-CSCE is a modular monolith with clear domain boundaries. The browser-facing operations console is a React/Vite application. Express serves the API, health endpoint, and compiled assets. The managed MySQL-compatible database is the durable system of record when `DATABASE_URL` is available. The repository interface makes the synthetic demonstration mode explicit when it is not.

The accounting domain is isolated from React and Express. It validates journals with Decimal arithmetic, balances each currency independently, rejects zero/negative or mixed debit-credit lines, and makes idempotent postings immutable. The production persistence adapter should map the same domain commands to a database transaction and unique constraint on `(organization_id, idempotency_key)`.

External providers are adapters, not hidden fallbacks. A rate provider, screening provider, object-storage provider, and bank/settlement connector must return provenance and freshness. The UI distinguishes verified, sandbox, synthetic, stale, error, and unavailable states. The demo repository is deterministic and carries `DEMO_SYNTHETIC` on responses.

The next extraction seams are accounting, compliance policy, risk analytics, and integration workers. These can move to queue-backed services when throughput or regulatory isolation requires it without changing client contracts.
