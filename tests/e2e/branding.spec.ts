import { expect, test, type Browser, type Page } from "@playwright/test";
import { keys, login, phone, resetAll, resetBrandingViaApi } from "./helpers";

// v1.4 Utseende: standard er uendret, logo/navn/farge/font slår igjennom overalt, SVG-vern og tilgang.

test.beforeEach(async ({ request, baseURL }) => {
  await resetAll();
  await resetBrandingViaApi(request, baseURL!);
});
// Merk: ikke sql.end() her – tilkoblingen i helpers.ts deles av alle testfilene i samme prosess.

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function utseende(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1100 } })).newPage();
  await login(page, "/admin/utseende");
  await expect(page.getByRole("heading", { name: "Utseende" })).toBeVisible();
  return page;
}

const style = (page: Page, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

test("uten innstillinger er utseendet som før (farge, fonter, ingen logo)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Meet & Greet", { exact: true })).toBeVisible();
  await expect(page.getByTestId("brand-logo")).toHaveCount(0);
  expect(await style(page, "h1", "font-family")).toMatch(/^"Space Grotesk Variable"/);
  expect(await style(page, "body", "font-family")).toMatch(/^"Inter Variable"/);
  const button = page.getByRole("link", { name: "Storskjerm" });
  expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(15, 23, 42)");
  expect(await button.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");
  await expect(page).toHaveTitle("Kølapp – Meet & Greet");
  await page.goto("/display");
  await expect(page.locator("main")).toHaveAttribute("data-theme", "dark");
  await expect(page).toHaveTitle("Storskjerm – Meet & Greet");
});

test("logo, navn, farge, font og bakgrunn slår igjennom på forside, kølapp, skann og storskjerm", async ({ browser }) => {
  const a = await utseende(browser);
  await a.getByTestId("logo-input").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(a.getByText("Logoen er lastet opp og i bruk.")).toBeVisible();
  await a.getByLabel("Arrangementsnavn").fill("Fagdagen 2027");
  await expect(a.getByLabel(/Bruk også som overskrift på storskjermen/)).toBeChecked();
  await a.locator("#primary-text").fill("#2563eb");
  await a.getByLabel("Font for overskrifter og nummer").selectOption("manrope");
  await a.getByLabel("Lys").check();
  await expect(a.getByTestId("branding-preview").locator("main")).toHaveAttribute("data-theme", "light");
  await a.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(a.getByText(/^Lagret\./)).toBeVisible();

  const home = await (await browser.newContext()).newPage();
  await home.goto("/");
  await expect(home.getByText("Fagdagen 2027", { exact: true })).toBeVisible();
  await expect(home.getByTestId("brand-logo")).toBeVisible();
  expect(await style(home, "h1", "font-family")).toMatch(/^"Manrope Variable"/);
  const button = home.getByRole("link", { name: "Storskjerm" });
  expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(37, 99, 235)");
  await expect(home).toHaveTitle("Kølapp – Fagdagen 2027");

  const guest = await phone(browser);
  await guest.goto(`/join?station=A&key=${keys.A}`);
  await expect(guest).toHaveURL(/\/ticket\//);
  await expect(guest.getByTestId("brand-logo")).toBeVisible();

  const display = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await display.goto("/display");
  await expect(display.locator("main")).toHaveAttribute("data-theme", "light");
  await expect(display.getByTestId("brand-logo")).toBeVisible();
  await expect(display.getByTestId("display-title")).toHaveText("Fagdagen 2027 · Køstatus");
  // Skjermlenke med eget tema overstyrer.
  await display.goto("/display?theme=dark");
  await expect(display.locator("main")).toHaveAttribute("data-theme", "dark");

  // Logoen serveres med sandbox-CSP og evig mellomlagring.
  const src = await display.getByTestId("brand-logo").getAttribute("src");
  const res = await display.request.get(src!);
  expect(res.headers()["content-security-policy"]).toContain("sandbox");
  expect(res.headers()["cache-control"]).toContain("immutable");
  expect(res.headers()["cdn-cache-control"]).toContain("immutable");

  // «Om appen» er fortsatt bare i admin.
  await expect(home.getByText("Andreas Aarlott")).toHaveCount(0);

  // Tilbakestill fjerner alt, også logoen.
  await a.getByRole("button", { name: "Tilbakestill til standard" }).click();
  await a.getByRole("button", { name: /Bekreft – fjerner også logo/ }).click();
  await expect(a.getByText("Tilbakestilt til standard utseende.")).toBeVisible();
  await home.reload();
  await expect(home.getByText("Meet & Greet", { exact: true })).toBeVisible();
  await expect(home.getByTestId("brand-logo")).toHaveCount(0);
  expect((await display.request.get(src!)).status()).toBe(404);
  await display.reload();
  await expect(display.getByTestId("display-title")).toHaveText("Meet & Greet · Køstatus");
});

test("storskjermen får nytt navn og logo uten å lastes på nytt", async ({ browser }) => {
  const display = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await display.goto("/display");
  await expect(display.getByRole("heading", { name: "Stasjon A" })).toBeVisible();
  const a = await utseende(browser);
  await a.getByTestId("logo-input").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(a.getByText("Logoen er lastet opp og i bruk.")).toBeVisible();
  await expect(display.getByTestId("brand-logo")).toBeVisible({ timeout: 25_000 });
});

test("farlig SVG, feil filtype og lav kontrast håndteres", async ({ browser }) => {
  const a = await utseende(browser);
  await a.getByTestId("logo-input").setInputFiles({
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>'),
  });
  await expect(a.getByText(/SVG-filen inneholder skript/)).toBeVisible();
  await a.getByTestId("logo-input").setInputFiles({ name: "logo.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a...........") });
  await expect(a.getByText("Filtypen støttes ikke.")).toBeVisible();
  await a.locator("#primary-text").fill("#7a7a7a");
  await expect(a.getByText(/Lav kontrast/)).toBeVisible();
  // Opplasting av logo skal ikke kaste ulagrede endringer i skjemaet.
  await a.getByTestId("logo-input").setInputFiles({
    name: "ok.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#2563eb"/></svg>'),
  });
  await expect(a.getByText("Logoen er lastet opp og i bruk.")).toBeVisible();
  await expect(a.locator("#primary-text")).toHaveValue("#7a7a7a");
  await expect(a.getByRole("button", { name: "Lagre", exact: true })).toBeEnabled();
});

test("utseende-API krever økt og riktig Origin", async ({ request, baseURL }) => {
  const anon = await request.put("/api/admin/branding", { headers: { origin: baseURL! }, data: { eventName: "x" } });
  expect(anon.status()).toBe(401);
  const logo = await request.post("/api/admin/logo", { headers: { origin: baseURL! }, multipart: { file: { name: "l.png", mimeType: "image/png", buffer: PNG } } });
  expect(logo.status()).toBe(401);
  const foreign = await request.delete("/api/admin/branding", { headers: { origin: "https://evil.example" } });
  expect(foreign.status()).toBe(403);
  const page = await (await request.get("/admin/utseende")).text();
  expect(page).toContain("PIN");
});
