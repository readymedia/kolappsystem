import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "./db";
import type { AudioMime } from "./media";

// Innstillinger som kan endres i /admin (tabellen site_config) og opplastede filer (tabellen media).
// Offentlige deler leveres via /api/config. Ingen hemmeligheter her.

export type AudioMode = "default" | "custom" | "off";

export interface SiteConfig {
  audioMode: AudioMode;
  audioVolume: number;
  audioFile: { sha256: string; mime: string; size: number } | null;
}

/** Det publikum (lydside, storskjerm) trenger. Mellomlagres på CDN. */
export interface PublicConfig {
  audio: { mode: AudioMode; volume: number; url: string | null };
}

export const DEFAULT_CONFIG: SiteConfig = { audioMode: "default", audioVolume: 80, audioFile: null };

interface ConfigRow {
  audio_mode: AudioMode;
  audio_volume: number;
  audio_sha256: string | null;
  audio_mime: string | null;
  audio_size: number | null;
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const [row] = await getSql()<ConfigRow[]>`
    SELECT c.audio_mode, c.audio_volume, m.sha256 AS audio_sha256, m.mime AS audio_mime, m.size AS audio_size
    FROM site_config c LEFT JOIN media m ON m.id = c.audio_media_id
    WHERE c.id = 1`;
  if (!row) return DEFAULT_CONFIG;
  return {
    audioMode: row.audio_mode,
    audioVolume: row.audio_volume,
    audioFile: row.audio_sha256 ? { sha256: row.audio_sha256, mime: row.audio_mime!, size: row.audio_size! } : null,
  };
}

export function toPublicConfig(c: SiteConfig): PublicConfig {
  // «Egen lyd» uten fil faller tilbake til standardlyden.
  const mode: AudioMode = c.audioMode === "custom" && !c.audioFile ? "default" : c.audioMode;
  return {
    audio: { mode, volume: c.audioVolume, url: mode === "custom" && c.audioFile ? `/api/media/${c.audioFile.sha256}` : null },
  };
}

export async function updateAudioSettings(input: { mode?: AudioMode; volume?: number }): Promise<void> {
  const sql = getSql();
  if (input.mode !== undefined) await sql`UPDATE site_config SET audio_mode = ${input.mode}, updated_at = now() WHERE id = 1`;
  if (input.volume !== undefined) await sql`UPDATE site_config SET audio_volume = ${input.volume}, updated_at = now() WHERE id = 1`;
}

/** Lagrer (eller gjenbruker) en fil og returnerer id og sha256. Samme innhold lagres bare én gang. */
async function saveMedia(kind: "audio" | "logo", mime: string, bytes: Uint8Array): Promise<{ id: string; sha256: string }> {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const [row] = await getSql()<{ id: string }[]>`
    INSERT INTO media (kind, mime, bytes, size, sha256)
    VALUES (${kind}, ${mime}, ${buf}, ${bytes.byteLength}, ${sha256})
    ON CONFLICT (sha256) DO UPDATE SET mime = EXCLUDED.mime
    RETURNING id`;
  return { id: row!.id, sha256 };
}

/** Sletter filer av en type som ingen innstilling peker på lenger. */
async function pruneMedia(kind: "audio" | "logo"): Promise<void> {
  await getSql()`
    DELETE FROM media m
    WHERE m.kind = ${kind}
      AND NOT EXISTS (SELECT 1 FROM site_config c WHERE c.audio_media_id = m.id)`;
}

export async function setCustomAudio(mime: AudioMime, bytes: Uint8Array): Promise<string> {
  const { id, sha256 } = await saveMedia("audio", mime, bytes);
  await getSql()`UPDATE site_config SET audio_media_id = ${id}, audio_mode = 'custom', updated_at = now() WHERE id = 1`;
  await pruneMedia("audio");
  return sha256;
}

export async function removeCustomAudio(): Promise<void> {
  await getSql()`
    UPDATE site_config SET audio_media_id = NULL,
      audio_mode = CASE WHEN audio_mode = 'custom' THEN 'default' ELSE audio_mode END,
      updated_at = now()
    WHERE id = 1`;
  await pruneMedia("audio");
}

export async function getMedia(sha256: string): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!/^[0-9a-f]{64}$/.test(sha256)) return null;
  const [row] = await getSql()<{ mime: string; bytes: Buffer }[]>`SELECT mime, bytes FROM media WHERE sha256 = ${sha256}`;
  return row ?? null;
}
