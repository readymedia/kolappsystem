// Skjermvalg for /display, lest fra adressen. Ren og testet (tests/unit/display.test.ts).
// Standardverdiene gir dagens storskjerm. Ugyldige verdier ignoreres og gir standard – aldri feilside.

import { parseStationFilter } from "./announce";
import type { StationId } from "./config";

export type DisplaySize = "s" | "m" | "l" | "xl";
export type DisplayTheme = "dark" | "light";

export interface DisplayOptions {
  stations: StationId[] | null; // null = alle
  size: DisplaySize;
  title: boolean;
  desc: boolean;
  next: number; // 0–5
  header: boolean;
  clock: boolean;
  theme: DisplayTheme;
  sound: boolean;
  qr: boolean;
  token: string | null;
}

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  stations: null,
  size: "m",
  title: true,
  desc: false,
  next: 3,
  header: true,
  clock: false,
  theme: "dark",
  sound: false,
  qr: false,
  token: null,
};

type Params = { get(name: string): string | null };

const flag = (v: string | null, fallback: boolean) => (v === "1" ? true : v === "0" ? false : fallback);

export function parseDisplayOptions(p: Params): DisplayOptions {
  const d = DEFAULT_DISPLAY_OPTIONS;
  const size = p.get("size");
  const theme = p.get("theme");
  const nextRaw = p.get("next");
  const next = nextRaw !== null && /^[0-5]$/.test(nextRaw) ? Number(nextRaw) : d.next;
  const token = p.get("t");
  return {
    stations: parseStationFilter(p.get("station")),
    size: size === "s" || size === "m" || size === "l" || size === "xl" ? size : d.size,
    title: flag(p.get("title"), d.title),
    desc: flag(p.get("desc"), d.desc),
    next,
    header: flag(p.get("header"), d.header),
    clock: flag(p.get("clock"), d.clock),
    theme: theme === "light" || theme === "dark" ? theme : d.theme,
    sound: flag(p.get("sound"), d.sound),
    qr: flag(p.get("qr"), d.qr),
    token: token && /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : null,
  };
}

/** Bygger spørringen til en skjermlenke. Utelater standardverdier, så lenken blir kort. */
export function buildDisplayQuery(o: DisplayOptions): string {
  const d = DEFAULT_DISPLAY_OPTIONS;
  const q = new URLSearchParams();
  if (o.stations?.length) q.set("station", o.stations.join(","));
  if (o.size !== d.size) q.set("size", o.size);
  if (o.title !== d.title) q.set("title", o.title ? "1" : "0");
  if (o.desc !== d.desc) q.set("desc", o.desc ? "1" : "0");
  if (o.next !== d.next) q.set("next", String(o.next));
  if (o.header !== d.header) q.set("header", o.header ? "1" : "0");
  if (o.clock !== d.clock) q.set("clock", o.clock ? "1" : "0");
  if (o.theme !== d.theme) q.set("theme", o.theme);
  if (o.sound !== d.sound) q.set("sound", o.sound ? "1" : "0");
  if (o.qr && o.token) {
    q.set("qr", "1");
    q.set("t", o.token);
  }
  const s = q.toString().replace(/%2C/g, ",");
  return s ? `?${s}` : "";
}
