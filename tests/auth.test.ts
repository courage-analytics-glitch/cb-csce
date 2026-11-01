import assert from "node:assert/strict";
import test from "node:test";
import { clerkFrontendApiHost, contentSecurityPolicy } from "../server/auth.js";
import type { Role } from "../server/repository.js";
import { journalBody, unprovisionedToken, withServer } from "./helpers/server.js";

const allRoles: Role[] = ["operations", "compliance", "treasury", "checker", "auditor", "admin"];
const tokenFor: Record<Role, string> = {
  operations: "test-operations-1",
  compliance: "test-compliance-1",
  treasury: "test-treasury-1",
  checker: "test-checker-1",
  auditor: "test-auditor-1",
  admin: "test-admin-1"
};
const forgedHeaders = { "x-csce-actor": "admin.root", "x-csce-role": "treasury", "x-csce-organization": "org_other" };

// Expected route-to-role table, written independently of server/api.ts on purpose.
const writeRoutes: Array<{ name: string; path: string; body: unknown; allowed: Role[] }> = [
  { name: "place hold", path: "/trades/trade_1001/hold", body: { reason: "Role matrix verification hold" }, allowed: ["operations", "compliance"] },
  { name: "release hold", path: "/trades/trade_1003/release", body: {}, allowed: ["compliance", "checker"] },
  { name: "validate journal", path: "/ledger/journals/validate", body: journalBody("ROLE-VALIDATE-001"), allowed: ["treasury", "checker"] },
  { name: "post journal", path: "/ledger/journals", body: journalBody("ROLE-POST-001"), allowed: ["treasury"] },
  { name: "reverse journal", path: "/ledger/journals/jrnl_1/reverse", body: { idempotencyKey: "idem-reversal-role-matrix-001" }, allowed: ["treasury", "checker"] }
];

test("anonymous request to a protected route returns 401 JSON without a redirect", async () => {
  await withServer(async ({ call }) => {
    const response = await call("/trades");
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("location"), null);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await response.json(), { error: "UNAUTHENTICATED" });
  });
});

test("anonymous write request returns 401 before body validation", async () => {
  await withServer(async ({ call }) => {
    const response = await call("/trades/trade_1001/hold", { body: { reason: "short" } });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "UNAUTHENTICATED" });
  });
});

test("health endpoint stays public", async () => {
  await withServer(async ({ call }) => {
    const response = await call("/health");
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { ok: boolean }).ok, true);
  });
});

test("forged x-csce-* headers without a session still return 401", async () => {
  await withServer(async ({ call }) => {
    assert.equal((await call("/trades", { headers: forgedHeaders })).status, 401);
    assert.equal((await call("/trades/trade_1001/hold", { headers: forgedHeaders, body: { reason: "Forged header hold attempt" } })).status, 401);
    assert.equal((await call("/trades", { headers: { ...forgedHeaders, Authorization: "Bearer not-a-session" } })).status, 401);
  });
});

test("forged x-csce-actor, x-csce-role and x-csce-organization headers are ignored for an authenticated user", async () => {
  await withServer(async ({ call, members }) => {
    const operator = members["test-operations-1"];

    const me = await call("/me", { token: "test-operations-1", headers: forgedHeaders });
    assert.deepEqual((await me.json() as { item: unknown }).item, { id: operator.id, role: "operations", organizationId: "org_demo" });

    const post = await call("/ledger/journals", { token: "test-operations-1", headers: forgedHeaders, body: journalBody("FORGED-001") });
    assert.equal(post.status, 403);
    assert.deepEqual(await post.json(), { error: "INSUFFICIENT_ROLE" });

    const hold = await call("/trades/trade_1001/hold", { token: "test-operations-1", headers: forgedHeaders, body: { reason: "Forged header hold attempt" } });
    assert.equal(hold.status, 200);
    const held = await hold.json() as { audit: { actor: unknown } };
    assert.deepEqual(held.audit.actor, { id: operator.id, role: "operations", organizationId: "org_demo" });

    const audit = await (await call("/audit", { token: "test-operations-1" })).json() as { items: Array<{ action: string; actor: string }> };
    assert.equal(audit.items[0]?.action, "TRADE_HOLD_APPLIED");
    assert.equal(audit.items[0]?.actor, `${operator.id} · operations`);
  });
});

