// Ren logikk for når et lydsignal skal spilles (testet i tests/unit/announce.test.ts).
// Brukes av lydsiden /audio og storskjermen med ?sound=1.

import { parseStationId, type StationId } from "./config";
import type { PublicStation } from "./public-state";

export type Snapshot = Record<string, { current: number | null; generation: number }>;

export function takeSnapshot(stations: PublicStation[]): Snapshot {
  return Object.fromEntries(stations.map((s) => [s.id, { current: s.current, generation: s.generation }]));
}

/**
 * Hvilke stasjoner har kalt et NYTT nummer siden forrige øyeblikksbilde?
 * - første øyeblikksbilde (siden nettopp lastet / koblet til igjen): ingen lyd
 * - nullstilt stasjon (ny generasjon): ingen lyd
 * - ingen kalt (null) eller samme nummer: ingen lyd
 * - filter (f.eks. bare A): andre stasjoner ignoreres
 */
export function detectNewCalls(
  prev: Snapshot | null,
  stations: PublicStation[],
  filter: readonly StationId[] | null,
): { station: StationId; number: number }[] {
  if (!prev) return [];
  const calls: { station: StationId; number: number }[] = [];
  for (const s of stations) {
    if (filter && !filter.includes(s.id)) continue;
    const p = prev[s.id];
    if (!p || p.generation !== s.generation) continue;
    if (s.current !== null && s.current !== p.current) calls.push({ station: s.id, number: s.current });
  }
  return calls;
}

/** «A», «a,c», «A, B» → ["A","C"]. Ugyldige verdier ignoreres. Tom eller ingen gyldige → null (= alle). */
export function parseStationFilter(value: string | null | undefined): StationId[] | null {
  if (!value) return null;
  const ids = [...new Set(value.split(",").map(parseStationId).filter((id): id is StationId => id !== null))];
  return ids.length ? ids : null;
}
