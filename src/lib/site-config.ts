import "server-only";
import { createHash } from "node:crypto";
import { getSql, type Tx } from "./db";
import { DEFAULT_BRANDING, isFontId, type Branding, type FontId } from "./branding";
import type { AudioMime, ImageMime } from "./media";
import type { WaitMode } from "./wait";

// Innstillinger som kan endres i /admin (tabellen site_config) og opplastede filer (tabellen media).
// Offentlige deler leveres via /api/config. Ingen hemmeligheter her.

export type AudioMode = "default" | "custom" | "off";

export interface SiteConfig {
  displayTitle: string;
  audioMode: AudioMode;
  audioVolume: number;
  audioFile: { sha256: string; mime: string; size: number } | null;
  eventName: string;
  logoFile: { sha256: string; mime: string; size: number } | null;
  primaryColor: string;
  displayBackground: "dark" | "light";
  fontDisplay: FontId;
  fontBody: FontId;
  pushEnabled: boolean;
  /** v1.7 */
  allowLeave: boolean;
  waitMode: WaitMode;
  waitMinutes: number;
}

/** Det publikum (lydside, storskjerm) trenger. Mellomlagres på CDN. */
export interface PublicConfig {
  audio: { mode: AudioMode; volume: number; url: string | null };
  display: { title: string };
  brand: Branding;
  /** Push-varsel (v1.5). publicKey er VAPID-nøkkelen (offentlig). enabled=false: ingenting vises for publikum. */
  push: { enabled: boolean; publicKey: string | null };
  /** v1.7: om gjester kan gi fra seg plassen. */
  queue: { allowLeave: boolean };
}

export const DEFAULT_DISPLAY_TITLE = "Meet & Greet · Køstatus";
export const DEFAULT_CONFIG: SiteConfig = {
  displayTitle: DEFAULT_DISPLAY_TITLE,
  audioMode: "default",
  audioVolume: 80,
  audioFile: null,
  eventName: DEFAULT_BRANDING.eventName,
  logoFile: null,
  primaryColor: DEFAULT_BRANDING.primaryColor,
  displayBackground: DEFAULT_BRANDING.displayBackground,
  fontDisplay: DEFAULT_BRANDING.fontDisplay,
  fontBody: DEFAULT_BRANDING.fontBody,
  pushEnabled: false,
  allowLeave: true,
  waitMode: "fixed",
  waitMinutes: 2,
};

interface ConfigRow {
  display_title: string;
  audio_mode: AudioMode;
  audio_volume: number;
  audio_sha256: string | null;
  audio_mime: string | null;
  audio_size: number | null;
  event_name: string;
  logo_sha256: string | null;
  logo_mime: string | null;
  logo_size: number | null;
  primary_color: string;
  display_background: "dark" | "light";
  font_display: string;
  font_body: string;
  push_enabled: boolean;
  allow_leave: boolean;
  wait_mode: WaitMode;
  wait_minutes: string;
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const [row] = await getSql()<ConfigRow[]>`
    SELECT c.display_title, c.audio_mode, c.audio_volume,
      m.sha256 AS audio_sha256, m.mime AS audio_mime, m.size AS audio_size,
      c.event_name, l.sha256 AS logo_sha256, l.mime AS logo_mime, l.size AS logo_size,
      c.primary_color, c.display_background, c.font_display, c.font_body, c.push_enabled,
      c.allow_leave, c.wait_mode, c.wait_minutes
    FROM site_config c
      LEFT JOIN media m ON m.id = c.audio_media_id
      LEFT JOIN media l ON l.id = c.logo_media_id
    WHERE c.id = 1`;
  if (!row) return DEFAULT_CONFIG;
  return {
    displayTitle: row.display_title,
    audioMode: row.audio_mode,
    audioVolume: row.audio_volume,
    audioFile: row.audio_sha256 ? { sha256: row.audio_sha256, mime: row.audio_mime!, size: row.audio_size! } : null,
    eventName: row.event_name,
    logoFile: row.logo_sha256 ? { sha256: row.logo_sha256, mime: row.logo_mime!, size: row.logo_size! } : null,
    primaryColor: row.primary_color,
    displayBackground: row.display_background,
    // Ukjent font (f.eks. fjernet fra listen senere) gir standard i stedet for feil.
    fontDisplay: isFontId(row.font_display) ? row.font_display : DEFAULT_BRANDING.fontDisplay,
    fontBody: isFontId(row.font_body) ? row.font_body : DEFAULT_BRANDING.fontBody,
    pushEnabled: row.push_enabled,
    allowLeave: row.allow_leave,
    waitMode: row.wait_mode,
    waitMinutes: Number(row.wait_minutes),
  };
}

