// Farger og kontrast (WCAG 2.x). Ren og testet (tests/unit/branding.test.ts).

export const HEX_PATTERN = /^#[0-9a-f]{6}$/;

/** «#ABC», «abc123» o.l. → «#aabbcc». null hvis ugyldig. */
export function normalizeHex(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9a-f]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return HEX_PATTERN.test(s) ? s : null;
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export const LIGHT_TEXT = "#ffffff";
export const DARK_TEXT = "#0f172a";

/** Tekstfargen (hvit eller mørk) som gir best kontrast på bakgrunnen. */
export function textOn(bg: string): string {
  return contrastRatio(bg, LIGHT_TEXT) >= contrastRatio(bg, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

/** Varsel til admin hvis knappeteksten blir vanskelig å lese (under 4,5:1). null = OK. */
export function contrastWarning(bg: string): string | null {
  const ratio = contrastRatio(bg, textOn(bg));
  return ratio < 4.5
    ? `Lav kontrast (${ratio.toFixed(1).replace(".", ",")}:1). Tekst på knappene kan bli vanskelig å lese – velg en mørkere eller lysere farge.`
    : null;
}
