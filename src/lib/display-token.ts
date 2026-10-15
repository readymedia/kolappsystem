import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverSecret } from "./auth";
import { STATION_IDS, type StationId } from "./config";

// Signert skjermlenke for QR på storskjermen. Tokenet dekker valgte stasjoner OG deres nåværende
// nøkler: «Bytt nøkkel» gjør det ugyldig automatisk. Selve nøkkelen er aldri del av lenken.

/** Ren utregning (testet). Rekkefølgen på stasjonene spiller ingen rolle. */
export function computeDisplayToken(stations: readonly StationId[], keys: Record<string, string>, secret: Uint8Array): string {
  const ids = [...stations].sort();
  const payload = `qr:${ids.join(",")}:${ids.map((id) => keys[id] ?? "").join(",")}`;
  return createHmac("sha256", Buffer.from(secret)).update(payload).digest("base64url").slice(0, 32);
}

export async function makeDisplayToken(stations: readonly StationId[] | null, keys: Record<string, string>): Promise<string> {
  return computeDisplayToken(stations ?? STATION_IDS, keys, await serverSecret());
}

export async function verifyDisplayToken(
  stations: readonly StationId[] | null,
  keys: Record<string, string>,
  token: string,
): Promise<boolean> {
  const expected = Buffer.from(computeDisplayToken(stations ?? STATION_IDS, keys, await serverSecret()));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
