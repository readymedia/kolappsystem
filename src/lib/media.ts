// Ren gjenkjenning av filtyper på INNHOLDET (magiske bytes), aldri på filnavn eller oppgitt type.
// Testet i tests/unit/media.test.ts. Brukes av opplasting av lyd (v1.2) og logo (v1.4).

export const AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const AUDIO_MAX_SECONDS = 15;
export const LOGO_MAX_BYTES = 512 * 1024;

export type AudioMime = "audio/mpeg" | "audio/wav" | "audio/mp4" | "audio/ogg" | "audio/flac" | "audio/aiff";

const ascii = (b: Uint8Array, start: number, len: number) =>
  String.fromCharCode(...Array.from(b.subarray(start, start + len)));

/** Gjenkjenner MP3, WAV, M4A/AAC, OGG/Opus, FLAC og AIFF. Returnerer null for alt annet. */
export function detectAudioType(b: Uint8Array): AudioMime | null {
  if (b.length < 12) return null;
  if (ascii(b, 0, 3) === "ID3") return "audio/mpeg";
  // MPEG-ramme uten ID3-tagg: 11 bits synk (0xFFE) + gyldig lag (ikke «reservert»).
  if (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0 && (b[1]! & 0x06) !== 0) return "audio/mpeg";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return "audio/wav";
  if (ascii(b, 4, 4) === "ftyp") return "audio/mp4";
  if (ascii(b, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(b, 0, 4) === "fLaC") return "audio/flac";
  if (ascii(b, 0, 4) === "FORM" && ["AIFF", "AIFC"].includes(ascii(b, 8, 4))) return "audio/aiff";
  return null;
}

/** Formater som ikke spilles i alle nettlesere – admin viser varsel. */
export const AUDIO_COMPAT_WARNING: Partial<Record<AudioMime, string>> = {
  "audio/aiff": "AIFF spilles bare i Safari. Bruk MP3 eller WAV hvis lydsiden kjører i Chrome, Edge eller Firefox.",
  "audio/ogg": "OGG spilles ikke i eldre versjoner av Safari. MP3 eller WAV er tryggest.",
};

export const AUDIO_LABEL: Record<AudioMime, string> = {
  "audio/mpeg": "MP3",
  "audio/wav": "WAV",
  "audio/mp4": "M4A/AAC",
  "audio/ogg": "OGG",
  "audio/flac": "FLAC",
  "audio/aiff": "AIFF",
};

export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

export const IMAGE_LABEL: Record<ImageMime, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
  "image/svg+xml": "SVG",
};

/** Gjenkjenner PNG, JPEG, WebP og SVG. SVG må i tillegg passere svgProblem(). */
export function detectImageType(b: Uint8Array): ImageMime | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  const head = new TextDecoder("utf-8", { fatal: false }).decode(b.subarray(0, 1024)).replace(/^\uFEFF/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return "image/svg+xml";
  return null;
}

/**
 * SVG-vern: avviser alt som kan kjøre kode eller hente noe utenfra. Returnerer en grunn, eller null hvis OK.
 * Logoen vises i tillegg bare som <img> og serveres med sandbox-CSP, så dette er ekstra lag.
 */
export function svgProblem(b: Uint8Array): string | null {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(b);
  const checks: [RegExp, string][] = [
    [/<script/i, "skript"],
    [/\son[a-z]+\s*=/i, "hendelser (on…=)"],
    [/<foreignObject/i, "foreignObject"],
    [/<!ENTITY/i, "entiteter"],
    [/<(iframe|embed|object|audio|video|link|meta|style[^>]*>[^<]*@import)/i, "innebygde elementer"],
    [/javascript:/i, "javascript:-lenker"],
    // Lenker er bare lov internt i filen (#id) eller som innebygd bilde (data:image/…).
    [/(?:xlink:)?href\s*=\s*["']\s*(?!#|data:image\/(?:png|jpeg|gif|webp);)/i, "eksterne lenker"],
    [/url\(\s*["']?\s*(?!#)/i, "eksterne url()"],
  ];
  for (const [re, why] of checks) if (re.test(text)) return why;
  return null;
}