export function toBranding(c: SiteConfig): Branding {
  return {
    eventName: c.eventName,
    logoUrl: c.logoFile ? `/api/media/${c.logoFile.sha256}` : null,
    primaryColor: c.primaryColor,
    displayBackground: c.displayBackground,
    fontDisplay: c.fontDisplay,
    fontBody: c.fontBody,
  };
}

export function toPublicConfig(c: SiteConfig, vapidPublicKey: string | null = null): PublicConfig {
  // «Egen lyd» uten fil faller tilbake til standardlyden.
  const mode: AudioMode = c.audioMode === "custom" && !c.audioFile ? "default" : c.audioMode;
  return {
    audio: { mode, volume: c.audioVolume, url: mode === "custom" && c.audioFile ? `/api/media/${c.audioFile.sha256}` : null },
    display: { title: c.displayTitle },
    brand: toBranding(c),
    // Uten nøkkel kan ingen abonnere – da er push av for publikum uansett bryteren.
    push: { enabled: c.pushEnabled && Boolean(vapidPublicKey), publicKey: c.pushEnabled ? vapidPublicKey : null },
    queue: { allowLeave: c.allowLeave },
  };
}

export async function updateAudioSettings(input: { mode?: AudioMode; volume?: number }): Promise<void> {
  const sql = getSql();
  if (input.mode !== undefined) await sql`UPDATE site_config SET audio_mode = ${input.mode}, updated_at = now() WHERE id = 1`;
  if (input.volume !== undefined) await sql`UPDATE site_config SET audio_volume = ${input.volume}, updated_at = now() WHERE id = 1`;
}

export async function updateQueueSettings(input: { allowLeave?: boolean; waitMode?: WaitMode; waitMinutes?: number }): Promise<void> {
  await getSql()`
    UPDATE site_config SET
      allow_leave = COALESCE(${input.allowLeave ?? null}, allow_leave),
      wait_mode = COALESCE(${input.waitMode ?? null}, wait_mode),
      wait_minutes = COALESCE(${input.waitMinutes ?? null}, wait_minutes),
      updated_at = now()
    WHERE id = 1`;
}

export async function setPushEnabled(enabled: boolean): Promise<void> {
  await getSql()`UPDATE site_config SET push_enabled = ${enabled}, updated_at = now() WHERE id = 1`;
}

export async function updateDisplayTitle(title: string): Promise<void> {
  await getSql()`UPDATE site_config SET display_title = ${title}, updated_at = now() WHERE id = 1`;
}

/**
 * Filendringer (lagre, koble til, rydde) skjer i én transaksjon som låser innstillingsraden. Ellers kan to
 * samtidige opplastinger (eller opplasting + «Tilbakestill») rydde bort en fil den andre akkurat har lagret.
 */
function withConfigLock<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getSql().begin(async (tx) => {
    await tx.unsafe("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '10s'");
    await tx`SELECT 1 FROM site_config WHERE id = 1 FOR UPDATE`;
    return fn(tx);
  }) as Promise<T>;
}

/** Lagrer (eller gjenbruker) en fil og returnerer id og sha256. Samme innhold lagres bare én gang. */
async function saveMedia(tx: Tx, kind: "audio" | "logo", mime: string, bytes: Uint8Array): Promise<{ id: string; sha256: string }> {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const [row] = await tx<{ id: string }[]>`
    INSERT INTO media (kind, mime, bytes, size, sha256)
    VALUES (${kind}, ${mime}, ${buf}, ${bytes.byteLength}, ${sha256})
    ON CONFLICT (sha256) DO UPDATE SET mime = EXCLUDED.mime
    RETURNING id`;
  return { id: row!.id, sha256 };
}

