import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { startMockPush, type MockPush } from "../push-mock";
import { join, keys, login, resetAll, sql } from "./helpers";

// v1.5 Push-varsel: av som standard og usynlig, slå på i admin, abonnere, varsel ved NESTE, service worker,
// iPhone-veiviser og manifest per lapp. Push-tjenesten erstattes av en lokal mottaker (samme kryptering).

let mock: MockPush;
test.beforeAll(async () => {
  mock = await startMockPush(3299);
});
test.afterAll(async () => {
  await mock.close();
});
test.beforeEach(async () => {
  await resetAll();
  await sql`UPDATE site_config SET push_enabled = false WHERE id = 1`;
  await sql`DELETE FROM push_subscriptions`;
  mock.received.length = 0;
  mock.status = 201;
});

/** Erstatter nettleserens push-abonnement (Chromium uten Google-nøkler kan ikke abonnere) med testmottakerens. */
async function phoneWithPush(browser: Browser, name: string): Promise<{ ctx: BrowserContext; page: Page; decrypt: (b: Buffer) => unknown }> {
  const sub = mock.subscription(name);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.grantPermissions(["notifications"]);
  await ctx.addInitScript((s) => {
    const fake = {
      endpoint: s.endpoint,
      options: { applicationServerKey: null },
      toJSON: () => ({ endpoint: s.endpoint, keys: s.keys }),
      unsubscribe: async () => true,
    };
    // Som i en ekte nettleser overlever abonnementet ny innlasting.
    const KEY = "e2e_fake_push";
    PushManager.prototype.subscribe = async function () {
      localStorage.setItem(KEY, "1");
      return fake as unknown as PushSubscription;
    };
    PushManager.prototype.getSubscription = async function () {
      return (localStorage.getItem(KEY) ? fake : null) as unknown as PushSubscription | null;
    };
  }, { endpoint: sub.endpoint, keys: sub.keys });
  return { ctx, page: await ctx.newPage(), decrypt: sub.decrypt };
}

async function enablePush(browser: Browser) {
  const a = await (await browser.newContext()).newPage();
  await login(a, "/admin");
  const toggle = a.getByRole("switch", { name: "Push-varsler på kølappen" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(a.getByText(/Push-varsler er slått på/)).toBeVisible();
  return a;
}

const kinds = (decrypt: (b: Buffer) => unknown) => mock.received.map((r) => (decrypt(r.body) as { kind: string }).kind);

test("av som standard: ingen knapp, ingen veiviser, ingenting sendes", async ({ browser }) => {
  const { page } = await phoneWithPush(browser, "av");
  await page.goto(`/join?station=A&key=${keys.A}`);
  await expect(page.getByText("Din plass i køen")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("push-enable")).toHaveCount(0);
  await expect(page.getByText(/Varsle meg/)).toHaveCount(0);

  const iphone = await (await browser.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  })).newPage();
  await iphone.goto(page.url());
  await expect(iphone.getByText("Din plass i køen")).toBeVisible();
  await iphone.waitForTimeout(1500);
  await expect(iphone.getByTestId("push-ios-guide")).toHaveCount(0);
  expect(mock.received).toHaveLength(0);
});