test("authenticated Clerk user with no users row gets 403 NOT_PROVISIONED", async () => {
  await withServer(async ({ call }) => {
    const response = await call("/trades", { token: unprovisionedToken.token });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "NOT_PROVISIONED" });
  });
});

test("user without an org_demo membership gets 403 NOT_PROVISIONED", async () => {
  await withServer(async ({ call }) => {
    const response = await call("/trades", { token: "test-outsider-1" });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "NOT_PROVISIONED" });
  });
});

test("wrong role gets 403 on every write route", async () => {
  await withServer(async ({ call }) => {
    for (const route of writeRoutes) {
      for (const role of allRoles.filter((candidate) => !route.allowed.includes(candidate))) {
        const response = await call(route.path, { token: tokenFor[role], body: route.body });
        assert.equal(response.status, 403, `${role} on ${route.name}`);
        assert.deepEqual(await response.json(), { error: "INSUFFICIENT_ROLE" }, `${role} on ${route.name}`);
      }
    }
  });
});

test("allowed role passes the role gate on every write route", async () => {
  await withServer(async ({ call }) => {
    for (const route of writeRoutes) {
      for (const role of route.allowed) {
        const response = await call(route.path, { token: tokenFor[role], body: route.body });
        assert.ok(![401, 403].includes(response.status), `${role} on ${route.name} returned ${response.status}`);
      }
    }
  });
});

test("auditor cannot perform any write", async () => {
  await withServer(async ({ call }) => {
    for (const route of writeRoutes) assert.equal((await call(route.path, { token: "test-auditor-1", body: route.body })).status, 403, route.name);
    assert.equal((await call("/audit", { token: "test-auditor-1" })).status, 200);
  });
});

test("journal created_by and audit actor are the authenticated user", async () => {
  await withServer(async ({ call, members }) => {
    const treasurer = members["test-treasury-1"];
    const post = await call("/ledger/journals", { token: "test-treasury-1", body: journalBody("MAKER-RECORD-001") });
    assert.equal(post.status, 201);
    const posted = await post.json() as { item: { journalId: string; createdBy: string } };
    assert.equal(posted.item.createdBy, treasurer.id);

    const journals = await (await call("/ledger/journals", { token: "test-auditor-1" })).json() as { items: Array<{ journalId: string; createdBy: string }> };
    assert.equal(journals.items.find((journal) => journal.journalId === posted.item.journalId)?.createdBy, treasurer.id);

    const audit = await (await call("/audit", { token: "test-auditor-1" })).json() as { items: Array<{ action: string; actor: string }> };
    assert.equal(audit.items[0]?.action, "JOURNAL_POSTED");
    assert.equal(audit.items[0]?.actor, `${treasurer.id} · treasury`);
  });
});

test("maker cannot reverse their own journal", async () => {
  await withServer(async ({ call }) => {
    const posted = await (await call("/ledger/journals", { token: "test-treasury-1", body: journalBody("MAKER-REVERSE-001") })).json() as { item: { journalId: string } };
    const response = await call(`/ledger/journals/${posted.item.journalId}/reverse`, { token: "test-treasury-1", body: { idempotencyKey: "idem-reversal-by-maker-001" } });
    assert.equal(response.status, 403);
    assert.equal((await response.json() as { error: string }).error, "MAKER_CHECKER_VIOLATION");
  });
});

