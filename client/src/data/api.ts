export type ApiEnvelope<T> = T & { provenance?: "DEMO_SYNTHETIC" | "MANAGED_DATABASE" | "UNVERIFIED"; mode?: string };

/** Resolves the current Clerk session token, or null when there is no active session. */
export type TokenProvider = () => Promise<string | null>;

let tokenProvider: TokenProvider | null = null;

/** Registered by ApiAuthBridge; pass null on sign-out/unmount so stale sessions cannot be used. */
export function setTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("UNAUTHENTICATED");
    this.name = "UnauthenticatedError";
  }
}

/** A non-2xx API response. `message` stays the server's error code so existing displays are unchanged. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Human-readable explanation from the server's `message` field, when it sends one. */
  readonly detail?: string;

  constructor(status: number, code: string, detail?: string) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  // Fail closed: never send a request without a bearer token.
  const token = tokenProvider ? await tokenProvider() : null;
  if (!token) throw new UnauthenticatedError();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`/api${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, typeof payload.error === "string" ? payload.error : `Request failed with status ${response.status}`, typeof payload.message === "string" ? payload.message : undefined);
  return payload as ApiEnvelope<T>;
}
