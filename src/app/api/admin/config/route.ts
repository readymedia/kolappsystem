import { fail, handle, ok, readJson } from "@/lib/http";
import { countPushSubscriptions } from "@/lib/push";
import { getSiteConfig, setPushEnabled, updateAudioSettings, updateDisplayTitle, type AudioMode } from "@/lib/site-config";

async function adminConfig() {
  return { ...(await getSiteConfig()), pushSubscribers: await countPushSubscriptions() };
}

// Admin: les og endre innstillinger (lyd i v1.2, utvides i senere versjoner).

const AUDIO_MODES: AudioMode[] = ["default", "custom", "off"];

export async function GET(req: Request) {
  return handle(req, { requireSession: true }, async () => ok(await adminConfig()));
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
    const title = body.displayTitle;
    if (title !== undefined && (typeof title !== "string" || title.length > 80)) return fail("bad_request");
    await updateAudioSettings({ mode: mode as AudioMode | undefined, volume: volume as number | undefined });
    if (typeof title === "string") await updateDisplayTitle(title.trim());
    if (body.pushEnabled !== undefined) {
      if (typeof body.pushEnabled !== "boolean") return fail("bad_request");
      await setPushEnabled(body.pushEnabled);
    }
    return ok(await adminConfig());
  });
}
