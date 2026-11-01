import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { isRole, ORGANIZATION_ID, OperationsRepository, roles, type MemberProfile, type Role } from "./repository.js";

/**
 * pnpm users:grant --email <email> --role <role>
 *
 * Looks the user up in Clerk, then (re)provisions their org_demo membership.
 * Output is limited to the Clerk user ID, email and role; no CLERK_ value or
 * DATABASE_URL is ever printed, including inside error messages.
 */

export class GrantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrantError";
  }
}

export type GrantRequest = { email: string; role: Role };
export type ClerkUserLookup = (email: string) => Promise<MemberProfile>;
export type MembershipStore = Pick<OperationsRepository, "upsertUserWithMembership">;

export function parseGrantArgs(argv: string[]): GrantRequest {
  let values: { email?: string; role?: string };
  try {
    ({ values } = parseArgs({ args: argv, options: { email: { type: "string" }, role: { type: "string" } }, strict: true, allowPositionals: false }));
  } catch (error) {
    throw new GrantError(`${error instanceof Error ? error.message : "Invalid arguments"}. Usage: pnpm users:grant --email <email> --role <role>`);
  }
  const email = values.email?.trim().toLowerCase() ?? "";
  const role = values.role?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GrantError("--email must be a single email address. Usage: pnpm users:grant --email <email> --role <role>");
  if (!isRole(role)) throw new GrantError(`--role must be one of: ${roles.join(", ")}.`);
  return { email, role };
}

/** Exact, verified email match only; refuses ambiguous or unverified results. */
export const clerkUserLookup: ClerkUserLookup = async (email) => {
  const { clerkClient } = await import("@clerk/express");
  const { data } = await clerkClient.users.getUserList({ emailAddress: [email], limit: 2 });
  const matches = data.filter((user) => user.emailAddresses.some((address) => address.emailAddress.toLowerCase() === email && address.verification?.status === "verified"));
  if (matches.length === 0) throw new GrantError("No Clerk user has this email as a verified address. Invite the user and have them sign in once first.");
  if (matches.length > 1) throw new GrantError("More than one Clerk user matches this email; resolve the duplicate in the Clerk dashboard first.");
  const user = matches[0];
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
  return { clerkUserId: user.id, email, displayName };
};

export async function grantMembership(request: GrantRequest, deps: { lookup: ClerkUserLookup; store: MembershipStore }) {
  const profile = await deps.lookup(request.email);
  const actor = await deps.store.upsertUserWithMembership(profile, ORGANIZATION_ID, request.role);
  return { clerkUserId: actor.clerkUserId, email: profile.email, role: actor.role };
}

/** Removes every CLERK_* value and DATABASE_URL (and anything shaped like a Clerk secret) from text. */
export function redactSecrets(text: string, env: NodeJS.ProcessEnv = process.env): string {
  let result = text;
  for (const [name, value] of Object.entries(env)) {
    if (!value || value.length < 6 || !(name.startsWith("CLERK_") || name === "DATABASE_URL")) continue;
    result = result.split(value).join(`[${name}]`);
  }
  return result.replace(/sk_(test|live)_[A-Za-z0-9]+/g, "[redacted]");
}

function requireEnv(name: string): void {
  // Names the variable only.
  if (!process.env[name]?.trim()) throw new GrantError(`${name} is not configured; refusing to run.`);
}

async function main(): Promise<void> {
  const request = parseGrantArgs(process.argv.slice(2));
  requireEnv("DATABASE_URL");
  requireEnv("CLERK_SECRET_KEY");
  const repository = new OperationsRepository();
  try {
    // Runs migrations and ensures the org_demo row, exactly as server startup does.
    await repository.initialize();
    if (repository.mode !== "MANAGED_DATABASE") throw new GrantError("Database did not initialise; refusing to write a membership.");
    const result = await grantMembership(request, { lookup: clerkUserLookup, store: repository });
    console.log(`clerk_user_id=${result.clerkUserId}`);
    console.log(`email=${result.email}`);
    console.log(`role=${result.role}`);
  } finally {
    await repository.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const raw = error instanceof GrantError ? error.message : error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
    console.error(`users:grant failed: ${redactSecrets(raw)}`);
    process.exit(1);
  });
}
