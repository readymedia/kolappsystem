import { after } from "next/server";
import { parseStationId } from "@/lib/config";
import { fail, handle, ok, readJson } from "@/lib/http";
import {
  archiveStation,
  moveStation,
  restoreStation,
  updateStationMeta,
  removeWaitingRange,
  resetStation,
  rotateStationKey,
  setClosedMessage,
  setStationActive,
  setStationDescription,
} from "@/lib/queue";
import { notifyStation } from "@/lib/push";
import { isStationColor } from "@/lib/stations";

// Admin-handlinger per stasjon: meta {name?, color?} | move-up | move-down | archive | restore | reset | activate | deactivate {message?} | closed-message | rotate-key | description | remove-waiting

export async function POST(req: Request, { params }: { params: Promise<{ station: string; action: string }> }) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    const p = await params;
    const station = parseStationId(p.station);
    if (!station) return fail("invalid_station");

    switch (p.action) {
      case "meta": {
        const body = await readJson(req);
        if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 40)) return fail("bad_request");
        if (body.color !== undefined && !isStationColor(body.color)) return fail("bad_request");
        const okMeta = await updateStationMeta(station, {
          name: typeof body.name === "string" ? body.name.trim() : undefined,
          color: body.color as string | undefined,
        });
        if (!okMeta) return fail("invalid_station");
        break;
      }
      case "move-up":
      case "move-down":
        await moveStation(station, p.action === "move-up" ? -1 : 1);
        break;
      case "archive": {
        const r = await archiveStation(station);
        if (!r.ok) return fail(r.error);
        break;
      }
      case "restore": {
        const r = await restoreStation(station);
        if (!r.ok) return fail(r.error);
        break;
      }
      case "reset":
        await resetStation(station);
        break;
      case "activate":
        await setStationActive(station, true);
        break;
      case "deactivate": {
        const body = await readJson(req);
        const msg = body.message;
        if (msg !== undefined && (typeof msg !== "string" || msg.length > 80)) return fail("bad_request");
        await setStationActive(station, false, typeof msg === "string" ? msg.trim() : undefined);
        break;
      }
      case "closed-message": {
        const body = await readJson(req);
        if (typeof body.message !== "string" || body.message.length > 80) return fail("bad_request");
        await setClosedMessage(station, body.message.trim());
        break;
      }
      case "rotate-key":
        await rotateStationKey(station);
        break;
      case "description": {
        const body = await readJson(req);
        if (typeof body.description !== "string" || body.description.length > 300) return fail("bad_request");
        await setStationDescription(station, body.description.trim());
        break;
      }
      case "remove-waiting": {
        const body = await readJson(req);
        const from = Number(body.from);
        const to = Number(body.to);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to - from > 10_000) {
          return fail("bad_request");
        }
        const removed = await removeWaitingRange(station, from, to);
        after(() => notifyStation(station)); // noen kan ha blitt nest i køen
        return ok({ ok: true, removed });
      }
      default:
        return fail("bad_request");
    }
    return ok({ ok: true });
  });
}
