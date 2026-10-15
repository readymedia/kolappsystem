import { after } from "next/server";
import { RATE_LIMITS } from "@/lib/config";
import { clientIp, fail, handle, ok } from "@/lib/http";
import { notifyStation } from "@/lib/push";
import { leaveQueue, rejoinQueue } from "@/lib/queue";
import { hitRateLimit } from "@/lib/rate-limit";

// Gi fra seg plassen (v1.7). Lapp-id-en er adgangsbeviset, som for selve lappen.
// POST = gi fra meg plassen, DELETE = angre (innen 60 s, og bare hvis nummeret ikke er passert).

async function limited(req: Request): Promise<boolean> {
  const { limit, windowSeconds } = RATE_LIMITS.push;
  return !(await hitRateLimit(`leave:${clientIp(req)}`, limit, windowSeconds)).allowed;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, { mutation: true }, async () => {
    if (await limited(req)) return fail("rate_limited");
    const r = await leaveQueue((await params).id);
    if (!r.ok) return fail(r.error);
    // Noen kan ha blitt nest i køen – push-varsel etter svaret (gjør ingenting når push er av).
    after(() => notifyStation(r.station));
    return ok({ ok: true, wasCalled: r.wasCalled });
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, { mutation: true }, async () => {
    if (await limited(req)) return fail("rate_limited");
    const r = await rejoinQueue((await params).id);
    if (!r.ok) return fail(r.error);
    after(() => notifyStation(r.station));
    return ok({ ok: true });
  });
}