test("a different treasury user can reverse the journal", async () => {
  await withServer(async ({ call, members }) => {
    const posted = await (await call("/ledger/journals", { token: "test-treasury-1", body: journalBody("CHECKER-REVERSE-001") })).json() as { item: { journalId: string } };
    const response = await call(`/ledger/journals/${posted.item.journalId}/reverse`, { token: "test-treasury-2", body: { idempotencyKey: "idem-reversal-by-checker-001" } });
    assert.equal(response.status, 201);
    const reversal = await response.json() as { item: { createdBy: string; transactionType: string } };
    assert.equal(reversal.item.createdBy, members["test-treasury-2"].id);
    assert.equal(reversal.item.transactionType, "REVERSAL");
  });
});

test("maker cannot release their own trade hold", async () => {
  await withServer(async ({ call }) => {
    assert.equal((await call("/trades/trade_1001/hold", { token: "test-compliance-1", body: { reason: "Maker-checker release test hold" } })).status, 200);
    const response = await call("/trades/trade_1001/release", { token: "test-compliance-1", body: {} });
    assert.equal(response.status, 403);
    assert.equal((await response.json() as { error: string }).error, "MAKER_CHECKER_VIOLATION");
  });
});

test("a different compliance user can release the hold and the previous status is restored", async () => {
  await withServer(async ({ call }) => {
    type TradeView = { status: string; readiness: number; blockers: string[] };
    const before = (await (await call("/trades/trade_1001", { token: "test-auditor-1" })).json() as { item: TradeView }).item;
    const reason = "Second-user release verification hold";
    const held = (await (await call("/trades/trade_1001/hold", { token: "test-compliance-1", body: { reason } })).json() as { item: TradeView }).item;
    assert.equal(held.status, "ON_HOLD");
    assert.ok(held.blockers.includes(reason));

    const response = await call("/trades/trade_1001/release", { token: "test-compliance-2", body: {} });
    assert.equal(response.status, 200);
    const released = (await response.json() as { item: TradeView }).item;
    assert.equal(released.status, before.status);
    assert.equal(released.readiness, before.readiness);
    assert.deepEqual(released.blockers, before.blockers);
  });
});

test("a legacy hold with no recorded maker can be released by a permitted user", async () => {
  await withServer(async ({ call }) => {
    const response = await call("/trades/trade_1003/release", { token: "test-checker-1", body: {} });
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { item: { status: string } }).item.status, "HOLD_RELEASED");
  });
});

test("placing a hold on a trade already on hold returns 409", async () => {
  await withServer(async ({ call }) => {
    const response = await call("/trades/trade_1003/hold", { token: "test-operations-1", body: { reason: "Duplicate hold should be refused" } });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "TRADE_ALREADY_ON_HOLD" });
  });
});

test("releasing a trade that is not on hold returns 409", async () => {
  await withServer(async ({ call }) => {
    const response = await call("/trades/trade_1001/release", { token: "test-checker-1", body: {} });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "TRADE_NOT_ON_HOLD" });
  });
});

// Made-up host for the test; this is not a real Clerk key.
const fakeHost = "example-app.clerk.accounts.dev";
const fakePublishableKey = `pk_test_${Buffer.from(`${fakeHost}$`).toString("base64")}`;

test("Clerk Frontend API host is derived from the publishable key", () => {
  assert.equal(clerkFrontendApiHost(fakePublishableKey), fakeHost);
});

test("invalid publishable key error does not echo the key", () => {
  const invalid = "pk_test_bm90LWEtaG9zdA";
  assert.throws(() => clerkFrontendApiHost(invalid), (error: Error) => error.message.includes("CLERK_PUBLISHABLE_KEY") && !error.message.includes(invalid));
});

test("content security policy lists each Clerk source under its directive", () => {
  assert.equal(
    contentSecurityPolicy(fakeHost),
    `default-src 'self'; script-src 'self' 'unsafe-inline' https://${fakeHost} https://challenges.cloudflare.com; connect-src 'self' https://${fakeHost}; frame-src 'self' https://challenges.cloudflare.com; img-src 'self' data: https://img.clerk.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:`
  );
});
