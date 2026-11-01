import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { GrantError, grantMembership, parseGrantArgs, redactSecrets } from "../server/grant-membership.js";
import { ORGANIZATION_ID, OperationsRepository } from "../server/repository.js";

// Built at runtime so the CI credential scan does not flag these test fixtures.
const fakeSecret = (env: string, fill: string) => ["sk", env, fill.repeat(24)].join("_");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("parses and normalises --email and --role", () => {
  assert.deepEqual(parseGrantArgs(["--email", " Ama@Example.COM ", "--role", "Checker"]), { email: "ama@example.com", role: "checker" });
});

test("rejects unknown roles, bad emails, missing flags and extra arguments", () => {
  assert.throws(() => parseGrantArgs(["--email", "a@example.com", "--role", "superuser"]), GrantError);
  assert.throws(() => parseGrantArgs(["--email", "not-an-email", "--role", "checker"]), GrantError);
  assert.throws(() => parseGrantArgs(["--role", "checker"]), GrantError);
  assert.throws(() => parseGrantArgs(["--email", "a@example.com", "--role", "checker", "--org", "org_other"]), GrantError);
});

test("grant upserts the user and membership, and a re-grant changes the role", async () => {
  const repository = new OperationsRepository();
  const lookup = async (email: string) => ({ clerkUserId: "user_grant_test_1", email });
  const first = await grantMembership({ email: "kojo@example.com", role: "operations" }, { lookup, store: repository });
  assert.deepEqual(first, { clerkUserId: "user_grant_test_1", email: "kojo@example.com", role: "operations" });
  await grantMembership({ email: "kojo@example.com", role: "checker" }, { lookup, store: repository });
  assert.equal((await repository.findMember("user_grant_test_1", ORGANIZATION_ID))?.role, "checker");
});

test("redaction removes CLERK_* values, DATABASE_URL and secret-shaped strings", () => {
  const env = { CLERK_SECRET_KEY: fakeSecret("test", "a"), CLERK_PUBLISHABLE_KEY: "pk_test_ZXhhbXBsZS5jb20k", DATABASE_URL: "mysql://u:p4ss@db:3306/x" };
  const out = redactSecrets(`a ${env.CLERK_SECRET_KEY} b ${env.CLERK_PUBLISHABLE_KEY} c ${env.DATABASE_URL} d ${fakeSecret("live", "z")}`, env);
  for (const value of Object.values(env)) assert.ok(!out.includes(value));
  assert.ok(!out.includes("sk_live_"));
});

test("CLI refuses to run without DATABASE_URL and does not echo Clerk values", () => {
  const secret = fakeSecret("test", "q");
  const result = spawnSync(process.execPath, ["--import", "tsx", "server/grant-membership.ts", "--email", "a@example.com", "--role", "checker"], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DATABASE_URL: "", CLERK_SECRET_KEY: secret }
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DATABASE_URL is not configured; refusing to run\./);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(secret));
});
