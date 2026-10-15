import { isDefaultPin } from "@/lib/auth";
import { fail, handle, ok, publicOrigin, readJson } from "@/lib/http";
import { joinUrl as makeJoinUrl, qrSvg as makeQr } from "@/lib/join-link";
import { createStation, getAdminStations, getArchivedStations } from "@/lib/queue";
import { isStationColor } from "@/lib/stations";

// Admin: stasjoner med hemmelig nøkkel, join-lenke og QR-kode (SVG laget her, aldri hos tredjepart),
// arkiverte stasjoner, og opprettelse av ny stasjon (POST).

export async function GET(req: Request) {
  return handle(req, { requireSession: true }, async () => {
    const origin = publicOrigin(req);
    const stations = await getAdminStations();
    if (!stations) return fail("server_error");
    const withQr = await Promise.all(
      stations.map(async (s) => {
        const joinUrl = makeJoinUrl(origin, s.id, s.joinKey);
        const qrSvg = await makeQr(joinUrl);
        return {
          id: s.id,
          name: s.name,
          color: s.color,
          description: s.description,
          active: s.active,
          closedMessage: s.closedMessage,
          waitingCount: s.waitingCount,
          issued: s.issued,
          joinUrl,
          qrSvg,
        };
      }),
    );
    return ok({ stations: withQr, archived: await getArchivedStations(), pinIsDefault: await isDefaultPin() });
  });
}

/** Ny stasjon (v1.6): neste ledige bokstav, valgfritt navn og farge. */
export async function POST(req: Request) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    const body = await readJson(req);
    if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 40)) return fail("bad_request");
    if (body.color !== undefined && !isStationColor(body.color)) return fail("bad_request");
    const r = await createStation({
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      color: body.color as string | undefined,
    });
    return r.ok ? ok({ ok: true, id: r.value }) : fail(r.error);
  });
}
