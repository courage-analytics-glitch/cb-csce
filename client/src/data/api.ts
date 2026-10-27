export type ApiEnvelope<T> = T & { provenance?: "DEMO_SYNTHETIC" | "MANAGED_DATABASE" | "UNVERIFIED"; mode?: string };

export async function api<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  return payload as ApiEnvelope<T>;
}
