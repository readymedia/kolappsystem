#!/usr/bin/env node
// Kjører databasemigreringer og legger inn startdata.
//
// - Kjøres automatisk av `npm run build` (dvs. ved hver Vercel-bygging) og manuelt med `npm run db:migrate`.
// - Idempotent: kjørte migreringer hoppes over (tabellen schema_migrations), startdata legges bare inn én gang.
// - På Vercel kjøres den bare for produksjonsbygg (VERCEL_ENV=production).
// - Mangler DATABASE_URL, avsluttes skriptet uten feil slik at første deploy før databasen er koblet til
//   fortsatt bygger. Appen viser da en tydelig melding om at databasen mangler.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { hashPin, randomToken } from "../src/lib/pin-hash.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const STATION_SEED = [
  { id: "A", description: "Møt hovedgjesten – kort prat, signering og bilde." },
  { id: "B", description: "Møt programlederen – still spørsmål og ta et bilde sammen." },
  { id: "C", description: "Møt produsenten – hør hvordan showet blir til." },
];

// På Vercel migreres bare produksjonsbygg, så en forhåndsvisning aldri endrer produksjonsdatabasen.
if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production" && process.env.MIGRATE !== "1") {
  console.warn(`[migrate] VERCEL_ENV=${process.env.VERCEL_ENV} – hopper over migrering (sett MIGRATE=1 for å tvinge).`);
  process.exit(0);
}

if (!url) {
  console.warn("[migrate] DATABASE_URL er ikke satt – hopper over migrering. Koble til Neon i Vercel og deploy på nytt.");
  process.exit(0);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

// Hindrer at to samtidige bygg migrerer samtidig.
const LOCK_ID = 4_242_017;

try {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${LOCK_ID})`;
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;

    const done = new Set((await tx`SELECT version FROM schema_migrations`).map((r) => r.version));
    const dir = path.join(root, "db", "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      if (done.has(version)) continue;
      console.log(`[migrate] kjører ${file}`);
      await tx.unsafe(await readFile(path.join(dir, file), "utf8"));
      await tx`INSERT INTO schema_migrations (version) VALUES (${version})`;
    }

    // Startdata: stasjoner med nye, sterke nøkler.
    for (const s of STATION_SEED) {
      await tx`
        INSERT INTO stations (id, description, join_key)
        VALUES (${s.id}, ${s.description}, ${randomToken()})
        ON CONFLICT (id) DO NOTHING`;
    }

    // Startdata: PIN (standard 1234) og reserve-hemmelighet for økter.
    const [settings] = await tx`SELECT id FROM settings WHERE id = 1`;
    if (!settings) {
      const pin = (process.env.INITIAL_PIN || "1234").trim();
      await tx`
        INSERT INTO settings (id, pin_hash, session_secret)
        VALUES (1, ${await hashPin(pin)}, ${randomToken(32)})`;
      console.log("[migrate] innstillinger opprettet (PIN fra INITIAL_PIN eller standard 1234 – bytt den på /admin)");
    }
  });
  console.log("[migrate] databasen er oppdatert");
} catch (err) {
  console.error("[migrate] feilet:", err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
