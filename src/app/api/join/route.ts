import { networkFingerprint } from "@/lib/auth";
import { parseStationId, RATE_LIMITS } from "@/lib/config";
import { clientIp, fail, handle, ok, readJson } from "@/lib/http";
import { joinQueue } from "@/lib/queue";
import { hitRateLimit, isRateLimited, pruneRateLimits } from "@/lib/rate-limit";

// Lager (eller gjenbruker) en kølapp. Krever stasjonens hemmelige nøkkel fra QR-koden.
// Vern: forsøksgrense per nettverk, egen strengere grense for feil nøkkel, maks ventende per nettverk,
// og requestId så et skann som prøves på nytt aldri gir to lapper.

export async function POST(req: Request) {
  return handle(req, { mutation: true }, async () => {
    const body = await readJson(req);
    const station = parseStationId(body.station);
    if (!station) return fail("invalid_station");
    if (typeof body.key !== "string" || body.key.length === 0 || body.key.length > 100) return fail("invalid_link");

    const ip = clientIp(req);
    const bad = RATE_LIMITS.joinInvalid;
    if (await isRateLimited(`joinbad:${ip}`, bad.limit, bad.windowSeconds)) return fail("rate_limited");
    const { limit, windowSeconds } = RATE_LIMITS.join;
    if (!(await hitRateLimit(`join:${ip}`, limit, windowSeconds)).allowed) return fail("rate_limited");

    // Rydd gamle forsøksgrense-rader av og til (billig, holder tabellen liten).
    if (Math.random() < 0.02) await pruneRateLimits().catch(() => {});

    const result = await joinQueue({
      station,
      key: body.key,
      existingTicketId: typeof body.existingTicketId === "string" ? body.existingTicketId : null,
      requestId: typeof body.requestId === "string" ? body.requestId : null,
      ipHash: await networkFingerprint(ip),
    });
    if (!result.ok && (result.error === "invalid_link" || result.error === "invalid_station")) await hitRateLimit(`joinbad:${ip}`, bad.limit, bad.windowSeconds);
    return result.ok ? ok({ ticketId: result.ticketId, reused: result.reused }) : fail(result.error);
  });
}
