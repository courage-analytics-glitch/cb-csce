# Deployment and Recovery

The application builds with `pnpm build`, producing `dist/server` and `dist/public`. The container listens on `PORT` with a default of 3000 and exposes `/api/health` without authentication. The build does not require private credentials or a database connection; the database is opened at runtime.

The Docker build explicitly bootstraps the repository-pinned `pnpm@10.18.0` before installing dependencies and running the build. This is required because relying on the base image's default Corepack selection can install with a different pnpm major version and leave the subsequent pinned build process without the expected tool binaries.

The managed database is shared by development and published runtime. Treat migrations as additive and idempotent. For disaster recovery, export database records through an approved operational process, retain document objects in durable object storage, and preserve audit/event history. The platform project checkpoint is not a database backup.

# API Contract Notes

`GET /api/health` returns readiness, persistence mode, and environment. `GET /api/operations/summary` returns multi-currency KPIs, charts, alerts, and provenance. `GET /api/trades`, `/api/ledger/journals`, `/api/compliance/cases`, `/api/documents`, `/api/settlements`, and `/api/shipments` return typed operational records. `POST /api/ledger/journals/validate` validates a journal without posting. `POST /api/ledger/journals` posts a validated journal through the idempotent ledger service. All external inputs are schema-validated and state-changing operations are auditable.

## Security boundary

The synthetic repository denies all state-changing demo API requests unless `CSCE_DEMO_MUTATION_TOKEN` is configured server-side and the caller supplies the matching `x-csce-demo-token` header. The token is a containment mechanism for demonstration mutations, not production authentication or authorization. Do not place it in browser code, source control, logs, or public documentation. Production must replace demo actor headers with an authenticated identity provider, server-derived tenant context, role/permission checks, maker-checker enforcement, durable audit events, and a database-backed transaction boundary.

The runtime applies bounded JSON request bodies, API no-store responses, request IDs, rate limits, JSON parse/size error handling, CSP, `nosniff`, referrer and permissions policies, and disables Express fingerprinting. The in-memory rate limiter is suitable only for the synthetic single-process slice; production requires a distributed control or edge/API gateway policy.
