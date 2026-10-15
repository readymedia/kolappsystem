import { isDefaultPin } from "@/lib/auth";
import { fail, handle, ok, publicOrigin } from "@/lib/http";
import { joinUrl as makeJoinUrl, qrSvg as makeQr } from "@/lib/join-link";
import { getAdminStations } from "@/lib/queue";

// Admin: stasjoner med hemmelig nøkkel, join-lenke og QR-kode (SVG laget her, aldri hos tredjepart).

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
    return ok({ stations: withQr, pinIsDefault: await isDefaultPin() });
  });
}
