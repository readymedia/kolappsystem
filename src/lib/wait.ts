// Ventetid (v1.7): fast fra admin eller målt tempo. Ren og testet (tests/unit/leave.test.ts).

export type WaitMode = "fixed" | "measured";

/** Pauser lenger enn dette regnes ikke med i tempoet (lunsj, stengt stasjon). */
const MAX_GAP_MINUTES = 30;
/** Antall opprop som brukes (gir inntil 6 intervaller). */
export const MEASURE_CALLS = 7;
/** Minst så mange intervaller før målt tempo brukes; ellers brukes fast verdi. */
const MIN_INTERVALS = 3;

/**
 * Minutter per person ut fra de siste oppropene (tidspunkt, nyeste først eller i vilkårlig rekkefølge).
 * Median av intervallene (tåler ett langt eller kort opprop), avrundet til nærmeste halve minutt, 0,5–30.
 * For få data → `fallback`.
 */
export function measuredMinutes(calledAt: readonly Date[], fallback: number): number {
  const times = [...calledAt].map((d) => d.getTime()).sort((a, b) => b - a);
  const gaps: number[] = [];
  for (let i = 0; i + 1 < times.length; i++) {
    const minutes = (times[i]! - times[i + 1]!) / 60_000;
    if (minutes > 0 && minutes <= MAX_GAP_MINUTES) gaps.push(minutes);
  }
  if (gaps.length < MIN_INTERVALS) return fallback;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid]! : (gaps[mid - 1]! + gaps[mid]!) / 2;
  return Math.min(30, Math.max(0.5, Math.round(median * 2) / 2));
}

// ---------------------------------------------------------------- v1.8: visning og kapasitet

export type WaitDisplay = "duration" | "clock" | "both";

/** Klokkeslett vises ikke for kortere ventetid enn dette (falsk presisjon). */
const CLOCK_MIN_MINUTES = 5;
const FIVE_MIN = 5 * 60_000;

/** «14:35» i norsk tid, rundet OPP til nærmeste 5 minutter. */
export function clockAt(now: Date, minutesFromNow: number): string {
  const t = Math.ceil((now.getTime() + minutesFromNow * 60_000) / FIVE_MIN) * FIVE_MIN;
  const parts = new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Oslo" }).formatToParts(
    new Date(t),
  );
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

function minutesText(min: number): string {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return m === 1 ? "1 minutt" : `${m} minutter`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} t ${rest} min` : `${h} t`;
}

/** Varighet som før: «Under 2 minutter» / «Ca. 10 minutter» / «Ca. 1 t 15 min». */
export function durationText(ahead: number, minutesPerPerson: number): string {
  if (ahead <= 0) return `Under ${minutesText(Math.max(1, Math.ceil(minutesPerPerson)))}`;
  return `Ca. ${minutesText(ahead * minutesPerPerson)}`;
}

/**
 * Ventetid på kølappen etter admin-valget (v1.8). «duration» er som før.
 * clock: «Din tur ca. kl. 14:35». both: «Ca. 25 minutter – ca. kl. 14:35». Under 5 min: bare varighet.
 */
export function formatWait(ahead: number, minutesPerPerson: number, mode: WaitDisplay = "duration", now: Date = new Date()): string {
  const duration = durationText(ahead, minutesPerPerson);
  const total = Math.max(0, ahead) * minutesPerPerson;
  if (mode === "duration" || total < CLOCK_MIN_MINUTES) return duration;
  const clock = clockAt(now, total);
  return mode === "clock" ? `Din tur ca. kl. ${clock}` : `${duration} – ca. kl. ${clock}`;
}

/** Kort variant for storskjerm: «12 i kø · ca. 25 min» / «12 i kø · ca. kl. 14:35» / «… · ca. 25 min (kl. 14:35)». */
export function formatQueueShort(waiting: number, minutesPerPerson: number, mode: WaitDisplay = "duration", now: Date = new Date()): string {
  const total = waiting * minutesPerPerson;
  const count = `${waiting} i kø`;
  if (waiting <= 0) return "Ingen kø";
  const dur = total < 60 ? `ca. ${Math.max(1, Math.round(total))} min` : `ca. ${minutesText(total)}`;
  if (mode === "duration" || total < CLOCK_MIN_MINUTES) return `${count} · ${dur}`;
  const clock = clockAt(now, total);
  return mode === "clock" ? `${count} · ca. kl. ${clock}` : `${count} · ${dur} (kl. ${clock})`;
}

export interface CapacityInput {
  /** Antall ventende nå (en ny gjest får så mange foran seg). */
  waiting: number;
  minutesPerPerson: number;
  /** Siste betjening (absolutt tidspunkt), eller null. */
  endAt: Date | null;
  maxWaiting: number | null;
  now: Date;
}

/**
 * Kan stasjonen ta imot en ny gjest? (v1.8)
 * full: ja/nei. left: omtrent hvor mange flere som rekker fram (null = ingen grense satt).
 */
export function capacity(c: CapacityInput): { full: boolean; left: number | null } {
  const limits: number[] = [];
  if (c.maxWaiting !== null) limits.push(c.maxWaiting - c.waiting);
  if (c.endAt) {
    const minutesLeft = (c.endAt.getTime() - c.now.getTime()) / 60_000;
    // Ny gjest i posisjon n (0-basert) får tur etter n × m minutter; må være før sluttid.
    const fits = minutesLeft <= 0 ? 0 : Math.floor(minutesLeft / Math.max(0.5, c.minutesPerPerson)) + 1;
    limits.push(fits - c.waiting);
  }
  if (!limits.length) return { full: false, left: null };
  const left = Math.max(0, Math.min(...limits));
  return { full: left <= 0, left };
}

/** «Plass til ca. 18 til før kl. 16:00» / «Full – siste betjening kl. 16:00» (v1.8, operatør og admin). */
export function capacityText(full: boolean, left: number | null, serviceEnd: string | null): string {
  if (full) return serviceEnd ? `Full – siste betjening kl. ${serviceEnd}` : "Full – maks antall i kø er nådd";
  return `Plass til ca. ${left ?? 0} til${serviceEnd ? ` før kl. ${serviceEnd}` : ""}`;
}
