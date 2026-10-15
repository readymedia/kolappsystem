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
