import { isFontId } from "@/lib/branding";
import { brandingChanged } from "@/lib/branding-server";
import { normalizeHex } from "@/lib/color";
import { fail, handle, ok, readJson } from "@/lib/http";
import { getSiteConfig, resetBranding, updateBranding, type BrandingInput } from "@/lib/site-config";

// Admin: utseende (navn, hovedfarge, storskjermbakgrunn, fonter). PUT lagrer, DELETE tilbakestiller til standard.
// Logo lastes opp via /api/admin/logo. Alle sider får nytt utseende straks (revalidateTag).

export async function PUT(req: Request) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    const body = await readJson(req);
    const input: BrandingInput = {};
    if (body.eventName !== undefined) {
      if (typeof body.eventName !== "string" || body.eventName.length > 60) return fail("bad_request");
      input.eventName = body.eventName.trim();
    }
    if (body.primaryColor !== undefined) {
      const hex = typeof body.primaryColor === "string" ? normalizeHex(body.primaryColor) : null;
      if (!hex) return fail("bad_request");
      input.primaryColor = hex;
    }
    if (body.displayBackground !== undefined) {
      if (body.displayBackground !== "dark" && body.displayBackground !== "light") return fail("bad_request");
      input.displayBackground = body.displayBackground;
    }
    for (const key of ["fontDisplay", "fontBody"] as const) {
      if (body[key] === undefined) continue;
      if (!isFontId(body[key])) return fail("bad_request");
      input[key] = body[key];
    }
    await updateBranding(input);
    brandingChanged();
    return ok(await getSiteConfig());
  });
}

export async function DELETE(req: Request) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    await resetBranding();
    brandingChanged();
    return ok(await getSiteConfig());
  });
}
