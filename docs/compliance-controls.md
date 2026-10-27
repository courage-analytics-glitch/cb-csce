# Compliance Controls

Screening results are not treated as clear when the provider is stale, unavailable, or returns an error. Potential and confirmed matches require human review, evidence retention, and maker-checker separation. Confirmed matches block applicable release workflows. The demo environment uses synthetic screening states and is clearly labeled.

Documents are identified by type, version, digest, status, and approval history. A digest mismatch or change after approval creates an exception; the system does not silently accept the new version. Export readiness is a controlled state derived from evidence, not a manually asserted label.

Payment route selection is compliance-aware and lawful. The platform must not conceal counterparties, disguise fund origin, or route around sanctions. If a verified permissible route is unavailable, the decision is `NO_ELIGIBLE_ROUTE` and execution remains blocked.

# Operations Runbook

For local development, install the pinned pnpm version, run `pnpm install`, then `pnpm dev`. Verify `/api/health` before using Preview. For a managed database, set the platform-provided `DATABASE_URL` and run `pnpm db:migrate` once for additive schema preparation. Never run destructive SQL against the shared managed database without an approved backup and explicit authorization.

Health checks report process readiness and whether the repository is using managed persistence or synthetic demo mode. Integration failures are visible in Administration > Integrations. Rotate external credentials through protected configuration, never through committed files. Review audit events after any state-changing operation.
