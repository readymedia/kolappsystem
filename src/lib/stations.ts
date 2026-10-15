// Stasjoner (v1.6): kode, navn, farge og rekkefølge. Ren og trygg i nettleseren. Testet i tests/unit/stations.test.ts.
// Farger settes som CSS-variabler på stasjonens element (stationVars) og brukes med klassene i ST.

import { contrastRatio } from "./color";

export type StationId = string;

/** Maks antall aktive (ikke arkiverte) stasjoner. */
export const MAX_ACTIVE_STATIONS = 12;

/** Én stor bokstav A–Z. Tillater små bokstaver i adresser (?station=a). */
export function parseStationId(value: unknown): StationId | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return /^[A-Z]$/.test(upper) ? upper : null;
}

export interface StationInfo {
  id: StationId;
  /** Valgfritt navn. Tomt = «Stasjon A». */
  name: string;
  /** Palett-navn (f.eks. «sky») eller «#rrggbb». */
  color: string;
}

export function stationLabel(s: Pick<StationInfo, "id" | "name">): string {
  return s.name.trim() || `Stasjon ${s.id}`;
}

/** For setninger: «stasjon A», eller «Hovedscenen (stasjon A)» når navn er satt. */
export function stationPlace(s: Pick<StationInfo, "id" | "name">): string {
  return s.name.trim() ? `${s.name.trim()} (stasjon ${s.id})` : `stasjon ${s.id}`;
}

export interface StationShades {
  /** Knapper, prikker. */
  solid: string;
  /** Lys bakgrunn (kølapp, kort). */
  soft: string;
  border: string;
  /** Tekst på lys bakgrunn. */
  text: string;
  /** Tekst/nummer på mørk storskjerm. */
  display: string;
}

/** 12 farger. sky/violet/emerald er nøyaktig dagens A/B/C (Tailwind 500/50/200/600/400). */
export const PALETTE: Record<string, { label: string } & StationShades> = {
  sky: { label: "Blå", solid: "#0ea5e9", soft: "#f0f9ff", border: "#bae6fd", text: "#0284c7", display: "#38bdf8" },
  violet: { label: "Lilla", solid: "#8b5cf6", soft: "#f5f3ff", border: "#ddd6fe", text: "#7c3aed", display: "#a78bfa" },
  emerald: { label: "Grønn", solid: "#10b981", soft: "#ecfdf5", border: "#a7f3d0", text: "#059669", display: "#34d399" },
  amber: { label: "Gul", solid: "#f59e0b", soft: "#fffbeb", border: "#fde68a", text: "#b45309", display: "#fbbf24" },
  rose: { label: "Rød", solid: "#f43f5e", soft: "#fff1f2", border: "#fecdd3", text: "#e11d48", display: "#fb7185" },
  teal: { label: "Turkis", solid: "#14b8a6", soft: "#f0fdfa", border: "#99f6e4", text: "#0f766e", display: "#2dd4bf" },
  indigo: { label: "Indigo", solid: "#6366f1", soft: "#eef2ff", border: "#c7d2fe", text: "#4f46e5", display: "#818cf8" },
  orange: { label: "Oransje", solid: "#f97316", soft: "#fff7ed", border: "#fed7aa", text: "#c2410c", display: "#fb923c" },
  fuchsia: { label: "Rosa", solid: "#d946ef", soft: "#fdf4ff", border: "#f5d0fe", text: "#c026d3", display: "#e879f9" },
  lime: { label: "Lime", solid: "#84cc16", soft: "#f7fee7", border: "#d9f99d", text: "#4d7c0f", display: "#a3e635" },
  cyan: { label: "Cyan", solid: "#06b6d4", soft: "#ecfeff", border: "#a5f3fc", text: "#0e7490", display: "#22d3ee" },
  slate: { label: "Grå", solid: "#64748b", soft: "#f8fafc", border: "#e2e8f0", text: "#475569", display: "#94a3b8" },
};
export const PALETTE_IDS = Object.keys(PALETTE);

