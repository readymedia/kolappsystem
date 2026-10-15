import { expect, test } from "@playwright/test";
import { join, keys, login, phone, resetAll, sql } from "./helpers";

// v1.8 Kø-innsikt i ekte nettleser: se køen før lapp, køinfo på storskjerm, klokkeslett,
// sluttid/kapasitet, rapport og «Nullstill alle køer».

test.beforeEach(resetAll);

/** «HH:MM» i norsk tid, minutter fra nå. */
async function osloIn(minutes: number) {
  const [r] = await sql<{ t: string }[]>`
    SELECT to_char((now() AT TIME ZONE 'Europe/Oslo') + make_interval(mins => ${minutes}), 'HH24:MI') AS t`;
  return r!.t;
}

test("standard: skann gir lapp direkte (som før)", async ({ browser }) => {
  const g = await phone(browser);
  await g.goto(`/join?station=A&key=${keys.A}`);
  await expect(g.getByText("Din plass i køen")).toBeVisible();
  await expect(g.getByTestId("join-preview")).toHaveCount(0);
});

test("se køen før lapp: «Ikke nå» lager ingen lapp, «Ta kølapp» gjør", async ({ browser, request, baseURL }) => {
  await sql`UPDATE site_config SET confirm_join = true WHERE id = 1`;
  await join(request, baseURL!, "A");
  await join(request, baseURL!, "A");
  const g = await phone(browser);
  await g.goto(`/join?station=A&key=${keys.A}`);
  await expect(g.getByTestId("join-preview")).toContainText("2 personer foran deg");
  await expect(g.getByTestId("join-preview")).toContainText("Ca. 4 minutter");
  await g.getByRole("button", { name: "Ikke nå" }).click();
  await expect(g.getByText("Greit!")).toBeVisible();
  const [{ n }] = (await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM tickets`) as unknown as [{ n: number }];
  expect(n).toBe(2);

  await g.goto(`/join?station=A&key=${keys.A}`);
  await g.getByRole("button", { name: "Ta kølapp" }).click();
  await expect(g.getByText("Din plass i køen")).toBeVisible();
  await expect(g.getByText("A3", { exact: true })).toBeVisible();
  // Har allerede lapp: rett til lappen, uten forhåndsvisning.
  await g.goto(`/join?station=A&key=${keys.A}`);
  await expect(g.getByText("A3", { exact: true })).toBeVisible();
  await expect(g.getByTestId("join-preview")).toHaveCount(0);
});

test("ventetid som klokkeslett på lappen, og køinfo på storskjermen", async ({ browser, request, baseURL }) => {
  await sql`UPDATE site_config SET wait_display = 'clock' WHERE id = 1`;
  for (let i = 0; i < 5; i++) await join(request, baseURL!, "A");
  const g = await phone(browser);
  await g.goto(`/join?station=A&key=${keys.A}`);
  await expect(g.getByText(/Din tur ca\. kl\. \d\d:\d\d/)).toBeVisible();

  const screen = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await screen.goto("/display");
  await expect(screen.getByTestId("queue-info")).toHaveCount(0); // av som standard
  await screen.goto("/display?info=1");
  await expect(screen.getByTestId("queue-info").first()).toHaveText(/6 i kø · ca\. kl\. \d\d:\d\d/);
  await sql`UPDATE site_config SET wait_display = 'duration' WHERE id = 1`;
  await screen.reload();
  await expect(screen.getByTestId("queue-info").first()).toHaveText("6 i kø · ca. 12 min");
});

test("maks i kø: «Køen er full» for nye, varsel om sen slutt for de som står", async ({ browser, request, baseURL }) => {
  for (let i = 0; i < 4; i++) await join(request, baseURL!, "A");
  const g = await phone(browser); // A5
  await g.goto(`/join?station=A&key=${keys.A}`);
  await expect(g.getByText("4 personer foran deg")).toBeVisible();

  await sql`UPDATE stations SET max_waiting = 5 WHERE id = 'A'`;
  const late = await phone(browser);
  await late.goto(`/join?station=A&key=${keys.A}`);
  await expect(late.getByText("Køen er full")).toBeVisible();
  await expect(late.getByText(/Stasjon A tar ikke imot flere i kø i dag/)).toBeVisible();

  // Sluttid om 3 min, 4 foran × 2 min → gjesten rekker det kanskje ikke.
  await sql`UPDATE stations SET service_end = ${await osloIn(3)}::time WHERE id = 'A'`;
  await g.reload();
  await expect(g.getByTestId("late-warning")).toContainText("Det kan bli for sent – siste betjening er kl.");

  // Operatøren ser at stasjonen er full.
  const op = await (await browser.newContext()).newPage();
  await login(op, "/operator?station=A");
  await expect(op.getByTestId("capacity")).toContainText("Full – siste betjening kl.");
});

test("admin: sluttid/kapasitet, rapport med CSV og «Nullstill alle køer»", async ({ browser, request, baseURL }) => {
  await join(request, baseURL!, "A");
  await join(request, baseURL!, "B");
  await join(request, baseURL!, "B");
  const admin = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  await login(admin, "/admin");

  // Sluttid og maks for alle.
  await admin.getByRole("button", { name: /Navn, farge, sluttid og rekkefølge/ }).first().click();
  const settings = admin.getByTestId("station-settings-A");
  await settings.getByLabel("Maks i kø").fill("10");
  await settings.getByText("Bruk på alle stasjoner").click();
  await settings.getByRole("button", { name: "Lagre for alle stasjoner" }).click();
  await expect(admin.getByTestId("capacity-A")).toHaveText("Plass til ca. 9 til");
  await expect(admin.getByTestId("capacity-B")).toHaveText("Plass til ca. 8 til");
  const [{ n }] = (await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM stations WHERE max_waiting = 10`) as unknown as [{ n: number }];
  expect(n).toBe(3);

  // Rapport nå.
  const current = admin.getByTestId("report-current");
  await expect(current.getByRole("row", { name: /Stasjon B/ })).toContainText("2");

  // CSV.
  const [download] = await Promise.all([admin.waitForEvent("download"), admin.getByRole("link", { name: "Last ned CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^kolapp-rapport-\d{4}-\d\d-\d\d\.csv$/);
  const csv = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain("Runde;Stasjon;Kode;Start;Slutt;Delt ut");
  expect(csv).toMatch(/Nå;Stasjon B;B;[^;]*;[^;]*;2;/);

  // Nullstill alle.
  await admin.getByRole("button", { name: "Nullstill alle køer …" }).click();
  await expect(admin.getByRole("alertdialog", { name: "Nullstill alle køer" })).toContainText("3 venter totalt");
  await admin.getByRole("button", { name: "Bekreft – tøm alle køer" }).click();
  await expect(admin.getByText("Tidligere runder (2)")).toBeVisible();
  const [{ t }] = (await sql<{ t: number }[]>`SELECT count(*)::int AS t FROM tickets`) as unknown as [{ t: number }];
  expect(t).toBe(0);
});

test("admin: «Vis køen før gjesten tar lapp» og «Vis ventetiden som»", async ({ browser }) => {
  const admin = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  await login(admin, "/admin");
  await admin.getByRole("switch", { name: "Vis køen før gjesten tar lapp" }).click();
  await admin.getByRole("radio", { name: /Begge/ }).check();
  await expect
    .poll(async () => (await sql<{ c: boolean; w: string }[]>`SELECT confirm_join AS c, wait_display AS w FROM site_config`)[0])
    .toEqual({ c: true, w: "both" });
});
