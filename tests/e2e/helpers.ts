// Felles hjelpere for E2E-testene. Testene sletter data i databasen E2E_DATABASE_URL peker på.

import type { APIRequestContext, Browser, Page } from "@playwright/test";
import postgres from "postgres";
import { hashPin } from "../../src/lib/pin-hash.mjs";

export const PIN = "1234";
export const sql = postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
export const keys: Record<string, string> = {};

export async function resetAll() {
  await sql`DELETE FROM queue_actions`;
  await sql`DELETE FROM tickets`;
  await sql`DELETE FROM rate_limits`;
  await sql`UPDATE stations SET next_number = 1, generation = generation + 1, active = true, closed_message = ''`;
  await sql`UPDATE settings SET pin_hash = ${await hashPin(PIN)}, pin_version = pin_version + 1`;
  await sql`UPDATE site_config SET audio_mode = 'default', audio_volume = 80, audio_media_id = NULL, display_title = DEFAULT WHERE id = 1`;
  await sql`DELETE FROM media`;
  for (const r of await sql<{ id: string; join_key: string }[]>`SELECT id, join_key FROM stations`) keys[r.id] = r.join_key;
}

export async function phone(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  return ctx.newPage();
}

export async function login(page: Page, path: string) {
  await page.goto(path);
  await page.getByLabel("PIN-kode").fill(PIN);
  await page.getByRole("button", { name: "Lås opp" }).click();
}

export async function join(request: APIRequestContext, baseURL: string, station: "A" | "B" | "C") {
  const res = await request.post("/api/join", {
    headers: { origin: baseURL },
    data: { station, key: keys[station], requestId: crypto.randomUUID() },
  });
  if (!res.ok()) throw new Error(`join feilet: ${res.status()}`);
}

/** Gyldig WAV: 0,25 s 440 Hz sinus, 8 kHz mono 16-bit – kan dekodes av nettleseren. */
export function makeWav(seconds = 0.25, rate = 8000): Buffer {
  const n = Math.floor(seconds * rate);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

export const soundCount = (page: Page) => page.evaluate(() => Number(document.documentElement.dataset.soundCount ?? 0));
export const soundLast = (page: Page) => page.evaluate(() => document.documentElement.dataset.soundLast ?? "");
