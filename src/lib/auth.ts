import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { PIN_PATTERN, RATE_LIMITS, SESSION_COOKIE, SESSION_HOURS } from "./config";
import { getSql } from "./db";
import { hashPin, verifyPin } from "./pin-hash.mjs";
import { clearRateLimit, hitRateLimit, isRateLimited } from "./rate-limit";

// Operator og admin deler én PIN (valgt av kunden). PIN-en sjekkes alltid på serveren mot en
// scrypt-hash. Riktig PIN gir en signert, tidsbegrenset økt i en httpOnly-informasjonskapsel.
// Økta inneholder PIN-versjonen; når PIN byttes, blir alle gamle økter ugyldige.

let cachedSecret: Uint8Array | null = null;

async function getSecret(): Promise<Uint8Array> {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    cachedSecret = new TextEncoder().encode(fromEnv);
  } else {
    const [row] = await getSql()<{ session_secret: string }[]>`SELECT session_secret FROM settings WHERE id = 1`;
    if (!row) throw new Error("settings mangler – kjør npm run db:migrate");
    cachedSecret = new TextEncoder().encode(row.session_secret);
  }
  return cachedSecret;
}

async function getPinSettings(): Promise<{ pin_hash: string; pin_version: number }> {
  const [row] = await getSql()<{ pin_hash: string; pin_version: number }[]>`
    SELECT pin_hash, pin_version FROM settings WHERE id = 1`;
  if (!row) throw new Error("settings mangler – kjør npm run db:migrate");
  return row;
}

async function issueSession(pinVersion: number): Promise<void> {
  const token = await new SignJWT({ pv: pinVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("staff")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(await getSecret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export type LoginResult = { ok: true } | { ok: false; error: "wrong_pin" | "locked" | "bad_request" };

export async function login(pin: unknown, ip: string): Promise<LoginResult> {
  if (typeof pin !== "string" || !PIN_PATTERN.test(pin.trim())) return { ok: false, error: "wrong_pin" };
  const key = `login:${ip}`;
  const { limit, windowSeconds } = RATE_LIMITS.login;
  const global = RATE_LIMITS.loginGlobal;
  // Forsøket telles FØR PIN sjekkes (atomisk), så parallelle forespørsler ikke kan omgå grensen.
  if (await isRateLimited("login:global", global.limit, global.windowSeconds)) return { ok: false, error: "locked" };
  if (!(await hitRateLimit(key, limit, windowSeconds)).allowed) return { ok: false, error: "locked" };

  const settings = await getPinSettings();
  if (!(await verifyPin(pin.trim(), settings.pin_hash))) {
    await hitRateLimit("login:global", global.limit, global.windowSeconds);
    return { ok: false, error: "wrong_pin" };
  }
  await clearRateLimit(key);
  await issueSession(settings.pin_version);
  return { ok: true };
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Gyldig økt? Sjekker signatur, utløp og at PIN ikke er byttet siden innlogging. */
export async function hasValidSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, await getSecret(), { algorithms: ["HS256"] });
    const { pin_version } = await getPinSettings();
    return payload.sub === "staff" && payload.pv === pin_version;
  } catch {
    return false;
  }
}

export type ChangePinResult = { ok: true } | { ok: false; error: "bad_request" };

/** Bytter PIN, logger ut alle andre økter og gir den som byttet en ny økt. */
export async function changePin(newPin: unknown): Promise<ChangePinResult> {
  if (typeof newPin !== "string" || !PIN_PATTERN.test(newPin.trim())) return { ok: false, error: "bad_request" };
  const hash = await hashPin(newPin.trim());
  const [row] = await getSql()<{ pin_version: number }[]>`
    UPDATE settings SET pin_hash = ${hash}, pin_version = pin_version + 1, updated_at = now()
    WHERE id = 1 RETURNING pin_version`;
  if (!row) throw new Error("settings mangler");
  await issueSession(row.pin_version);
  return { ok: true };
}
