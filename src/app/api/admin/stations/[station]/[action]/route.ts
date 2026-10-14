import { parseStationId } from "@/lib/config";
import { fail, handle, ok, readJson } from "@/lib/http";
import { resetStation, rotateStationKey, setStationActive, setStationDescription } from "@/lib/queue";

// Admin-handlinger per stasjon: reset | activate | deactivate | rotate-key | description

export async function POST(req: Request, { params }: { params: Promise<{ station: string; action: string }> }) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    const p = await params;
    const station = parseStationId(p.station);
    if (!station) return fail("invalid_station");

    switch (p.action) {
      case "reset":
        await resetStation(station);
        break;
      case "activate":
        await setStationActive(station, true);
        break;
      case "deactivate":
        await setStationActive(station, false);
        break;
      case "rotate-key":
        await rotateStationKey(station);
        break;
      case "description": {
        const body = await readJson(req);
        if (typeof body.description !== "string" || body.description.length > 300) return fail("bad_request");
        await setStationDescription(station, body.description.trim());
        break;
      }
      default:
        return fail("bad_request");
    }
    return ok({ ok: true });
  });
}
