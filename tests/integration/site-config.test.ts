// Innstillinger og opplastede filer mot ekte Postgres (krever TEST_DATABASE_URL). Sletter data!

import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("innstillinger og mediefiler", () => {
  let cfg: typeof import("@/lib/site-config");
  let sql: import("@/lib/db").Sql;
  const wav = (n: number) => new Uint8Array([..."RIFF"].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [..."WAVE"].map((c) => c.charCodeAt(0)), Array(n).fill(n % 256)));

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
    cfg = await import("@/lib/site-config");
    sql = (await import("@/lib/db")).getSql();
  });

  beforeEach(async () => {
    await sql`UPDATE site_config SET audio_mode = 'default', audio_volume = 80, audio_media_id = NULL, display_title = DEFAULT WHERE id = 1`;
    await sql`DELETE FROM media`;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  it("standard er dagens oppførsel: standardlyd, 80 %", async () => {
    expect(await cfg.getSiteConfig()).toEqual({
      displayTitle: "Meet & Greet · Køstatus",
      audioMode: "default",
      audioVolume: 80,
      audioFile: null,
    });
    expect(cfg.toPublicConfig(await cfg.getSiteConfig())).toEqual({
      audio: { mode: "default", volume: 80, url: null },
      display: { title: "Meet & Greet · Køstatus" },
    });
  });

  it("egen lyd lagres, tas i bruk og gammel fil slettes ved bytte", async () => {
    const first = await cfg.setCustomAudio("audio/wav", wav(10));
    let c = await cfg.getSiteConfig();
    expect(c.audioMode).toBe("custom");
    expect(cfg.toPublicConfig(c).audio.url).toBe(`/api/media/${first}`);
    expect((await cfg.getMedia(first))?.mime).toBe("audio/wav");

    const second = await cfg.setCustomAudio("audio/wav", wav(20));
    c = await cfg.getSiteConfig();
    expect(c.audioFile?.sha256).toBe(second);
    expect(await cfg.getMedia(first)).toBeNull();
    expect((await sql`SELECT count(*)::int AS n FROM media`)[0]!.n).toBe(1);
  });

  it("fjerning går tilbake til standardlyd og sletter filen", async () => {
    const sha = await cfg.setCustomAudio("audio/wav", wav(5));
    await cfg.removeCustomAudio();
    expect(await cfg.getSiteConfig()).toMatchObject({ audioMode: "default", audioFile: null });
    expect(await cfg.getMedia(sha)).toBeNull();
  });

  it("volum og «av» lagres; «egen lyd» uten fil faller tilbake til standard offentlig", async () => {
    await cfg.updateAudioSettings({ volume: 35, mode: "off" });
    expect(cfg.toPublicConfig(await cfg.getSiteConfig()).audio).toEqual({ mode: "off", volume: 35, url: null });
    await sql`UPDATE site_config SET audio_mode = 'custom' WHERE id = 1`;
    expect(cfg.toPublicConfig(await cfg.getSiteConfig()).audio.mode).toBe("default");
  });

  it("ugyldig hash gir ingen fil (ingen SQL med rå input)", async () => {
    expect(await cfg.getMedia("../../etc/passwd")).toBeNull();
    expect(await cfg.getMedia("abc")).toBeNull();
  });

  it("offentlig konfig inneholder ingen hemmeligheter", async () => {
    const json = JSON.stringify(cfg.toPublicConfig(await cfg.getSiteConfig()));
    expect(json).not.toMatch(/join_key|pin|secret|ip_hash/i);
  });

  it("overskrift på storskjermen kan endres og tømmes", async () => {
    await cfg.updateDisplayTitle("Konferansen 2027");
    expect(cfg.toPublicConfig(await cfg.getSiteConfig()).display.title).toBe("Konferansen 2027");
    await cfg.updateDisplayTitle("");
    expect((await cfg.getSiteConfig()).displayTitle).toBe("");
  });
});
