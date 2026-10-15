import { expect, test } from "@playwright/test";
import { join, keys, login, makeWav, phone, resetAll, soundCount, soundLast, sql } from "./helpers";

// v1.2 Lydsignal: lydsiden, filter per stasjon, egen lyd, volum/av, storskjerm med lyd.

test.beforeEach(resetAll);

test("lydsiden spiller standardlyd når nytt nummer kalles, ikke ved innlasting", async ({ browser, request, baseURL }) => {
  const audioCtx = await browser.newContext();
  const audio = await audioCtx.newPage();
  await join(request, baseURL!, "A");
  await audio.goto("/audio");
  await expect(audio.getByText("Sist sjekket")).toBeVisible();
  await audio.getByRole("button", { name: "Start lydsignal" }).click();
  await expect(audio.getByText("Lyd aktiv ✓")).toBeVisible();

  const filtered = await audioCtx.newPage();
  await filtered.goto("/audio?station=B");
  await expect(filtered.getByRole("heading", { name: "Stasjon B" })).toBeVisible();
  await filtered.getByRole("button", { name: "Start lydsignal" }).click();
  await audio.waitForTimeout(3500); // første øyeblikksbilde på begge
  expect(await soundCount(audio)).toBe(0);

  const op = await phone(browser);
  await login(op, "/operator?station=A");
  await expect(op.getByText("1 venter")).toBeVisible();
  await op.getByRole("button", { name: "NESTE" }).click();

  await expect.poll(() => soundCount(audio), { timeout: 10_000 }).toBe(1);
  expect(await soundLast(audio)).toBe("default");
  await expect(audio.getByText("A1", { exact: true })).toBeVisible();
  // B-siden skal ikke spille for A.
  await filtered.waitForTimeout(1000);
  expect(await soundCount(filtered)).toBe(0);

  // Test-knappen spiller med en gang.
  await audio.getByRole("button", { name: "Test lyd" }).click();
  await expect.poll(() => soundCount(audio)).toBe(2);
});

test("admin laster opp egen lyd, den spilles; feil filtype avvises; volum og «av» virker", async ({ browser, request, baseURL }) => {
  const admin = await browser.newPage();
  await login(admin, "/admin");
  await expect(admin.getByRole("heading", { name: "Lydsignal" })).toBeVisible();

  // Feil filtype (tekst forkledd som .mp3)
  await admin.getByLabel("Velg lydfil").setInputFiles({ name: "falsk.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("ikke lyd") });
  await expect(admin.getByText("Filtypen støttes ikke.")).toBeVisible();

  await admin.getByLabel("Velg lydfil").setInputFiles({ name: "signal.wav", mimeType: "audio/wav", buffer: makeWav() });
  await expect(admin.getByText(/Lyden er lastet opp/)).toBeVisible();
  await expect(admin.getByText(/WAV · \d+ kB/)).toBeVisible();

  const audio = await (await browser.newContext()).newPage();
  await audio.goto("/audio");
  await audio.getByRole("button", { name: "Start lydsignal" }).click();
  await expect(audio.getByText("Egen lyd · 80 %")).toBeVisible();
  await audio.waitForTimeout(3500);
  await join(request, baseURL!, "C");
  await sql`SELECT 1`; // (ingen venting på DB)
  const op = await phone(browser);
  await login(op, "/operator?station=C");
  await expect(op.getByText("1 venter")).toBeVisible();
  await op.getByRole("button", { name: "NESTE" }).click();
  await expect.poll(() => soundLast(audio), { timeout: 10_000 }).toBe("custom");

  // Volum
  await admin.getByLabel("Volum for lydsignal").fill("35");
  await expect
    .poll(async () => (await (await request.get("/api/config")).json()).audio.volume, { timeout: 5000 })
    .toBe(35);

  // Av
  await admin.getByText("Av", { exact: true }).click();
  await expect.poll(async () => (await (await request.get("/api/config")).json()).audio.mode).toBe("off");
  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto("/audio");
  await expect(fresh.getByText("Lyd er slått av i admin.")).toBeVisible();

  // Fjern egen lyd → tilbake til standard
  await admin.getByRole("button", { name: "Fjern egen lyd" }).click();
  await expect(admin.getByText("Egen lyd er fjernet. Standardlyden brukes.")).toBeVisible();
  expect((await sql`SELECT count(*)::int AS n FROM media`)[0]!.n).toBe(0);
});

test("storskjerm med ?sound=1 spiller etter ett klikk; /audiosignal sender til /audio", async ({ browser, request, baseURL }) => {
  const display = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await display.goto("/display?sound=1");
  await display.getByRole("button", { name: "Klikk for å slå på lyd" }).click();
  await expect(display.getByRole("button", { name: "Klikk for å slå på lyd" })).toHaveCount(0);
  await display.waitForTimeout(3500);

  await join(request, baseURL!, "B");
  const op = await phone(browser);
  await login(op, "/operator?station=B");
  await expect(op.getByText("1 venter")).toBeVisible();
  await op.getByRole("button", { name: "NESTE" }).click();
  await expect.poll(() => soundCount(display), { timeout: 10_000 }).toBe(1);

  // Uten ?sound=1: ingen lydknapp.
  const plain = await browser.newPage();
  await plain.goto("/display");
  await expect(plain.getByRole("button", { name: "Klikk for å slå på lyd" })).toHaveCount(0);

  const redirected = await browser.newPage();
  await redirected.goto("/audiosignal?station=A");
  await expect(redirected).toHaveURL(/\/audio\?station=A$/);
  expect(keys.A).toBeTruthy();
});
