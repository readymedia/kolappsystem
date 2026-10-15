import { StationNotFoundError } from "./stations";
import "server-only";
import { NextResponse } from "next/server";
import { requireAndRenewSession } from "./auth";
import { DatabaseNotConfiguredError } from "./db";
import { normalizeIp } from "./net";
import { ERROR_TEXT, type ErrorCode } from "./texts";

// Felles hjelpere for API-rutene: like svar, feilhåndtering, Origin-sjekk og innloggingskrav.

const STATUS: Partial<Record<ErrorCode, number>> = {
  bad_request: 400,
  file_too_large: 413,
  unsupported_file: 415,
  unsafe_svg: 415,
  invalid_station: 400,
  invalid_link: 403,
  closed: 409,
  wrong_pin: 401,
  unauthorized: 401,
  forbidden_origin: 403,
  display_link_expired: 403,
  push_disabled: 409,
  leave_disabled: 409,
  too_late: 409,
  station_limit: 409,
  station_not_empty: 409,
  no_free_station: 409,
  not_found: 404,
  locked: 429,
  rate_limited: 429,
  too_many_waiting: 429,
  busy: 503,
  db_missing: 503,
  server_error: 500,
};

const NO_STORE = { "Cache-Control": "no-store" };

export function ok<T>(data: T, headers: HeadersInit = NO_STORE): NextResponse {
  return NextResponse.json(data, { headers });
}

export function fail(code: ErrorCode): NextResponse {
  return NextResponse.json({ error: code, message: ERROR_TEXT[code] }, { status: STATUS[code] ?? 400, headers: NO_STORE });
}

/**
 * Klientens nettverk bak Vercel sin proxy, brukt til forsøksgrenser.
 * IPv6 grupperes på /64 (én husstand/telefon har gjerne et helt /64-nett), så nye adresser ikke omgår grensen.
 */
export function clientIp(req: Request): string {
  const raw =
    req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return normalizeIp(raw);
}

/**
 * Adressen QR-koder skal peke på – alltid produksjonsadressen, også om admin åpnes fra en forhåndsvisning.
 * Rekkefølge: PUBLIC_BASE_URL > Vercel sitt produksjonsdomene > adressen forespørselen kom til.
 */
export function publicOrigin(req: Request): string {
  return (
    process.env.PUBLIC_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
    (req.headers.get("x-forwarded-host")
      ? `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host")}`
      : new URL(req.url).origin)
  ).replace(/\/$/, "");
}

/** Endrings-kall må komme fra samme opprinnelse (beskytter mot CSRF i tillegg til SameSite). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

type Handler = () => Promise<NextResponse>;

/** Feil som tyder på en død eller avbrutt databasetilkobling – trygt å prøve én gang til for lesing. */
function isConnectionError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? "";
  return [
    "CONNECTION_CLOSED",
    "CONNECTION_ENDED",
    "CONNECTION_DESTROYED",
    "CONNECT_TIMEOUT",
    "ECONNRESET",
    "ETIMEDOUT",
    "EPIPE",
    "57P01", // admin_shutdown (f.eks. Neon som skalerer ned)
  ].includes(code);
}

/** Lås- eller spørringstidsgrense nådd (se begin() i queue.ts). */
function isTimeoutError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? "";
  return code === "55P03" || code === "57014";
}

/** Pakker inn en rute: Origin-sjekk for endringer, valgfritt innloggingskrav og trygg feilhåndtering. */
export async function handle(
  req: Request,
  opts: { mutation?: boolean; requireSession?: boolean },
  fn: Handler,
): Promise<NextResponse> {
  try {
    if (opts.mutation && !sameOrigin(req)) return fail("forbidden_origin");
    if (opts.requireSession && !(await requireAndRenewSession())) return fail("unauthorized");
    try {
      return await fn();
    } catch (err) {
      // Lesing kan trygt prøves én gang til hvis tilkoblingen var død (f.eks. etter at Neon har sovet).
      if (req.method === "GET" && isConnectionError(err)) return await fn();
      throw err;
    }
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) return fail("db_missing");
    if (err instanceof StationNotFoundError) return fail("invalid_station");
    if (isTimeoutError(err) || isConnectionError(err)) {
      console.warn("[api] travelt/tilkobling", req.method, new URL(req.url).pathname, (err as { code?: string }).code);
      return fail("busy");
    }
    console.error("[api]", req.method, new URL(req.url).pathname, err);
    return fail("server_error");
  }
}
