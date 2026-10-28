import assert from "node:assert/strict";
import test from "node:test";
import { mutationTokenIsValid } from "../server/api.js";

test("demo mutations are denied when the server-side token is absent", () => {
  const previous = process.env.CSCE_DEMO_MUTATION_TOKEN;
  delete process.env.CSCE_DEMO_MUTATION_TOKEN;
  assert.equal(mutationTokenIsValid({ get: () => "anything" } as never), false);
  if (previous === undefined) delete process.env.CSCE_DEMO_MUTATION_TOKEN;
  else process.env.CSCE_DEMO_MUTATION_TOKEN = previous;
});

test("demo mutation token must match exactly", () => {
  const previous = process.env.CSCE_DEMO_MUTATION_TOKEN;
  process.env.CSCE_DEMO_MUTATION_TOKEN = "test-only-demo-token";
  assert.equal(mutationTokenIsValid({ get: (name: string) => name === "x-csce-demo-token" ? "wrong" : undefined } as never), false);
  assert.equal(mutationTokenIsValid({ get: (name: string) => name === "x-csce-demo-token" ? "test-only-demo-token" : undefined } as never), true);
  if (previous === undefined) delete process.env.CSCE_DEMO_MUTATION_TOKEN;
  else process.env.CSCE_DEMO_MUTATION_TOKEN = previous;
});
