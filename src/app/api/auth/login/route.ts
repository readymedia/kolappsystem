import { login } from "@/lib/auth";
import { clientIp, fail, handle, ok, readJson } from "@/lib/http";

export async function POST(req: Request) {
  return handle(req, { mutation: true }, async () => {
    const body = await readJson(req);
    const result = await login(body.pin, clientIp(req));
    return result.ok ? ok({ ok: true }) : fail(result.error);
  });
}
