import { fail, handle, ok, readJson } from "@/lib/http";
import { getSiteConfig, updateAudioSettings, type AudioMode } from "@/lib/site-config";

// Admin: les og endre innstillinger (lyd i v1.2, utvides i senere versjoner).

const AUDIO_MODES: AudioMode[] = ["default", "custom", "off"];

export async function GET(req: Request) {
  return handle(req, { requireSession: true }, async () => ok(await getSiteConfig()));
}

export async function PUT(req: Request) {
  return handle(req, { mutation: true, requireSession: true }, async () => {
    const body = await readJson(req);
    const mode = body.audioMode;
    const volume = body.audioVolume;
    if (mode !== undefined && !AUDIO_MODES.includes(mode as AudioMode)) return fail("bad_request");
    if (volume !== undefined && !(Number.isInteger(volume) && (volume as number) >= 0 && (volume as number) <= 100)) {
      return fail("bad_request");
    }
    await updateAudioSettings({ mode: mode as AudioMode | undefined, volume: volume as number | undefined });
    return ok(await getSiteConfig());
  });
}
