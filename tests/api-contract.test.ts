import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import test from "node:test";
import { createApi } from "../server/api.js";
import { OperationsRepository } from "../server/repository.js";

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

async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use("/api", createApi(new OperationsRepository()));
  app.use("/api", (_req, res) => res.status(404).json({ error: "API_ROUTE_NOT_FOUND" }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server failed to bind");
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("every declared operational read endpoint returns a JSON items envelope", async () => {
  await withServer(async (baseUrl) => {
    for (const route of readRoutes) {
      const response = await fetch(`${baseUrl}/api${route}`);
      assert.equal(response.status, 200, route);
      const payload = await response.json() as { items?: unknown[]; provenance?: string };
      assert.ok(Array.isArray(payload.items), `${route} must expose items`);
      assert.equal(payload.provenance, "DEMO_SYNTHETIC", route);
      assert.ok(payload.items.length > 0, `${route} must expose synthetic records`);
    }
  });
});

test("unknown API routes return JSON 404 instead of SPA HTML", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/not-a-real-route`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "API_ROUTE_NOT_FOUND" });
  });
});
