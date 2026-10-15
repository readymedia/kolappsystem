import { fail, handle, ok } from "@/lib/http";
import { AUDIO_MAX_BYTES, detectAudioType } from "@/lib/media";
import { getSiteConfig, removeCustomAudio, setCustomAudio } from "@/lib/site-config";

// Admin: last opp eller fjern eget lydsignal. Filtype sjekkes på innholdet, maks 2 MB.

export async function POST(req: Request) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > AUDIO_MAX_BYTES + 64 * 1024) return fail("file_too_large");
    let file: File | null = null;
    try {
      const form = await req.formData();
      const f = form.get("file");
      file = f instanceof File ? f : null;
    } catch {
      return fail("bad_request");
    }
    if (!file || file.size === 0) return fail("bad_request");
    if (file.size > AUDIO_MAX_BYTES) return fail("file_too_large");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectAudioType(bytes);
    if (!mime) return fail("unsupported_file");
    await setCustomAudio(mime, bytes);
    return ok(await getSiteConfig());
  });
}

export async function DELETE(req: Request) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    await removeCustomAudio();
    return ok(await getSiteConfig());
  });
}
