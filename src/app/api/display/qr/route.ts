import { parseStationFilter } from "@/lib/announce";
import { STATION_IDS } from "@/lib/config";
import { verifyDisplayToken } from "@/lib/display-token";
import { fail, handle, ok, publicOrigin } from "@/lib/http";
import { joinUrl, qrSvg } from "@/lib/join-link";
import { getJoinKeys } from "@/lib/queue";

// QR-koder til storskjermen: GET /api/display/qr?station=A,C&t=<signert token>.
// Tokenet lages i admin («Skjermer») og blir ugyldig når en av stasjonene får ny nøkkel.
// Svaret er bare SVG – nøkkelen sendes aldri som tekst. Aldri mellomlagret.

export async function GET(req: Request) {
  return handle(req, {}, async () => {
    const url = new URL(req.url);
    const token = url.searchParams.get("t") ?? "";
    const stations = parseStationFilter(url.searchParams.get("station"));
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return fail("display_link_expired");
    const keys = await getJoinKeys();
    if (!(await verifyDisplayToken(stations, keys, token))) return fail("display_link_expired");
    const origin = publicOrigin(req);
    const qr: Record<string, string> = {};
    for (const id of stations ?? STATION_IDS) {
      const key = keys[id];
      if (key) qr[id] = await qrSvg(joinUrl(origin, id, key));
    }
    return ok({ qr });
  });
}
