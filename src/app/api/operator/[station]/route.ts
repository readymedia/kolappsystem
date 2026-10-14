import { parseStationId } from "@/lib/config";
import { fail, handle, ok } from "@/lib/http";
import { getOperatorView } from "@/lib/queue";

export async function GET(req: Request, { params }: { params: Promise<{ station: string }> }) {
  return handle(req, { requireSession: true }, async () => {
    const station = parseStationId((await params).station);
    if (!station) return fail("invalid_station");
    return ok(await getOperatorView(station));
  });
}
