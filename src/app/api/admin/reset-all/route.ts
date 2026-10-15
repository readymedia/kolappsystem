import { handle, ok } from "@/lib/http";
import { resetAllStations } from "@/lib/queue";

// Admin: «Nullstill alle køer» (v1.8). Hver stasjon nullstilles i sin egen låste transaksjon,
// og rapport-sammendrag lagres først.

export async function POST(req: Request) {
  return handle(req, { mutation: true, requireSession: true }, async () => ok({ ok: true, stations: await resetAllStations() }));
}
