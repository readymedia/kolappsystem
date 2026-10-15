// Hva denne nettleseren kan av push (v1.5). Ren og testet (tests/unit/push.test.ts).

export type PushSupport =
  | "supported" // Android, PC/Mac, og iPhone/iPad når appen er åpnet fra Hjem-skjerm
  | "ios-homescreen" // iPhone/iPad 16.4+ i Safari: må legges til på Hjem-skjerm først
  | "unsupported"; // eldre iPhone, nettlesere uten push – vis ingenting

export interface PushEnv {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
}

/** iOS-versjon fra brukeragenten («OS 17_4» / «Version/17.4»), eller null. iPad med «Mac»-agent: null. */
export function iosVersion(ua: string): number | null {
  const m = /(?:iPhone|iPad|iPod).*? OS (\d+)_(\d+)/.exec(ua);
  if (m) return Number(m[1]) + Number(m[2]) / 100;
  return null;
}

export function isIOS(env: Pick<PushEnv, "userAgent" | "maxTouchPoints">): boolean {
  // iPadOS 13+ later seg som Mac, men har berøringsskjerm.
  return /iPhone|iPad|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);
}

export function detectPushSupport(env: PushEnv): PushSupport {
  const full = env.hasServiceWorker && env.hasPushManager && env.hasNotification;
  if (isIOS(env)) {
    if (env.standalone) return full ? "supported" : "unsupported";
    const v = iosVersion(env.userAgent);
    // iPad med Mac-agent har ukjent versjon: anta ny nok (iPadOS 16.4+ er utbredt).
    if (v === null || v >= 16.04) return "ios-homescreen";
    return "unsupported";
  }
  return full ? "supported" : "unsupported";
}

/** VAPID-nøkkel (base64url) → bytes for pushManager.subscribe(). */
export function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
