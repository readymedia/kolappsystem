// Utseende per arrangement (v1.4): navn, logo, hovedfarge, storskjermbakgrunn og fonter.
// Ren og trygg for nettleseren. Standardverdiene gir nøyaktig dagens utseende.

import { textOn } from "./color";

export type FontId =
  | "space-grotesk"
  | "inter"
  | "manrope"
  | "dm-sans"
  | "source-sans-3"
  | "work-sans"
  | "atkinson"
  | "system";

/** Kuraterte fonter. Alle ligger i appen (@fontsource), ingen kall til Google. */
export const FONTS: Record<FontId, { label: string; family: string }> = {
  "space-grotesk": { label: "Space Grotesk", family: '"Space Grotesk Variable"' },
  inter: { label: "Inter", family: '"Inter Variable"' },
  manrope: { label: "Manrope", family: '"Manrope Variable"' },
  "dm-sans": { label: "DM Sans", family: '"DM Sans Variable"' },
  "source-sans-3": { label: "Source Sans 3", family: '"Source Sans 3 Variable"' },
  "work-sans": { label: "Work Sans", family: '"Work Sans Variable"' },
  atkinson: { label: "Atkinson Hyperlegible (lettlest)", family: '"Atkinson Hyperlegible"' },
  system: { label: "Systemfont", family: "system-ui" },
};

export const FONT_IDS = Object.keys(FONTS) as FontId[];
export const isFontId = (v: unknown): v is FontId => typeof v === "string" && v in FONTS;

export interface Branding {
  eventName: string;
  logoUrl: string | null;
  primaryColor: string;
  displayBackground: "dark" | "light";
  fontDisplay: FontId;
  fontBody: FontId;
}

export const DEFAULT_BRANDING: Branding = {
  eventName: "Meet & Greet",
  logoUrl: null,
  primaryColor: "#0f172a",
  displayBackground: "dark",
  fontDisplay: "space-grotesk",
  fontBody: "inter",
};

const FALLBACK = "ui-sans-serif, system-ui, sans-serif";

/** CSS-variabler som globals.css bruker. Settes på <html> av rotlayouten og av storskjermen. */
export function brandingVars(b: Branding): Record<string, string> {
  return {
    "--brand-primary": b.primaryColor,
    "--brand-on-primary": textOn(b.primaryColor),
    "--brand-font-display": `${FONTS[b.fontDisplay].family}, "Inter Variable", ${FALLBACK}`,
    "--brand-font-body": `${FONTS[b.fontBody].family}, ${FALLBACK}`,
  };
}
