import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";
import { hashPin } from "../../src/lib/pin-hash.mjs";

// Hele brukerreisen i ekte nettleser: QR → kølapp → operatør → storskjerm → admin.

const sql = postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
const keys: Record<string, string> = {};
const PIN = "1234";

test.beforeEach(async () => {
  await sql`DELETE FROM queue_actions`;
  await sql`DELETE FROM tickets`;
  await sql`DELETE FROM rate_limits`;
  // v1.6: tilbake til A, B og C slik de var.
  await sql`DELETE FROM tickets WHERE station NOT IN ('A', 'B', 'C')`;
  await sql`DELETE FROM queue_actions WHERE station NOT IN ('A', 'B', 'C')`;
  await sql`DELETE FROM stations WHERE id NOT IN ('A', 'B', 'C')`;
  await sql`UPDATE stations SET archived_at = NULL, name = '', color = CASE id WHEN 'A' THEN 'sky' WHEN 'B' THEN 'violet' ELSE 'emerald' END, sort_order = ascii(id) - 64`;
  await sql`UPDATE stations SET next_number = 1, generation = generation + 1, active = true, closed_message = ''`;
  await sql`UPDATE settings SET pin_hash = ${await hashPin(PIN)}, pin_version = pin_version + 1`;
  await sql`UPDATE site_config SET audio_mode = 'default', audio_volume = 80, audio_media_id = NULL, display_title = DEFAULT, event_name = DEFAULT, logo_media_id = NULL, primary_color = DEFAULT, display_background = DEFAULT, font_display = DEFAULT, font_body = DEFAULT, allow_leave = DEFAULT, wait_mode = DEFAULT, wait_minutes = DEFAULT WHERE id = 1`;
  await sql`DELETE FROM media`;
  for (const r of await sql<{ id: string; join_key: string }[]>`SELECT id, join_key FROM stations`) keys[r.id] = r.join_key;
});

test.afterAll(async () => {
  await sql.end({ timeout: 5 });
});

async function phone(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  return ctx.newPage();
}

async function login(page: Page, path: string) {
  await page.goto(path);
  await page.getByLabel("PIN-kode").fill(PIN);
  await page.getByRole("button", { name: "Lås opp" }).click();
}

