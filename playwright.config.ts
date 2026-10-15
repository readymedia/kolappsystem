import { defineConfig, devices } from "@playwright/test";

// Ende-til-ende-tester i ekte nettleser mot en produksjonsbygget app og en EGEN testdatabase.
// Kjør:  E2E_DATABASE_URL=postgres://…/kolapp_e2e npm run test:e2e
// ADVARSEL: testene sletter alle køer og setter PIN til 1234 i databasen de peker på.

const port = Number(process.env.E2E_PORT ?? 3200);
const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) throw new Error("Sett E2E_DATABASE_URL til en egen testdatabase (aldri produksjon).");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // PUSH_TEST_ENDPOINT: lokal push-mottaker i tests/e2e/push.spec.ts (godtas aldri i produksjon).
    env: { DATABASE_URL: databaseUrl, NEXT_TELEMETRY_DISABLED: "1", PUSH_TEST_ENDPOINT: "https://127.0.0.1:3299/" },
  },
});