/** Gyldig fargeverdi for databasen: palett-navn eller #rrggbb. */
export function isStationColor(v: unknown): v is string {
  return typeof v === "string" && (v in PALETTE || /^#[0-9a-f]{6}$/.test(v));
}

function mix(hex: string, other: string, amount: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(other.slice(1), 16);
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/** Blander mot en farge til kontrasten mot bakgrunnen er minst `min` (WCAG). */
function ensureContrast(hex: string, bg: string, toward: string, min: number): string {
  let c = hex;
  for (let i = 1; i <= 20 && contrastRatio(c, bg) < min; i++) c = mix(hex, toward, i * 0.05);
  return c;
}

/** Fargetoner for en stasjon. Egen hex: lyse/mørke varianter regnes ut med kontrastkrav. */
export function stationShades(color: string): StationShades {
  const p = PALETTE[color];
  if (p) return { solid: p.solid, soft: p.soft, border: p.border, text: p.text, display: p.display };
  const hex = /^#[0-9a-f]{6}$/.test(color) ? color : PALETTE.slate!.solid;
  return {
    solid: hex,
    soft: mix(hex, "#ffffff", 0.92),
    border: mix(hex, "#ffffff", 0.7),
    text: ensureContrast(hex, "#ffffff", "#000000", 4.5),
    display: ensureContrast(hex, "#000000", "#ffffff", 4.5),
  };
}

/** CSS-variabler for en stasjon. Settes med style={} på stasjonens element. */
export function stationVars(color: string): Record<string, string> {
  const s = stationShades(color);
  return { "--st-solid": s.solid, "--st-soft": s.soft, "--st-border": s.border, "--st-text": s.text, "--st-display": s.display };
}

/** Tailwind-klasser som leser stasjonens CSS-variabler. Krever stationVars() på et foreldre-element. */
export const ST = {
  solid: "bg-[var(--st-solid)]",
  soft: "bg-[var(--st-soft)]",
  border: "border-[var(--st-border)]",
  text: "text-[var(--st-text)]",
  display: "text-[var(--st-display)]",
  dot: "bg-[var(--st-solid)]",
} as const;

/** Første ledige bokstav (brukte bokstaver – også arkiverte – gjenbrukes aldri). */
export function nextFreeStationId(used: readonly string[]): StationId | null {
  for (let c = 65; c <= 90; c++) {
    const id = String.fromCharCode(c);
    if (!used.includes(id)) return id;
  }
  return null;
}

/** Første palettfarge som ikke er i bruk, ellers rundt igjen. */
export function nextFreeColor(inUse: readonly string[]): string {
  return PALETTE_IDS.find((c) => !inUse.includes(c)) ?? PALETTE_IDS[inUse.length % PALETTE_IDS.length]!;
}

/** Antall kolonner på storskjermen for n stasjoner (1 / 2–4 / 5–8 / 9–12). */
export function displayColumns(n: number): number {
  if (n <= 3) return Math.max(n, 1);
  if (n === 4) return 4;
  if (n <= 8) return 4;
  return 6;
}

/** Kastes når en stasjon ikke finnes (eller er arkivert der det kreves aktiv). API-et svarer «invalid_station». */
export class StationNotFoundError extends Error {
  constructor(id: string) {
    super(`Stasjon ${id} finnes ikke`);
    this.name = "StationNotFoundError";
  }
}

const COUNT_WORDS = ["Ingen", "Én", "To", "Tre", "Fire", "Fem", "Seks", "Sju", "Åtte", "Ni", "Ti", "Elleve", "Tolv"];

/** «Tre stasjoner, én digital kø.» (forsiden). Med tre stasjoner er teksten som før v1.6. */
export function stationsIntro(count: number): string {
  const word = COUNT_WORDS[count] ?? String(count);
  return count === 1 ? "Én stasjon, én digital kø." : `${word} stasjoner, én digital kø.`;
}
