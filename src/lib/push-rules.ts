// Regler for push-varsel (v1.5). Ren og testet (tests/unit/push.test.ts).

export type PushKind = "next" | "called" | "skipped";

/** Push-tjenestene nettleserne bruker. Alt annet avvises (SSRF-vern: serveren kaller bare disse). */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

/**
 * Godtar bare https-adresser til kjente push-tjenester.
 * `testPrefix` brukes kun i tester (aldri i produksjon) for en lokal push-mottaker.
 */
export function isAllowedEndpoint(endpoint: string, testPrefix?: string | null): boolean {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return false;
  if (testPrefix && endpoint.startsWith(testPrefix)) return true;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  return PUSH_HOSTS.some((re) => re.test(url.hostname));
}

/** Nøklene i et abonnement er base64url. p256dh er en P-256-nøkkel (65 byte), auth 16 byte. */
export function isValidKeys(p256dh: unknown, auth: unknown): boolean {
  return (
    typeof p256dh === "string" &&
    typeof auth === "string" &&
    /^[A-Za-z0-9_-]{80,100}={0,2}$/.test(p256dh) &&
    /^[A-Za-z0-9_-]{16,32}={0,2}$/.test(auth)
  );
}

export interface SubscriptionState {
  id: string;
  status: "waiting" | "called" | "done" | "skipped";
  /** Første i køen (0 foran). */
  first: boolean;
  lastKind: PushKind | null;
}

/**
 * Hvilket varsel (om noe) hvert abonnement skal ha nå. Kjøres etter hver operatørhandling på stasjonen.
 * Hvert varsel sendes én gang per tilstand: kalles man på nytt etter «Angre», får man «din tur» igjen.
 */
export function planNotifications(subs: SubscriptionState[]): { id: string; kind: PushKind }[] {
  const out: { id: string; kind: PushKind }[] = [];
  for (const s of subs) {
    if (s.status === "called" && s.lastKind !== "called") out.push({ id: s.id, kind: "called" });
    else if (s.status === "waiting" && s.first && s.lastKind !== "next") out.push({ id: s.id, kind: "next" });
    // «Hoppet over» bare for den som faktisk ble kalt (og dermed varslet) først.
    else if (s.status === "skipped" && s.lastKind === "called") out.push({ id: s.id, kind: "skipped" });
  }
  return out;
}

/** `place`: «stasjon A» eller «Hovedscenen (stasjon A)» (stationPlace). */
export function pushMessage(kind: PushKind, label: string, place: string): { title: string; body: string } {
  switch (kind) {
    case "called":
      return { title: `Det er din tur! ${label}`, body: `Gå til ${place} nå.` };
    case "next":
      return { title: `Du er nest i køen – ${label}`, body: `Gjør deg klar ved ${place}.` };
    case "skipped":
      return { title: `Du ble hoppet over – ${label}`, body: "Snakk med en funksjonær, så setter vi deg inn igjen i køen." };
  }
}
