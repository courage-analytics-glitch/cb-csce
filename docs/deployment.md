# Deployment and Recovery

The application builds with `pnpm build`, producing `dist/server` and `dist/public`. The container listens on `PORT` with a default of 3000 and exposes `/api/health` without authentication. The build does not require private credentials or a database connection; the database is opened at runtime.

The managed database is shared by development and published runtime. Treat migrations as additive and idempotent. For disaster recovery, export database records through an approved operational process, retain document objects in durable object storage, and preserve audit/event history. The platform project checkpoint is not a database backup.

# API Contract Notes

`GET /api/health` returns readiness, persistence mode, and environment. `GET /api/operations/summary` returns multi-currency KPIs, charts, alerts, and provenance. `GET /api/trades`, `/api/ledger/journals`, `/api/compliance/cases`, `/api/documents`, `/api/settlements`, and `/api/shipments` return typed operational records. `POST /api/ledger/journals/validate` validates a journal without posting. `POST /api/ledger/journals` posts a validated journal through the idempotent ledger service. All external inputs are schema-validated and state-changing operations are auditable.
