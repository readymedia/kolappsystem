import { after } from "next/server";
import { RATE_LIMITS } from "@/lib/config";
import { clientIp, fail, handle, ok, readJson } from "@/lib/http";
import { deletePushSubscription, savePushSubscription, sendWelcome } from "@/lib/push";
import { isValidKeys } from "@/lib/push-rules";
import { hitRateLimit } from "@/lib/rate-limit";

// Push-varsel for én kølapp (v1.5). Lapp-id-en er adgangsbeviset, som for selve lappen.
// POST {endpoint, keys: {p256dh, auth}} slår på, DELETE {endpoint} slår av.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function limited(req: Request): Promise<boolean> {
  const { limit, windowSeconds } = RATE_LIMITS.push;
  return !(await hitRateLimit(`push:${clientIp(req)}`, limit, windowSeconds)).allowed;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, { mutation: true }, async () => {
    const id = (await params).id;
    if (!UUID.test(id)) return fail("not_found");
    if (await limited(req)) return fail("rate_limited");
    const body = await readJson(req);
    const keys = (body.keys ?? {}) as Record<string, unknown>;
    if (typeof body.endpoint !== "string" || !isValidKeys(keys.p256dh, keys.auth)) return fail("bad_request");
    const sub = { endpoint: body.endpoint, p256dh: keys.p256dh as string, auth: keys.auth as string };
    const result = await savePushSubscription(id, sub);
    switch (result) {
      case "ok":
        after(() => sendWelcome(id, sub));
        return ok({ ok: true });
      case "bad_endpoint":
        return fail("bad_request");
      case "disabled":
        return fail("push_disabled");
      case "finished":
      case "not_found":
        return fail("not_found");
    }
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, { mutation: true }, async () => {
    const id = (await params).id;
    if (!UUID.test(id)) return fail("not_found");
    if (await limited(req)) return fail("rate_limited");
    const body = await readJson(req);
    if (typeof body.endpoint !== "string") return fail("bad_request");
    await deletePushSubscription(id, body.endpoint);
    return ok({ ok: true });
  });
}