test("publikum får lapp, blir kalt, hoppet over og kalt igjen", async ({ browser }) => {
  const guest = await phone(browser);
  await guest.goto(`/join?station=A&key=${keys.A}`);
  await expect(guest).toHaveURL(/\/ticket\//);
  await expect(guest.getByText("Din plass i køen")).toBeVisible();
  await expect(guest.getByText("A1", { exact: true })).toBeVisible();
  await expect(guest.getByText("Du er nest i køen")).toBeVisible();
  const ticketUrl = guest.url();

  // Samme enhet skanner igjen → samme lapp.
  await guest.goto(`/join?station=A&key=${keys.A}`);
  await expect(guest).toHaveURL(ticketUrl);

  const op = await phone(browser);
  await login(op, "/operator?station=A");
  await expect(op.getByText("1 venter")).toBeVisible();
  await op.getByRole("button", { name: "NESTE" }).click();
  await expect(op.getByText("BETJENES NÅ", { exact: false })).toBeVisible();

  await expect(guest.getByText("Det er din tur!")).toBeVisible();
  await expect(guest.getByText("Gå til stasjon A")).toBeVisible();

  const display = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await display.goto("/display");
  await expect(display.getByText("A1", { exact: true })).toBeVisible();

  await op.getByRole("button", { name: "Hopp over" }).click();
  await expect(guest.getByText("Du ble hoppet over")).toBeVisible();

  await op.getByRole("button", { name: "Sett tilbake i kø" }).click();
  await op.getByRole("button", { name: "NESTE" }).click();
  await expect(guest.getByText("Det er din tur!")).toBeVisible();

  await op.getByRole("button", { name: "NESTE" }).click();
  await expect(guest.getByText("Ferdig – takk for besøket!")).toBeVisible();

  // Angre bringer gjesten tilbake til «din tur», også etter «Ferdig».
  await op.getByRole("button", { name: "Angre siste" }).click();
  await expect(guest.getByText("Det er din tur!")).toBeVisible({ timeout: 25_000 });
});

test("operatør ser nye i køen uten å laste siden på nytt, og riktig tall ved bytte av stasjon", async ({ browser, request }) => {
  const op = await phone(browser);
  await login(op, "/operator?station=A");
  await expect(op.getByText("0 venter")).toBeVisible();
  await expect(op.getByText(/Oppdatert \d/)).toBeVisible();

  // Tre gjester skanner fra andre enheter mens operatørsiden står åpen.
  for (let i = 0; i < 3; i++) {
    const res = await request.post("/api/join", {
      headers: { origin: new URL(op.url()).origin },
      data: { station: "A", key: keys.A, requestId: crypto.randomUUID() },
    });
    expect(res.ok()).toBe(true);
  }
  await expect(op.getByText("3 venter")).toBeVisible({ timeout: 10_000 });
  await expect(op.getByText("A3", { exact: true })).toBeVisible();

  // Bytt til B: aldri A sine tall under overskriften «Stasjon B».
  await op.getByRole("link", { name: "B", exact: true }).click();
  await expect(op.getByRole("heading", { name: "Stasjon B" })).toBeVisible();
  await expect(op.getByText("3 venter")).toHaveCount(0);
  await expect(op.getByText("0 venter")).toBeVisible();

  // «Oppdater»-knappen henter med en gang.
  await request.post("/api/join", {
    headers: { origin: new URL(op.url()).origin },
    data: { station: "B", key: keys.B, requestId: crypto.randomUUID() },
  });
  await op.getByRole("button", { name: "Oppdater nå" }).click();
  await expect(op.getByText("1 venter")).toBeVisible({ timeout: 3_000 });
});

test("operatørsiden henter seg inn igjen selv etter nettbrudd", async ({ browser, request }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const op = await ctx.newPage();
  await login(op, "/operator?station=C");
  await expect(op.getByText("0 venter")).toBeVisible();

  await ctx.setOffline(true);
  await expect(op.getByText("Mistet kontakten – prøver igjen")).toBeVisible({ timeout: 15_000 });

  // En gjest skanner mens operatøren er uten nett.
  await request.post("/api/join", {
    headers: { origin: new URL(op.url()).origin },
    data: { station: "C", key: keys.C, requestId: crypto.randomUUID() },
  });

  await ctx.setOffline(false);
  await expect(op.getByText("1 venter")).toBeVisible({ timeout: 10_000 });
  await expect(op.getByText("Mistet kontakten – prøver igjen")).toHaveCount(0);
});

test("ugyldig og stengt QR gir vennlige meldinger", async ({ browser }) => {
  const guest = await phone(browser);
  await guest.goto("/join?station=A&key=feil");
  await expect(guest.getByText("Ugyldig lenke")).toBeVisible();
  await expect(guest.getByText("Lenken er ikke gyldig. Spør en funksjonær om hjelp.")).toBeVisible();

  await sql`UPDATE stations SET active = false WHERE id = 'B'`;
  await guest.goto(`/join?station=B&key=${keys.B}`);
  await expect(guest.getByText("Stasjon B er stengt")).toBeVisible();

  await guest.goto("/join?station=Q&key=x");
  await expect(guest.getByText("Denne lenken peker ikke på en gyldig stasjon.")).toBeVisible();
});

test("operatør og admin krever PIN, feil PIN avvises", async ({ page }) => {
  await page.goto("/operator?station=A");
  await expect(page.getByRole("button", { name: "Lås opp" })).toBeVisible();
  await page.getByLabel("PIN-kode").fill("9999");
  await page.getByRole("button", { name: "Lås opp" }).click();
  await expect(page.getByText("Feil PIN-kode. Prøv igjen.")).toBeVisible();
  await expect(page.getByRole("button", { name: "NESTE" })).toHaveCount(0);
});

test("admin viser QR, standard-PIN-varsel og «Om appen»; publikum ser ikke utviklerinfo", async ({ page }) => {
  await login(page, "/admin");
  await expect(page.getByRole("heading", { name: "Stasjoner og QR-koder" })).toBeVisible();
  await expect(page.getByLabel("QR-kode for stasjon A")).toBeVisible();
  await expect(page.getByText("Du bruker fortsatt standard-PIN 1234")).toBeVisible();
  await expect(page.getByText("Andreas Aarlott")).toBeVisible();
  await expect(page.getByText("AI-støttet utvikling")).toBeVisible();

  for (const path of ["/", "/display", "/join?station=A&key=feil"]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText("Aarlott");
  }
});

test("offentlig status lekker ingen hemmeligheter og har sikkerhetshoder", async ({ request }) => {
  const res = await request.get("/api/state");
  expect(res.ok()).toBe(true);
  const text = await res.text();
  for (const k of Object.values(keys)) expect(text).not.toContain(k);
  expect(text).not.toMatch(/join_key|pin_hash|session_secret|ip_hash/);
  expect(res.headers()["cdn-cache-control"]).toContain("s-maxage=1");

  const page = await request.get("/");
  expect(page.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(page.headers()["referrer-policy"]).toBe("no-referrer");

  const health = await (await request.get("/api/health")).json();
  expect(health).toMatchObject({ ok: true, db: "ok" });

  // Endring uten riktig Origin avvises.
  const forged = await request.post("/api/join", {
    headers: { origin: "https://ondsinnet.example" },
    data: { station: "A", key: keys.A },
  });
  expect(forged.status()).toBe(403);
});
