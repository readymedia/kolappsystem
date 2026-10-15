import { expect, test, type Browser } from "@playwright/test";
import { join, keys, login, phone, resetAll, sql } from "./helpers";

// v1.7 Gi fra seg plassen og ventetid i ekte nettleser.

test.beforeEach(resetAll);

async function guest(browser: Browser) {
  const page = await phone(browser);
  await page.goto(`/join?station=A&key=${keys.A}`);
  await expect(page.getByText("Din plass i køen")).toBeVisible();
  return page;
}

test("gjest gir fra seg plassen med bekreftelse, kan angre, og de bak rykker fram", async ({ browser, request, baseURL }) => {
  await join(request, baseURL!, "A"); // A1 foran
  const g = await guest(browser); // A2
  const behind = await guest(browser); // A3
  await expect(behind.getByText("2 personer foran deg")).toBeVisible();

  // «Behold plassen» gjør ingenting.
  await g.getByTestId("leave-link").click();
  await expect(g.getByTestId("leave-confirm")).toContainText("Vil du gi fra deg plassen A2?");
  await expect(g.getByTestId("leave-confirm")).toContainText("1 person foran deg – ca. 2 minutter ventetid.");
  await g.getByRole("button", { name: "Behold plassen" }).click();
  await expect(g.getByText("Din plass i køen")).toBeVisible();

  await g.getByTestId("leave-link").click();
  await g.getByRole("button", { name: "Ja, gi fra meg plassen" }).click();
  await expect(g.getByTestId("ticket-left")).toContainText("Du har gitt fra deg plassen");
  await expect(behind.getByText("1 person foran deg")).toBeVisible();

  // Operatøren ser antallet.
  const op = await (await browser.newContext()).newPage();
  await login(op, "/operator?station=A");
  await expect(op.getByTestId("left-count")).toHaveText("1 har gitt fra seg plassen");

  // Angre: plassen tilbake (ingen er passert).
  await g.getByTestId("leave-undo").click();
  await expect(g.getByText("Din plass i køen")).toBeVisible();
  await expect(g.getByText("A2", { exact: true })).toBeVisible();
  await expect(behind.getByText("2 personer foran deg")).toBeVisible();

  // Gi fra seg på nytt, og la tiden gå ut: ny innlasting viser «gitt fra seg» uten angre.
  await g.getByTestId("leave-link").click();
  await g.getByRole("button", { name: "Ja, gi fra meg plassen" }).click();
  await expect(g.getByTestId("ticket-left")).toBeVisible();
  await sql`UPDATE tickets SET left_at = now() - interval '2 minutes' WHERE status = 'left'`;
  await g.reload();
  await expect(g.getByTestId("ticket-left")).toBeVisible();
  await expect(g.getByTestId("leave-undo")).toHaveCount(0);
});

test("kalt gjest sier fra: operatøren får beskjed og NESTE kaller neste", async ({ browser, request, baseURL }) => {
  const g = await guest(browser); // A1
  await join(request, baseURL!, "A"); // A2
  const op = await (await browser.newContext()).newPage();
  await login(op, "/operator?station=A");
  const next = op.getByRole("button", { name: "NESTE", exact: true });
  await next.click();
  await expect(g.getByText("Det er din tur!")).toBeVisible();

  await g.getByTestId("leave-link").click();
  await expect(g.getByTestId("leave-confirm")).toContainText("Funksjonæren får beskjed");
  await g.getByRole("button", { name: "Ja, gi fra meg plassen" }).click();
  await expect(g.getByTestId("ticket-left")).toBeVisible();

  await expect(op.getByTestId("called-left")).toHaveText("A1 ga fra seg plassen. Trykk NESTE for å kalle neste.");
  await next.click();
  await expect(op.getByText("A2").first()).toBeVisible();
  await expect(op.getByTestId("called-left")).toHaveCount(0);
});

test("admin: av-bryter skjuler valget, og ventetid kan settes fast eller etter tempo", async ({ browser, request, baseURL }) => {
  for (let i = 0; i < 2; i++) await join(request, baseURL!, "A");
  const a = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  await login(a, "/admin");
  const toggle = a.getByRole("switch", { name: "Gjester kan gi fra seg plassen" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  // Fast 5 minutter per person → 2 foran = 10 minutter.
  await a.getByLabel("Minutter per person").fill("5");
  await a.getByLabel("Minutter per person").locator("xpath=following-sibling::button[1]").click();
  await expect(a.getByText("Ventetiden regnes nå med 5 minutter per person.")).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  const g = await phone(browser);
  await g.waitForTimeout(5500); // /api/config og /api/state er kort mellomlagret
  await g.goto(`/join?station=A&key=${keys.A}`);
  await expect(g.getByText("Ca. 10 minutter")).toBeVisible();
  await expect(g.getByTestId("leave-link")).toHaveCount(0);

  // API-et avviser også når det er av.
  const id = new URL(g.url()).pathname.split("/").pop();
  expect((await request.post(`/api/tickets/${id}/leave`, { headers: { origin: baseURL! } })).status()).toBe(409);

  // Faktisk tempo: uten nok opprop brukes det faste tallet (5 min).
  await a.getByLabel("Faktisk tempo ved hver stasjon").check();
  await expect(a.getByText("Faktisk tempo brukes.")).toBeVisible();
  await expect(a.getByTestId("pace")).toContainText("Stasjon A 5 min");
});

test("API: andres lapp krever lapp-id, fremmed Origin avvises", async ({ request, baseURL }) => {
  expect((await request.post("/api/tickets/00000000-0000-4000-8000-000000000000/leave", { headers: { origin: baseURL! } })).status()).toBe(404);
  expect((await request.post("/api/tickets/00000000-0000-4000-8000-000000000000/leave", { headers: { origin: "https://evil.example" } })).status()).toBe(403);
});
