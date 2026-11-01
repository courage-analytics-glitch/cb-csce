# Deployment and Recovery

The application builds with `pnpm build`, producing `dist/server` and `dist/public`. The container listens on `PORT` with a default of 3000 and exposes `/api/health` without authentication. The build needs only `CLERK_PUBLISHABLE_KEY`, which is public and is inlined into the client bundle (Docker: `docker build --build-arg CLERK_PUBLISHABLE_KEY=... .`). It does not need `CLERK_SECRET_KEY` or a database connection; both are read at runtime. A `.dockerignore` keeps `.env` files, `node_modules` and `dist` out of the build context.

The Docker build explicitly bootstraps the repository-pinned `pnpm@10.18.0` before installing dependencies and running the build. This is required because relying on the base image's default Corepack selection can install with a different pnpm major version and leave the subsequent pinned build process without the expected tool binaries.

The managed database is shared by development and published runtime. On server startup, the repository runs the committed migration history, idempotently seeds the organization, chart of accounts, synthetic trades, journal fixtures, operational records and baseline audit events, then reports `MANAGED_DATABASE` only after those steps succeed. Treat migrations as additive and idempotent. For disaster recovery, export database records through an approved operational process, retain document objects in durable object storage, and preserve audit/event history. The platform project checkpoint is not a database backup.

# API Contract Notes

`GET /api/health` returns readiness, persistence mode, and environment. `GET /api/operations/summary` returns multi-currency KPIs, charts, alerts, and provenance. `GET /api/trades`, `/api/ledger/journals`, `/api/compliance/cases`, `/api/documents`, `/api/settlements`, and `/api/shipments` return typed operational records. `POST /api/ledger/journals/validate` validates a journal without posting. `POST /api/ledger/journals` posts a validated journal through a transaction-backed, idempotent ledger service; a retry returns the original durable journal. All external inputs are schema-validated and state-changing operations are auditable in MySQL.

## Security boundary

Every route except `GET /api/health` requires a verified Clerk session (`Authorization: Bearer <session token>`, verified server-side by `@clerk/express`). Identity comes only from that session; `x-csce-*` headers are ignored. Roles are not read from Clerk: they live in this application's `organization_memberships` table, and a signed-in user with no membership in `org_demo` receives `403 NOT_PROVISIONED`. The server enforces role gates and maker-checker separation (the user who placed a hold cannot release it; the user who posted a journal cannot reverse it). The client hides actions a role cannot perform, but that is presentation only.

### Clerk setup

1. Create a Clerk application and copy its keys into `.env` (see `.env.example`): `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Do not commit `.env`, and never pass `CLERK_SECRET_KEY` as a Docker build arg or give it a `VITE_` or `CLERK_PUBLISHABLE_` prefix; `vite.config.ts` refuses any env prefix that would expose `CLERK_SECRET*`.
2. In the Clerk dashboard, set sign-up mode to **Restricted** so only invited users can create accounts. The sign-in screen hides the sign-up link, but the dashboard setting is the actual control.
3. Invite each user from the Clerk dashboard and have them accept the invite and sign in once, so they exist in Clerk with a verified email.
4. Grant the user an application role:

   ```
   pnpm users:grant --email <email> --role <operations|compliance|treasury|checker|auditor|admin>
   ```

   The script reads `.env` (variables already exported in the shell take precedence), refuses to run without `DATABASE_URL` and `CLERK_SECRET_KEY`, looks the user up through the Clerk backend API by exact verified email, applies migrations, ensures the `org_demo` organization row exists, and upserts the `users` and `organization_memberships` rows. Re-running it with a different role changes the role. It prints only the Clerk user ID, email and role. Note that, like server startup, it also runs the idempotent synthetic fixture seed.

### NODE_ENV

Do not set `NODE_ENV` in `.env`. Vite reads `.env` during `pnpm build`, and a `NODE_ENV` value there (for example `development`) can override the build mode and produce a development client bundle. The runtime container sets `NODE_ENV=production` itself in the Dockerfile.

## Local MySQL (development only)

`docker-compose.yml` runs a single MySQL 8.4 service for local development. It is not a production deployment. The port is bound to `127.0.0.1:3306` only, and data persists in the named volume `cbcsce-mysql-data`.

1. Copy `.env.mysql.example` to `.env.mysql` (gitignored) and set `MYSQL_ROOT_PASSWORD` and `MYSQL_PASSWORD`. Leave `MYSQL_DATABASE=cbcsce` and `MYSQL_USER=cbcsce` unless you have a reason to change them.
2. Start it with `docker compose up -d mysql` and wait for `docker compose ps` to report it healthy.
3. Set `DATABASE_URL` in `.env` using exactly this format, with the values from `.env.mysql`:

   ```
   DATABASE_URL=mysql://<MYSQL_USER>:<MYSQL_PASSWORD>@127.0.0.1:3306/<MYSQL_DATABASE>
   ```

   For the defaults that is `mysql://cbcsce:<MYSQL_PASSWORD>@127.0.0.1:3306/cbcsce`. Use `127.0.0.1`, not `localhost`, so the client connects over TCP. If the password contains URL-reserved characters (`@ : / ? # [ ] %`), percent-encode them, for example `@` as `%40`.
4. Run `pnpm users:grant` as above; it applies the migrations itself. (`pnpm db:migrate` and `pnpm dev` do not read `.env`, so export `DATABASE_URL` in the shell for those.)

`docker compose down` stops the container and keeps the data; `docker compose down -v` also deletes the volume.
