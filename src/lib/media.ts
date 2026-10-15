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
