import http from "node:http";
import express from "express";
import { createApi } from "../../server/api.js";
import { OperationsRepository, type Actor, type Role } from "../../server/repository.js";

export type TestMember = { token: string; clerkUserId: string; role: Role; organizationId?: string };
export type TestContext = {
  baseUrl: string;
  repository: OperationsRepository;
  members: Record<string, Actor>;
  call: (path: string, init?: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> }) => Promise<Response>;
};

export const defaultMembers: TestMember[] = [
  { token: "test-operations-1", clerkUserId: "user_test_operations_1", role: "operations" },
  { token: "test-compliance-1", clerkUserId: "user_test_compliance_1", role: "compliance" },
  { token: "test-compliance-2", clerkUserId: "user_test_compliance_2", role: "compliance" },
  { token: "test-treasury-1", clerkUserId: "user_test_treasury_1", role: "treasury" },
  { token: "test-treasury-2", clerkUserId: "user_test_treasury_2", role: "treasury" },
  { token: "test-checker-1", clerkUserId: "user_test_checker_1", role: "checker" },
  { token: "test-auditor-1", clerkUserId: "user_test_auditor_1", role: "auditor" },
  { token: "test-admin-1", clerkUserId: "user_test_admin_1", role: "admin" },
  { token: "test-outsider-1", clerkUserId: "user_test_outsider_1", role: "admin", organizationId: "org_other" }
];

// Signed in with Clerk, but no users row was ever provisioned.
export const unprovisionedToken = { token: "test-unprovisioned-1", clerkUserId: "user_test_unprovisioned_1" };

/**
 * Starts the API with an in-memory repository and a fake session resolver that maps
 * test-only bearer strings to Clerk user ids. Clerk itself is never loaded or called.
 */
export async function withServer<T>(run: (context: TestContext) => Promise<T>, memberList: TestMember[] = defaultMembers): Promise<T> {
  const repository = new OperationsRepository();
  const sessions = new Map<string, string>([[unprovisionedToken.token, unprovisionedToken.clerkUserId]]);
  const members: Record<string, Actor> = {};
  for (const member of memberList) {
    sessions.set(member.token, member.clerkUserId);
    members[member.token] = await repository.upsertUserWithMembership({ clerkUserId: member.clerkUserId, email: `${member.clerkUserId}@example.test` }, member.organizationId ?? "org_demo", member.role);
  }

  const app = express();
  app.use(express.json());
  app.use("/api", createApi(repository, {
    resolveSession: (request) => {
      const match = /^Bearer (.+)$/.exec(request.get("authorization") ?? "");
      return match ? sessions.get(match[1]) ?? null : null;
    }
  }));
  app.use("/api", (_req, res) => res.status(404).json({ error: "API_ROUTE_NOT_FOUND" }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server failed to bind");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const call: TestContext["call"] = (path, init = {}) => fetch(`${baseUrl}/api${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    redirect: "manual",
    headers: {
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init.headers ?? {})
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });

  try {
    return await run({ baseUrl, repository, members, call });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

export function journalBody(reference: string) {
  return {
    organizationId: "org_demo",
    businessReference: reference,
    transactionType: "COMMODITY_PURCHASE",
    effectiveAt: "2026-11-01T00:00:00.000Z",
    idempotencyKey: `idem-${reference.toLowerCase()}`,
    lines: [
      { accountId: "1200", currencyCode: "USD", debitAmount: "2500", creditAmount: "0" },
      { accountId: "2010", currencyCode: "USD", debitAmount: "0", creditAmount: "2500" }
    ]
  };
}
