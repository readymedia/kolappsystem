import { after } from "next/server";
import { parseStationId } from "@/lib/config";
import { fail, handle, ok, readJson } from "@/lib/http";
import { notifyStation } from "@/lib/push";
import { advance, getOperatorView, requeueSkipped, undoLast } from "@/lib/queue";

// Operatørhandlinger: next | skip | undo | requeue. Svarer med ny tilstand for stasjonen, og sender deretter push-varsel.

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
        await undoLast(
          station,
          body.expectedActionId === null || typeof body.expectedActionId === "string" ? body.expectedActionId : undefined,
        );
        break;
      case "requeue": {
        if (typeof body.ticketId !== "string") return fail("bad_request");
        await requeueSkipped(station, body.ticketId);
        break;
      }
      default:
        return fail("bad_request");
    }
    // Push-varsel sendes etter at operatøren har fått svar (v1.5). Gjør ingenting når push er av.
    after(() => notifyStation(station));
    return ok(await getOperatorView(station));
  });
}
