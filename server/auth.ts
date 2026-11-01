import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { ORGANIZATION_ID, type Actor, type OperationsRepository, type Role } from "./repository.js";

declare global {
  namespace Express {
    interface Request {
      clerkUserId?: string;
      actor?: Actor;
    }
  }
}

/** Returns the verified Clerk user id for the request, or null when there is no signed-in session. */
export type SessionResolver = (request: Request) => string | null;

// getAuth only reads the session that clerkMiddleware already verified; pending
// sessions (no active Clerk organization yet) are treated as signed out by default.
export const clerkSessionResolver: SessionResolver = (request) => getAuth(request).userId ?? null;

export function requireAuth(resolveSession: SessionResolver) {
  return (request: Request, response: Response, next: NextFunction) => {
    const clerkUserId = resolveSession(request);
    if (!clerkUserId) return response.status(401).json({ error: "UNAUTHENTICATED" });
    request.clerkUserId = clerkUserId;
    return next();
  };
}

export function resolveActor(repository: OperationsRepository) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const actor = request.clerkUserId ? await repository.findMember(request.clerkUserId, ORGANIZATION_ID) : undefined;
    if (!actor) return response.status(403).json({ error: "NOT_PROVISIONED" });
    request.actor = actor;
    return next();
  };
}

export function requireRole(...allowed: Role[]) {
  // Generic over route params so Express still infers `:tradeId`-style params for the handler that follows.
  return <P>(request: Request<P>, response: Response, next: NextFunction) => {
    // Fail closed if the router is ever wired without resolveActor in front of this gate.
    if (!request.actor) return response.status(401).json({ error: "UNAUTHENTICATED" });
    if (!allowed.includes(request.actor.role)) return response.status(403).json({ error: "INSUFFICIENT_ROLE" });
    return next();
  };
}

export function actorOf<P>(request: Request<P>): Actor {
  if (!request.actor) throw new Error("Route reached without a resolved actor.");
  return request.actor;
}

/**
 * Clerk publishable keys are `pk_(test|live)_` followed by base64("<frontend api host>$").
 * Errors name the variable but never include its value.
 */
export function clerkFrontendApiHost(publishableKey: string): string {
  const match = /^pk_(test|live)_([A-Za-z0-9+/=_-]+)$/.exec(publishableKey);
  const decoded = match ? Buffer.from(match[2], "base64").toString("utf8") : "";
  const host = decoded.endsWith("$") ? decoded.slice(0, -1) : "";
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) throw new Error("CLERK_PUBLISHABLE_KEY is not a valid Clerk publishable key.");
  return host;
}

export function contentSecurityPolicy(clerkHost: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://${clerkHost} https://challenges.cloudflare.com`,
    `connect-src 'self' https://${clerkHost}`,
    "frame-src 'self' https://challenges.cloudflare.com",
    "img-src 'self' data: https://img.clerk.com",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:"
  ].join("; ");
}
