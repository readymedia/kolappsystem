import { brandingChanged } from "@/lib/branding-server";
import { fail, handle, ok } from "@/lib/http";
import { detectImageType, LOGO_MAX_BYTES, svgProblem } from "@/lib/media";
import { getSiteConfig, removeLogo, setLogo } from "@/lib/site-config";

// Admin: last opp eller fjern logo. PNG, JPEG, WebP eller SVG, maks 512 kB, sjekket på innholdet.
// SVG med skript, hendelser, foreignObject eller eksterne lenker avvises.

export async function POST(req: Request) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > LOGO_MAX_BYTES + 64 * 1024) return fail("file_too_large");
    let file: File | null = null;
    try {
      const f = (await req.formData()).get("file");
      file = f instanceof File ? f : null;
    } catch {
      return fail("bad_request");
    }
    if (!file || file.size === 0) return fail("bad_request");
    if (file.size > LOGO_MAX_BYTES) return fail("file_too_large");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectImageType(bytes);
    if (!mime) return fail("unsupported_file");
    if (mime === "image/svg+xml" && svgProblem(bytes)) return fail("unsafe_svg");
    await setLogo(mime, bytes);
    brandingChanged();
    return ok(await getSiteConfig());
  });
}

export async function DELETE(req: Request) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    await removeLogo();
    brandingChanged();
    return ok(await getSiteConfig());
  });
}
