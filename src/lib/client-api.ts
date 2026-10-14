// Liten fetch-hjelper for nettleseren. Gir alltid { ok, data } eller { ok: false, error, message }.

import { REQUEST_TIMEOUT_MS } from "./config";
import type { ErrorCode } from "./texts";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ErrorCode | "network"; message: string; status: number };

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<ApiResult<T>> {
  const { json, ...rest } = init ?? {};
  // Tidsgrense: en forbindelse som henger (f.eks. ved bytte mellom Wi-Fi og mobilnett) skal aldri fryse siden.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: rest.cache ?? "no-store",
      credentials: "same-origin",
    });
    const body: unknown = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: body as T };
    const err = body as { error?: ErrorCode; message?: string };
    return { ok: false, error: err.error ?? "server_error", message: err.message ?? "Noe gikk galt.", status: res.status };
  } catch {
    return { ok: false, error: "network", message: "Ingen kontakt med serveren. Sjekk nettet.", status: 0 };
  } finally {
    clearTimeout(timer);
  }
}
