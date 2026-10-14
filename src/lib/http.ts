import "server-only";
import { NextResponse } from "next/server";
import { hasValidSession } from "./auth";
import { DatabaseNotConfiguredError } from "./db";
import { ERROR_TEXT, type ErrorCode } from "./texts";

// Felles hjelpere for API-rutene: like svar, feilhåndtering, Origin-sjekk og innloggingskrav.

const STATUS: Partial<Record<ErrorCode, number>> = {
  bad_request: 400,
  invalid_station: 400,
  invalid_link: 403,
  closed: 409,
  wrong_pin: 401,
  unauthorized: 401,
  forbidden_origin: 403,
  not_found: 404,
  locked: 429,
  rate_limited: 429,
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

/** IP-adressen til klienten bak Vercel sin proxy. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
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

/** Pakker inn en rute: Origin-sjekk for endringer, valgfritt innloggingskrav og trygg feilhåndtering. */
export async function handle(
  req: Request,
  opts: { mutation?: boolean; requireSession?: boolean },
  fn: Handler,
): Promise<NextResponse> {
  try {
    if (opts.mutation && !sameOrigin(req)) return fail("forbidden_origin");
    if (opts.requireSession && !(await hasValidSession())) return fail("unauthorized");
    return await fn();
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) return fail("db_missing");
    console.error("[api]", req.method, new URL(req.url).pathname, err);
    return fail("server_error");
  }
}
