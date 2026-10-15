import { parseStationFilter } from "@/lib/announce";
import { makeDisplayToken } from "@/lib/display-token";
import { handle, ok } from "@/lib/http";
import { getJoinKeys } from "@/lib/queue";

// Admin: signert token for skjermlenke med QR. GET /api/admin/display-token?station=A,C

export async function GET(req: Request) {
  return handle(req, { requireSession: true }, async () => {
    const stations = parseStationFilter(new URL(req.url).searchParams.get("station"));
    return ok({ token: await makeDisplayToken(stations, await getJoinKeys()) });
  });
}
