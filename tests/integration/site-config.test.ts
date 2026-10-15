// Innstillinger og opplastede filer mot ekte Postgres (krever TEST_DATABASE_URL). Sletter data!

import { execFileSync } from "node:child_process";
import { DEFAULT_BRANDING } from "@/lib/branding";
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
    await sql`UPDATE site_config SET audio_mode = 'default', audio_volume = 80, audio_media_id = NULL, display_title = DEFAULT, event_name = DEFAULT, logo_media_id = NULL, primary_color = DEFAULT, display_background = DEFAULT, font_display = DEFAULT, font_body = DEFAULT WHERE id = 1`;
    await sql`DELETE FROM media`;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  it("standard er dagens oppførsel: standardlyd, 80 %", async () => {
    expect(await cfg.getSiteConfig()).toEqual(cfg.DEFAULT_CONFIG);
    expect(cfg.DEFAULT_CONFIG).toMatchObject({ displayTitle: "Meet & Greet · Køstatus", audioMode: "default", audioVolume: 80, audioFile: null });
    expect(cfg.toPublicConfig(await cfg.getSiteConfig())).toEqual({
      audio: { mode: "default", volume: 80, url: null },
      display: { title: "Meet & Greet · Køstatus" },
      brand: DEFAULT_BRANDING,
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

  const png = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(n).fill(n % 256)]);

  it("utseende lagres, leses og tilbakestilles uten å røre lyd og overskrift", async () => {
    await cfg.updateBranding({ eventName: "Fagdag 2027", primaryColor: "#2563eb", displayBackground: "light", fontDisplay: "manrope", fontBody: "atkinson" });
    await cfg.updateDisplayTitle("Min overskrift");
    await cfg.updateAudioSettings({ volume: 40 });
    const brand = cfg.toPublicConfig(await cfg.getSiteConfig()).brand;
    expect(brand).toEqual({ eventName: "Fagdag 2027", logoUrl: null, primaryColor: "#2563eb", displayBackground: "light", fontDisplay: "manrope", fontBody: "atkinson" });
    // Delvis oppdatering endrer bare det som sendes.
    await cfg.updateBranding({ eventName: "" });
    expect((await cfg.getSiteConfig()).primaryColor).toBe("#2563eb");
    expect((await cfg.getSiteConfig()).eventName).toBe("");
    await cfg.resetBranding();
    const c = await cfg.getSiteConfig();
    expect(cfg.toBranding(c)).toEqual(DEFAULT_BRANDING);
    expect(c.displayTitle).toBe("Min overskrift");
    expect(c.audioVolume).toBe(40);
  });

  it("«Tilbakestill» tar med overskriften bare når den er laget fra arrangementsnavnet", async () => {
    await cfg.updateBranding({ eventName: "Fagdag" });
    await cfg.updateDisplayTitle("Fagdag · Køstatus");
    await cfg.resetBranding();
    expect((await cfg.getSiteConfig()).displayTitle).toBe("Meet & Greet · Køstatus");
  });

  it("databasen avviser ugyldig farge og bakgrunn", async () => {
    await expect(sql`UPDATE site_config SET primary_color = 'red' WHERE id = 1`).rejects.toThrow();
    await expect(sql`UPDATE site_config SET display_background = 'blue' WHERE id = 1`).rejects.toThrow();
  });

  it("ukjent font i databasen gir standard i stedet for feil", async () => {
    await sql`UPDATE site_config SET font_display = 'comic-sans' WHERE id = 1`;
    expect((await cfg.getSiteConfig()).fontDisplay).toBe("space-grotesk");
  });

  it("logo erstattes, gammel slettes, og lyd og logo sletter aldri hverandre", async () => {
    const audio = await cfg.setCustomAudio("audio/wav", wav(20));
    const first = await cfg.setLogo("image/png", png(10));
    expect(cfg.toBranding(await cfg.getSiteConfig()).logoUrl).toBe(`/api/media/${first}`);
    expect(await cfg.getMedia(audio)).not.toBeNull();
    const second = await cfg.setLogo("image/png", png(11));
    expect(await cfg.getMedia(first)).toBeNull();
    expect(await cfg.getMedia(second)).not.toBeNull();
    // Ny lyd skal ikke slette logoen (feil før v1.4: oppryddingen så bare på lyd).
    await cfg.setCustomAudio("audio/wav", wav(21));
    expect(await cfg.getMedia(second)).not.toBeNull();
    await cfg.removeLogo();
    expect(await cfg.getMedia(second)).toBeNull();
    expect((await cfg.getSiteConfig()).audioFile).not.toBeNull();
  });

  it("samtidige opplastinger og tilbakestilling gir aldri feil eller foreldreløse filer", async () => {
    const jobs: Promise<unknown>[] = [];
    for (let i = 0; i < 6; i++) jobs.push(cfg.setLogo("image/png", png(30 + i)));
    jobs.push(cfg.resetBranding(), cfg.removeLogo(), cfg.setCustomAudio("audio/wav", wav(40)));
    await Promise.all(jobs);
    const [row] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM media m
      WHERE NOT EXISTS (SELECT 1 FROM site_config c WHERE c.audio_media_id = m.id OR c.logo_media_id = m.id)`;
    expect(row?.n).toBe(0);
  });

  it("«Tilbakestill» fjerner logoen", async () => {
    const sha = await cfg.setLogo("image/png", png(12));
    await cfg.resetBranding();
    expect(await cfg.getMedia(sha)).toBeNull();
    expect((await cfg.getSiteConfig()).logoFile).toBeNull();
  });
});