/** Sletter filer av en type som ingen innstilling peker på lenger (verken lyd eller logo). */
async function pruneMedia(tx: Tx, kind: "audio" | "logo"): Promise<void> {
  await tx`
    DELETE FROM media m
    WHERE m.kind = ${kind}
      AND NOT EXISTS (SELECT 1 FROM site_config c WHERE c.audio_media_id = m.id OR c.logo_media_id = m.id)`;
}

export interface BrandingInput {
  eventName?: string;
  primaryColor?: string;
  displayBackground?: "dark" | "light";
  fontDisplay?: FontId;
  fontBody?: FontId;
}

/** Lagrer utseende. Verdiene er validert i API-ruten (og av CHECK-regler i databasen). */
export async function updateBranding(b: BrandingInput): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE site_config SET
      event_name = COALESCE(${b.eventName ?? null}, event_name),
      primary_color = COALESCE(${b.primaryColor ?? null}, primary_color),
      display_background = COALESCE(${b.displayBackground ?? null}, display_background),
      font_display = COALESCE(${b.fontDisplay ?? null}, font_display),
      font_body = COALESCE(${b.fontBody ?? null}, font_body),
      updated_at = now()
    WHERE id = 1`;
}

/**
 * «Tilbakestill til standard»: navn, farge, bakgrunn, fonter og logo. Lyd berøres ikke. Overskriften på
 * storskjermen tilbakestilles bare hvis den er laget fra arrangementsnavnet («<navn> · Køstatus»).
 */
export async function resetBranding(): Promise<void> {
  await withConfigLock(async (tx) => {
    await tx`
    UPDATE site_config SET
      display_title = CASE WHEN display_title = event_name || ' · Køstatus' THEN ${DEFAULT_DISPLAY_TITLE} ELSE display_title END,
      event_name = DEFAULT, primary_color = DEFAULT, display_background = DEFAULT,
      font_display = DEFAULT, font_body = DEFAULT, logo_media_id = NULL, updated_at = now()
    WHERE id = 1`;
    await pruneMedia(tx, "logo");
  });
}

export async function setLogo(mime: ImageMime, bytes: Uint8Array): Promise<string> {
  return withConfigLock(async (tx) => {
    const { id, sha256 } = await saveMedia(tx, "logo", mime, bytes);
    await tx`UPDATE site_config SET logo_media_id = ${id}, updated_at = now() WHERE id = 1`;
    await pruneMedia(tx, "logo");
    return sha256;
  });
}

export async function removeLogo(): Promise<void> {
  await withConfigLock(async (tx) => {
    await tx`UPDATE site_config SET logo_media_id = NULL, updated_at = now() WHERE id = 1`;
    await pruneMedia(tx, "logo");
  });
}

export async function setCustomAudio(mime: AudioMime, bytes: Uint8Array): Promise<string> {
  return withConfigLock(async (tx) => {
    const { id, sha256 } = await saveMedia(tx, "audio", mime, bytes);
    await tx`UPDATE site_config SET audio_media_id = ${id}, audio_mode = 'custom', updated_at = now() WHERE id = 1`;
    await pruneMedia(tx, "audio");
    return sha256;
  });
}

export async function removeCustomAudio(): Promise<void> {
  await withConfigLock(async (tx) => {
    await tx`
    UPDATE site_config SET audio_media_id = NULL,
      audio_mode = CASE WHEN audio_mode = 'custom' THEN 'default' ELSE audio_mode END,
      updated_at = now()
    WHERE id = 1`;
    await pruneMedia(tx, "audio");
  });
}

export async function getMedia(sha256: string): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!/^[0-9a-f]{64}$/.test(sha256)) return null;
  const [row] = await getSql()<{ mime: string; bytes: Buffer }[]>`SELECT mime, bytes FROM media WHERE sha256 = ${sha256}`;
  return row ?? null;
}
