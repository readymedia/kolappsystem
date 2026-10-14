import { changePin } from "@/lib/auth";
import { fail, handle, ok, readJson } from "@/lib/http";

// Bytter felles PIN for operator og admin. Alle andre økter logges ut.

export async function PUT(req: Request) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    const body = await readJson(req);
    const result = await changePin(body.pin);
    return result.ok ? ok({ ok: true }) : fail(result.error);
  });
}
