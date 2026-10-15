import { expect, test, type Browser, type Page } from "@playwright/test";
import { join, keys, login, phone, resetAll, sql } from "./helpers";

// v1.3 Skjermer: skjermvalg i adressen, overskrift, stengt stasjon med melding, QR med signert lenke og lenkebygger.

test.beforeEach(resetAll);
// Merk: ikke sql.end() her – tilkoblingen i helpers.ts deles av alle testfilene i samme prosess.

async function screen(browser: Browser, path: string): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await page.goto(path);
  return page;
}

async function admin(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  await login(page, "/admin");
  await expect(page.getByRole("heading", { name: "Skjermer" })).toBeVisible();
  return page;
}

test("standard /display er som før: tre stasjoner, overskrift, ingen klokke eller QR", async ({ browser, request, baseURL }) => {
  await join(request, baseURL!, "B");
  const d = await screen(browser, "/display");
  for (const id of ["A", "B", "C"]) await expect(d.getByRole("heading", { name: `Stasjon ${id}` })).toBeVisible();
  await expect(d.getByTestId("display-title")).toHaveText("Meet & Greet · Køstatus");
  await expect(d.getByText("Neste:").first()).toBeVisible();
  await expect(d.getByText("B1")).toBeVisible();
  await expect(d.getByTestId("display-clock")).toHaveCount(0);
  await expect(d.getByTestId("display-qr")).toHaveCount(0);
  await expect(d.getByTestId("closed")).toHaveCount(0);
});

test("én stasjon per vindu med ekstra stort nummer, klokke og lys bakgrunn", async ({ browser, request, baseURL }) => {
  await join(request, baseURL!, "A");
  await sql`UPDATE tickets SET status = 'called' WHERE station = 'A' AND number = 1`;
  const d = await screen(browser, "/display?station=A&size=xl&clock=1&theme=light&next=0");
  await expect(d.getByRole("heading", { name: "Stasjon A" })).toBeVisible();
  await expect(d.getByRole("heading", { name: "Stasjon B" })).toHaveCount(0);
  await expect(d.getByTestId("display-clock")).toHaveText(/^\d{2}[:.]\d{2}$/);
  await expect(d.getByText("Neste:")).toHaveCount(0);
  await expect(d.locator("main")).toHaveAttribute("data-theme", "light");
  // Nummeret fyller skjermen: mye større enn standard (9rem = 144 px).
  const big = d.locator("[data-station=A] [aria-live=polite]");
  const size = await big.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThan(300);
});

test("ugyldige valg gir standard storskjerm, ikke feilside", async ({ browser }) => {
  const d = await screen(browser, "/display?station=Q&size=enorm&next=99&theme=rosa");
  for (const id of ["A", "B", "C"]) await expect(d.getByRole("heading", { name: `Stasjon ${id}` })).toBeVisible();
});

