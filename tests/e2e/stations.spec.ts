import { expect, test, type Browser, type Page } from "@playwright/test";
import { keys, login, phone, resetAll, soundCount, sql } from "./helpers";

// v1.6 Fritt antall stasjoner: opprette, navn/farge, rekkefølge, arkivere/gjenopprette, og at storskjerm,
// operatør, kølapp og lydside virker med mange stasjoner. Eksisterende A/B/C-tester er uendret.

test.beforeEach(resetAll);

async function admin(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  await login(page, "/admin");
  await expect(cardHeading(page, "Stasjon A")).toBeVisible();
  return page;
}

/** Overskrift på et stasjonskort (forhåndsvisningen i «Skjermer» har også stasjonsoverskrifter). */
const cardHeading = (a: Page, label: string) => a.locator(".print-page").getByRole("heading", { name: label, exact: true });
const card = (a: Page, label: string) => a.locator(".print-page").filter({ has: a.getByRole("heading", { name: label }) });

async function stationKey(id: string) {
  const [r] = await sql<{ join_key: string }[]>`SELECT join_key FROM stations WHERE id = ${id}`;
  return r!.join_key;
}

test("ny stasjon med navn og farge vises på storskjerm, hos operatør, på kølapp og i lydsiden", async ({ browser }) => {
  const a = await admin(browser);
  await a.getByRole("button", { name: /Ny stasjon/ }).click();
  await expect(cardHeading(a, "Stasjon D")).toBeVisible();
  await expect(a.getByText("4 av 12 i bruk")).toBeVisible();

  const d = card(a, "Stasjon D");
  await d.getByRole("button", { name: /Navn, farge og rekkefølge/ }).click();
  await d.getByLabel("Navn").fill("Hovedscenen");
  await d.getByRole("button", { name: "Rød" }).click();
  await d.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(cardHeading(a, "Hovedscenen")).toBeVisible();

  // Kølapp fra den nye QR-koden: nummer D1, navn og farge.
  const guest = await phone(browser);
  await guest.goto(`/join?station=D&key=${await stationKey("D")}`);
  await expect(guest).toHaveURL(/\/ticket\//);
  await expect(guest.getByText("D1", { exact: true })).toBeVisible();
  await expect(guest.getByText("Kølapp · Hovedscenen")).toBeVisible();
  const bg = await guest.locator("main").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgb(255, 241, 242)"); // rose-50

  // Storskjerm: fire kolonner i admin-rekkefølge.
  const screen = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await screen.goto("/display");
  await expect(screen.locator("[data-station]")).toHaveCount(4);
  await expect(screen.locator("[data-station=D]").getByRole("heading")).toHaveText("Hovedscenen");

  // Operatør: D i velgeren, og NESTE kaller D1.
  const op = await (await browser.newContext()).newPage();
  await login(op, "/operator?station=D");
  await expect(op.getByRole("heading", { name: "Hovedscenen" })).toBeVisible();
  await expect(op.getByRole("navigation", { name: "Velg stasjon" }).getByRole("link")).toHaveText(["A", "B", "C", "D"]);
  await op.getByRole("button", { name: "NESTE", exact: true }).click();
  await expect(screen.locator("[data-station=D]").getByText("D1")).toBeVisible();
  await expect(guest.getByText("Det er din tur!")).toBeVisible();
  await expect(guest.getByText("Gå til Hovedscenen (stasjon D)")).toBeVisible();
});

test("7 stasjoner: storskjermen fordeler seg, alle numre synlige, lyd for én stasjon", async ({ browser, request, baseURL }) => {
  const a = await admin(browser);
  for (let i = 0; i < 4; i++) {
    await a.getByRole("button", { name: /Ny stasjon/ }).click();
    await expect(a.getByText(`${4 + i} av 12 i bruk`)).toBeVisible();
  }
  const screen = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await screen.goto("/display");
  await expect(screen.locator("[data-station]")).toHaveCount(7);
  // 4 kolonner: G havner på andre rad, og alt får plass uten rulling på 1600×900.
  const boxes = await screen.locator("[data-station]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  expect(new Set(boxes.slice(0, 4).map((b) => Math.round(b.top))).size).toBe(1);
  expect(boxes[4]!.top).toBeGreaterThan(boxes[0]!.bottom);
  expect(Math.max(...boxes.map((b) => b.bottom))).toBeLessThanOrEqual(900);

  // Lydsiden for G spiller når G kaller, ikke for A.
  const audio = await (await browser.newContext()).newPage();
  await audio.goto("/audio?station=G");
  await audio.getByRole("button", { name: "Start lydsignal" }).click();
  for (const st of ["A", "G"]) {
    await request.post("/api/join", { headers: { origin: baseURL! }, data: { station: st, key: await stationKey(st), requestId: crypto.randomUUID() } });
  }
  await audio.waitForTimeout(3500);
  const op = await (await browser.newContext()).newPage();
  await login(op, "/operator?station=A");
  await op.getByRole("button", { name: "NESTE", exact: true }).click();
  await op.waitForTimeout(4000);
  expect(await soundCount(audio)).toBe(0);
  await op.goto("/operator?station=G");
  await op.getByRole("button", { name: "NESTE", exact: true }).click();
  await expect.poll(() => soundCount(audio), { timeout: 10_000 }).toBe(1);

  // Grense: maks 12.
  for (let i = 0; i < 5; i++) {
    await a.getByRole("button", { name: /Ny stasjon/ }).click();
    await expect(a.getByText(`${8 + i} av 12 i bruk`).or(a.getByText(/Maks 12 stasjoner/))).toBeVisible();
  }
  await expect(a.getByRole("button", { name: /Ny stasjon/ })).toBeDisabled();
});

test("rekkefølge, arkivering (bare med tom kø) og gjenoppretting", async ({ browser, request, baseURL }) => {
  const a = await admin(browser);
  await a.getByRole("button", { name: /Ny stasjon/ }).click();
  const d = card(a, "Stasjon D");
  await expect(d).toBeVisible();

  // Flytt D først.
  await d.getByRole("button", { name: /Navn, farge og rekkefølge/ }).click();
  for (let i = 0; i < 3; i++) await card(a, "Stasjon D").getByRole("button", { name: "Flytt til venstre" }).click();
  await expect(a.locator(".print-page h2")).toHaveText(["Stasjon D", "Stasjon A", "Stasjon B", "Stasjon C"]);
  const screen = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await screen.goto("/display");
  await expect(screen.locator("[data-station]").first()).toHaveAttribute("data-station", "D");

  // Med kø kan stasjonen ikke arkiveres.
  await request.post("/api/join", { headers: { origin: baseURL! }, data: { station: "A", key: keys.A, requestId: crypto.randomUUID() } });
  await a.reload();
  const cardA = card(a, "Stasjon A");
  await cardA.getByRole("button", { name: /Navn, farge og rekkefølge/ }).click();
  await expect(cardA.getByText(/Arkivering krever tom kø \(1 venter\)/)).toBeVisible();

  // D (tom) arkiveres: borte fra storskjerm og admin, QR virker ikke.
  const keyD = await stationKey("D");
  const cardD = card(a, "Stasjon D");
  await cardD.getByRole("button", { name: /Navn, farge og rekkefølge/ }).click();
  await cardD.getByRole("button", { name: "Arkiver stasjon …" }).click();
  await cardD.getByRole("button", { name: "Bekreft – arkiver stasjon D" }).click();
  await expect(cardHeading(a, "Stasjon D")).toHaveCount(0);
  await expect(screen.locator("[data-station=D]")).toHaveCount(0);
  const guest = await phone(browser);
  await guest.goto(`/join?station=D&key=${keyD}`);
  await expect(guest.getByText("Ugyldig lenke")).toBeVisible();

  // Gjenopprett: tilbake sist, med ny QR.
  await a.getByText("Arkiverte stasjoner (1)").click();
  await a.getByRole("button", { name: "Gjenopprett" }).click();
  await expect(cardHeading(a, "Stasjon D")).toBeVisible();
  expect(await stationKey("D")).not.toBe(keyD);
  await expect(a.locator(".print-page h2").last()).toHaveText("Stasjon D");

  // Bokstaven D gjenbrukes aldri: neste nye blir E.
  await a.getByRole("button", { name: /Ny stasjon/ }).click();
  await expect(cardHeading(a, "Stasjon E")).toBeVisible();
});

test("operatør med ukjent stasjon i adressen havner på første aktive", async ({ browser }) => {
  const op = await (await browser.newContext()).newPage();
  await login(op, "/operator?station=Q");
  await expect(op.getByRole("heading", { name: "Stasjon A" })).toBeVisible();
});
