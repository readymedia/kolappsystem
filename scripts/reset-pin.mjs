#!/usr/bin/env node
// Nødløsning ved glemt PIN. Setter ny PIN og logger ut alle økter.
// Bruk:  DATABASE_URL="<fra Vercel>" node scripts/reset-pin.mjs 1234

import postgres from "postgres";
import { hashPin } from "../src/lib/pin-hash.mjs";

const pin = (process.argv[2] || "").trim();
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!/^\d{4,12}$/.test(pin)) {
  console.error("Oppgi ny PIN (4–12 sifre): node scripts/reset-pin.mjs 1234");
  process.exit(1);
}
if (!url) {
  console.error("DATABASE_URL mangler.");
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false });
try {
  const rows = await sql`UPDATE settings SET pin_hash = ${await hashPin(pin)}, pin_version = pin_version + 1, updated_at = now() WHERE id = 1 RETURNING id`;
  console.log(rows.length ? "PIN er byttet. Alle er logget ut." : "Fant ikke innstillinger – kjør npm run db:migrate først.");
} finally {
  await sql.end({ timeout: 5 });
}