test("stengt stasjon med melding: storskjerm, skann og kølapp", async ({ browser }) => {
  // En gjest står allerede i kø på A.
  const guest = await phone(browser);
  await guest.goto(`/join?station=A&key=${keys.A}`);
  await expect(guest).toHaveURL(/\/ticket\//);

  const a = await admin(browser);
  const card = a.locator(".print-page").filter({ hasText: "Stasjon A" });
  await card.getByRole("button", { name: "Deaktiver" }).click();
  await card.getByLabel(/Melding til publikum/).fill("Tilbake kl. 14.00");
  await card.getByRole("button", { name: "Steng stasjonen" }).click();
  await expect(card.getByText("Stengt", { exact: true })).toBeVisible();

  const d = await screen(browser, "/display");
  const col = d.locator("[data-station=A]");
  await expect(col.getByTestId("closed")).toContainText("Stengt");
  await expect(col.getByText("Tilbake kl. 14.00")).toBeVisible();
  await expect(col.getByText("Neste:")).toHaveCount(0);
  await expect(d.locator("[data-station=B]").getByTestId("closed")).toHaveCount(0);

  await expect(guest.getByTestId("ticket-closed")).toContainText("Du beholder plassen din i køen");
  await expect(guest.getByTestId("ticket-closed")).toContainText("Tilbake kl. 14.00");

  const newGuest = await phone(browser);
  await newGuest.goto(`/join?station=A&key=${keys.A}`);
  await expect(newGuest.getByText("Stasjon A er stengt")).toBeVisible();
  await expect(newGuest.getByText("Tilbake kl. 14.00")).toBeVisible();

  // Endre meldingen mens stengt, og åpne igjen.
  await card.getByLabel("Melding mens stengt").fill("Pause til 13");
  await card.getByRole("button", { name: "Lagre melding" }).click();
  await expect(col.getByText("Pause til 13")).toBeVisible();
  await card.getByRole("button", { name: "Aktiver" }).click();
  await expect(col.getByTestId("closed")).toHaveCount(0);
  await expect(guest.getByTestId("ticket-closed")).toHaveCount(0);
});

test("tom overskrift skjuler topplinjen", async ({ browser }) => {
  const a = await admin(browser);
  await a.getByLabel("Overskrift på storskjerm").fill("");
  await a.getByRole("button", { name: "Lagre overskrift" }).click();
  await expect(a.getByText(/^Lagret\./)).toBeVisible();
  const d = await screen(browser, "/display");
  await expect(d.getByRole("heading", { name: "Stasjon A" })).toBeVisible();
  await expect(d.getByTestId("display-title")).toHaveCount(0);

  await a.getByLabel("Overskrift på storskjerm").fill("Fagdagen 2027");
  await a.getByRole("button", { name: "Lagre overskrift" }).click();
  await expect(d.getByTestId("display-title")).toHaveText("Fagdagen 2027", { timeout: 25_000 });
});

test("lenkebyggeren lager riktig lenke og forhåndsviser", async ({ browser }) => {
  const a = await admin(browser);
  const link = a.getByTestId("display-link");
  await expect(link).toHaveText(/\/display$/);
  await a.getByRole("checkbox", { name: "B", exact: true }).uncheck();
  await a.getByRole("checkbox", { name: "C", exact: true }).uncheck();
  await a.getByLabel("Størrelse på nummeret").selectOption("xl");
  await a.getByRole("checkbox", { name: "Klokke" }).check();
  await expect(link).toHaveText(/\/display\?station=A&size=xl&clock=1$/);
  const preview = a.getByTestId("display-preview");
  await expect(preview.getByRole("heading", { name: "Stasjon A" })).toBeAttached();
  await expect(preview.getByRole("heading", { name: "Stasjon B" })).toHaveCount(0);

  await a.getByText("Én skjerm per stasjon", { exact: true }).click();
  await expect(a.getByTitle(/\/display\?station=C&size=xl&clock=1$/)).toBeVisible();

  await a.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await a.getByTestId("display-link").locator("..").getByRole("button", { name: "Kopier lenke" }).click();
  expect(await a.evaluate(() => navigator.clipboard.readText())).toMatch(/\/display\?station=A&size=xl&clock=1$/);
});

test("QR på storskjermen bare med gyldig signert lenke, og «Bytt nøkkel» gjør den ugyldig", async ({ browser, request }) => {
  expect((await request.get("/api/display/qr?station=A")).status()).toBe(403);
  expect((await request.get("/api/display/qr?station=A&t=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).status()).toBe(403);
  const fake = await screen(browser, "/display?qr=1&t=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await expect(fake.getByTestId("qr-expired")).toBeVisible();
  await expect(fake.getByTestId("display-qr")).toHaveCount(0);

  const a = await admin(browser);
  await a.getByRole("checkbox", { name: "QR-kode for kølapp" }).check();
  await expect(a.getByTestId("qr-warning")).toContainText("kan fotograferes og deles");
  const link = a.getByTestId("display-link");
  await expect(link).toHaveText(/qr=1&t=[A-Za-z0-9_-]{32}$/);
  const url = new URL((await link.textContent())!);
  expect(url.search).not.toContain(keys.A!);

  const d = await screen(browser, url.pathname + url.search);
  await expect(d.getByTestId("display-qr")).toHaveCount(3);
  const svgText = await (await request.get(`/api/display/qr${url.search.replace("qr=1&", "")}`)).text();
  expect(svgText).not.toContain(keys.A!); // nøkkelen finnes bare kodet inne i QR-bildet

  // Bytt nøkkel på A → lenken slutter å virke.
  const card = a.locator(".print-page").filter({ hasText: "Stasjon A" });
  await card.getByRole("button", { name: "Bytt nøkkel" }).click();
  await card.getByRole("button", { name: /Bekreft/ }).click();
  await d.reload();
  await expect(d.getByTestId("qr-expired")).toBeVisible();
  await expect(d.getByTestId("display-qr")).toHaveCount(0);
  // Admin lager automatisk ny signert lenke.
  await expect(link).toHaveText(/qr=1&t=[A-Za-z0-9_-]{32}$/);
  await expect(link).not.toContainText(url.search.split("t=")[1]!);
});
