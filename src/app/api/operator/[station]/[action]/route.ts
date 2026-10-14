import { parseStationId } from "@/lib/config";
import { fail, handle, ok, readJson } from "@/lib/http";
import { advance, getOperatorView, requeueSkipped, undoLast } from "@/lib/queue";

// Operatørhandlinger: next | skip | undo | requeue. Svarer med ny tilstand for stasjonen.

export async function POST(req: Request, { params }: { params: Promise<{ station: string; action: string }> }) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    const p = await params;
    const station = parseStationId(p.station);
    if (!station) return fail("invalid_station");

    const body = await readJson(req);
    // Valgfritt vern mot dobbelt trykk: klienten sender lappen den så som «betjenes nå».
    const expected =
      body.expectedCurrentId === null || typeof body.expectedCurrentId === "string" ? body.expectedCurrentId : undefined;

    switch (p.action) {
      case "next":
        await advance(station, "done", expected);
        break;
      case "skip":
        await advance(station, "skipped", expected);
        break;
      case "undo":
        await undoLast(station);
        break;
      case "requeue": {
        if (typeof body.ticketId !== "string") return fail("bad_request");
        await requeueSkipped(station, body.ticketId);
        break;
      }
      default:
        return fail("bad_request");
    }
    return ok(await getOperatorView(station));
  });
}
