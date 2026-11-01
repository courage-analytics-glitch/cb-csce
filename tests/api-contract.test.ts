import assert from "node:assert/strict";
import test from "node:test";
import { withServer } from "./helpers/server.js";

const readRoutes = [
  "/commodities",
  "/ledger/accounts",
  "/treasury/exposures",
  "/compliance/counterparties",
  "/workflows",
  "/analytics/liquidity-risk",
  "/analytics/demurrage",
  "/reconciliation",
  "/reports"
];

test("every declared operational read endpoint returns a JSON items envelope", async () => {
  await withServer(async ({ call }) => {
    for (const route of readRoutes) {
      const response = await call(route, { token: "test-auditor-1" });
      assert.equal(response.status, 200, route);
      const payload = await response.json() as { items?: unknown[]; provenance?: string };
      assert.ok(Array.isArray(payload.items), `${route} must expose items`);
      assert.equal(payload.provenance, "DEMO_SYNTHETIC", route);
      assert.ok(payload.items.length > 0, `${route} must expose synthetic records`);
    }
  });
});

test("unknown API routes return JSON 404 instead of SPA HTML", async () => {
  await withServer(async ({ call }) => {
    const response = await call("/not-a-real-route", { token: "test-auditor-1" });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "API_ROUTE_NOT_FOUND" });
  });
});

test("unknown API routes return 401 when anonymous", async () => {
  await withServer(async ({ call }) => {
    const response = await call("/not-a-real-route");
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "UNAUTHENTICATED" });
  });
});
