import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { APP_COMMIT, APP_VERSION } from "@/lib/version";

// Helsesjekk for drift og røyktest. Svarer 200 når appen og databasen virker, ellers 503.
// Merk: en ekstern overvåker som kaller denne ofte holder Neon våken og bruker av gratiskvoten
// (se docs/DRIFT.md). Én gang i timen eller sjeldnere er greit.

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let db: "ok" | "missing" | "error" = "ok";
  let migration: string | null = null;
  try {
    const [row] = await getSql()<{ version: string }[]>`SELECT max(version) AS version FROM schema_migrations`;
    migration = row?.version ?? null;
  } catch (err) {
    db = (err as Error)?.name === "DatabaseNotConfiguredError" ? "missing" : "error";
  }
  const body = { ok: db === "ok", version: APP_VERSION, commit: APP_COMMIT, db, migration, ms: Date.now() - started };
  return NextResponse.json(body, { status: body.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