test("slå på i admin → «Varsle meg» → bekreftelse, «nest i køen» og «din tur» kommer fram", async ({ browser, request, baseURL }) => {
  const admin = await enablePush(browser);
  await join(request, baseURL!, "A"); // A1 foran
  const { page, decrypt } = await phoneWithPush(browser, "gjest");
  await page.goto(`/join?station=A&key=${keys.A}`);
  await expect(page.getByText("A2")).toBeVisible();
  await page.getByTestId("push-enable").click();
  await expect(page.getByTestId("push-on")).toContainText("Varsel er på");
  await expect.poll(() => kinds(decrypt)).toEqual(["welcome"]);

  // Lappen husker at varsel er på, og det kan slås av og på igjen.
  await page.reload();
  await expect(page.getByTestId("push-on")).toBeVisible();
  await page.getByRole("button", { name: "Slå av varsel" }).click();
  await expect(page.getByTestId("push-enable")).toBeVisible();
  expect((await sql`SELECT 1 FROM push_subscriptions`).length).toBe(0);
  await page.getByTestId("push-enable").click();
  await expect(page.getByTestId("push-on")).toBeVisible();
  await expect.poll(() => kinds(decrypt)).toEqual(["welcome", "welcome"]);
  mock.received.splice(0);

  await admin.reload();
  await expect(admin.getByTestId("push-subscribers")).toHaveText("1 gjest i kø har varsel på nå.");

  // Operatør trykker NESTE: A1 kalles → A2 er nest. Neste trykk: A2 kalles.
  const op = await (await browser.newContext()).newPage();
  await login(op, "/operator?station=A");
  const next = op.getByRole("button", { name: "NESTE", exact: true });
  await next.click();
  await expect.poll(() => kinds(decrypt)).toEqual(["next"]);
  const t0 = Date.now();
  await next.click();
  await expect(op.getByText("A2").first()).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(3000); // operatøren venter ikke på push
  await expect.poll(() => kinds(decrypt)).toEqual(["next", "called"]);
  const called = decrypt(mock.received[1]!.body) as { title: string; body: string; url: string };
  expect(called.title).toBe("Det er din tur! A2");
  expect(called.body).toBe("Gå til stasjon A nå.");
  expect(called.url).toMatch(/^\/ticket\//);
});

test("service workeren viser varselet med riktig innhold", async ({ browser }) => {
  await enablePush(browser);
  const { ctx, page } = await phoneWithPush(browser, "sw");
  await page.goto(`/join?station=A&key=${keys.A}`);
  await expect(page.getByText("Din plass i køen")).toBeVisible();
  await page.getByTestId("push-enable").click();
  await expect(page.getByTestId("push-on")).toBeVisible();

  const cdp = await ctx.newCDPSession(page);
  const regId = new Promise<string>((resolve) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", (e: { registrations: { registrationId: string; scopeURL: string }[] }) => {
      const r = e.registrations.find((x) => x.scopeURL.endsWith("/"));
      if (r) resolve(r.registrationId);
    });
  });
  await cdp.send("ServiceWorker.enable");
  const origin = new URL(page.url()).origin;
  const ticketPath = new URL(page.url()).pathname;
  // Fang opp showNotification i service workeren. (Headless Chromium i CI viser ikke selve varselet,
  // så vi sjekker at vår kode ber om riktig varsel – visningen er nettleserens ansvar.)
  const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  await worker.evaluate(() => {
    const g = self as unknown as { __shown: unknown[]; registration: ServiceWorkerRegistration };
    g.__shown = [];
    const original = g.registration.showNotification.bind(g.registration);
    g.registration.showNotification = (title: string, options?: NotificationOptions) => {
      g.__shown.push({ title, body: options?.body, url: (options?.data as { url: string }).url, tag: options?.tag, requireInteraction: options?.requireInteraction });
      return original(title, options).catch(() => undefined);
    };
  });
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin,
    registrationId: await regId,
    data: JSON.stringify({ title: "Det er din tur! A1", body: "Gå til stasjon A nå.", url: ticketPath, tag: "t", kind: "called" }),
  });
  await expect
    .poll(() => worker.evaluate(() => (self as unknown as { __shown: unknown[] }).__shown))
    .toEqual([{ title: "Det er din tur! A1", body: "Gå til stasjon A nå.", url: ticketPath, tag: "t", requireInteraction: true }]);
});

test("iPhone i Safari: veiviser for Hjem-skjerm og eget manifest som åpner riktig lapp", async ({ browser }) => {
  await enablePush(browser);
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  // Safari i nettleserfane har ikke PushManager.
  await ctx.addInitScript(() => {
    // @ts-expect-error – fjernes bevisst for å etterligne Safari
    delete window.PushManager;
  });
  const page = await ctx.newPage();
  await page.goto(`/join?station=A&key=${keys.A}`);
  await expect(page.getByText("Din plass i køen")).toBeVisible();
  const guide = page.getByTestId("push-ios-guide");
  await guide.getByRole("button", { name: /Vil du få varsel på iPhone/ }).click();
  await expect(guide).toContainText("Legg til på Hjem-skjerm");
  await expect(page.getByTestId("push-enable")).toHaveCount(0);

  const id = new URL(page.url()).pathname.split("/").pop()!;
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe(`/ticket/${id}/manifest.webmanifest`);
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest).toMatchObject({ start_url: `/ticket/${id}`, display: "standalone" });
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute("href")).toBe("/apple-touch-icon.png");
  expect((await page.request.get("/apple-touch-icon.png")).status()).toBe(200);
});

test("blokkerte varsler gir rolig beskjed; av igjen i admin fjerner knappen", async ({ browser }) => {
  const admin = await enablePush(browser);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "denied" }));
  const page = await ctx.newPage();
  await page.goto(`/join?station=A&key=${keys.A}`);
  await expect(page.getByTestId("push-denied")).toContainText("Varsler er blokkert");

  await admin.getByRole("switch", { name: "Push-varsler på kølappen" }).click();
  await expect(admin.getByText(/Push-varsler er slått av/)).toBeVisible();
  const { page: other } = await phoneWithPush(browser, "etter");
  await other.goto(`/join?station=A&key=${keys.A}`);
  await expect(other.getByText("Din plass i køen")).toBeVisible();
  await other.waitForTimeout(6500); // /api/config er mellomlagret i inntil 5 s på CDN
  await other.reload();
  await expect(other.getByText("Din plass i køen")).toBeVisible();
  await other.waitForTimeout(1000);
  await expect(other.getByTestId("push-enable")).toHaveCount(0);
});

test("API-et: ukjent push-adresse avvises, sw.js mellomlagres aldri", async ({ request, baseURL }) => {
  await sql`UPDATE site_config SET push_enabled = true WHERE id = 1`;
  const res = await request.post("/api/join", { headers: { origin: baseURL! }, data: { station: "A", key: keys.A, requestId: crypto.randomUUID() } });
  const { ticketId } = await res.json();
  const bad = await request.post(`/api/tickets/${ticketId}/push`, {
    headers: { origin: baseURL! },
    data: { endpoint: "https://evil.example/x", keys: { p256dh: "B" + "A".repeat(86), auth: "a".repeat(22) } },
  });
  expect(bad.status()).toBe(400);
  const foreign = await request.post(`/api/tickets/${ticketId}/push`, { headers: { origin: "https://evil.example" }, data: {} });
  expect(foreign.status()).toBe(403);
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
});
