#!/usr/bin/env node
// Lasttest LOKALT: simulerer en travel konferanse mot en lokal produksjonsbygget app.
//
//   DATABASE_URL=postgres://…/kolapp_load BASE_URL=http://localhost:3200 npm run load
//
// - PHONES telefoner (standard 300) skanner QR fordelt på A/B/C og følger køen (poller /api/state hvert 3. s)
// - 3 operatører trykker NESTE jevnlig
// - måler svartider (p50/p95/maks) og feil, og sjekker til slutt at ingen nummer er duplisert
//
// Kjør ALDRI mot produksjon: skriptet nekter andre adresser enn localhost.

import postgres from "postgres";
import { hashPin } from "../src/lib/pin-hash.mjs";

const base = (process.env.BASE_URL || "http://localhost:3200").replace(/\/$/, "");
const PHONES = Number(process.env.PHONES || 300);
const SECONDS = Number(process.env.SECONDS || 60);
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(base)) {
  console.error("Lasttesten kjøres bare mot localhost.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Sett DATABASE_URL til samme (test)database som den lokale appen bruker.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 2, onnotice: () => {} });
await sql`DELETE FROM queue_actions`;
await sql`DELETE FROM tickets`;
await sql`DELETE FROM rate_limits`;
await sql`UPDATE stations SET next_number = 1, generation = generation + 1, active = true`;
await sql`UPDATE settings SET pin_hash = ${await hashPin("1234")}`;
const keys = Object.fromEntries((await sql`SELECT id, join_key FROM stations`).map((r) => [r.id, r.join_key]));

const timings = { join: [], state: [], next: [] };
const errors = {};
const origin = { origin: base, "content-type": "application/json" };

async function timed(kind, fn) {
  const t = performance.now();
  try {
    const res = await fn();
    timings[kind].push(performance.now() - t);
    if (!res.ok) errors[`${kind} ${res.status}`] = (errors[`${kind} ${res.status}`] || 0) + 1;
    return res;
  } catch (e) {
    errors[`${kind} ${e.name}`] = (errors[`${kind} ${e.name}`] || 0) + 1;
    return null;
  }
}

const deadline = Date.now() + SECONDS * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function phone(i) {
  const station = "ABC"[i % 3];
  await sleep(Math.random() * Math.min(20_000, SECONDS * 300)); // skann spredt utover de første sekundene
  // Hver telefon får sin egen IP (som på mobilnett); hver tiende deler IP (som på konferanse-Wi-Fi).
  const ip = i % 10 === 0 ? "10.0.0.1" : `10.1.${Math.floor(i / 250)}.${i % 250}`;
  await timed("join", () =>
    fetch(`${base}/api/join`, {
      method: "POST",
      headers: { ...origin, "x-real-ip": ip },
      body: JSON.stringify({ station, key: keys[station], requestId: crypto.randomUUID() }),
    }),
  );
  while (Date.now() < deadline) {
    await timed("state", () => fetch(`${base}/api/state`));
    await sleep(3000);
  }
}

async function operator(station) {
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { ...origin, "x-real-ip": `10.9.9.${station.charCodeAt(0)}` },
    body: JSON.stringify({ pin: "1234" }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  while (Date.now() < deadline) {
    await sleep(2000 + Math.random() * 2000);
    await timed("next", () =>
      fetch(`${base}/api/operator/${station}/next`, { method: "POST", headers: { ...origin, cookie }, body: "{}" }),
    );
  }
}

console.log(`Lasttest: ${PHONES} telefoner + 3 operatører i ${SECONDS} s mot ${base} …`);
const started = Date.now();
await Promise.all([...Array.from({ length: PHONES }, (_, i) => phone(i)), operator("A"), operator("B"), operator("C")]);

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
console.log(`\nFerdig etter ${((Date.now() - started) / 1000).toFixed(0)} s\n`);
console.log("Type    Antall   p50 ms   p95 ms   maks ms");
for (const [k, arr] of Object.entries(timings)) {
  console.log(
    `${k.padEnd(7)} ${String(arr.length).padStart(6)} ${pct(arr, 50).toFixed(0).padStart(8)} ${pct(arr, 95).toFixed(0).padStart(8)} ${Math.max(0, ...arr).toFixed(0).padStart(9)}`,
  );
}
console.log("\nFeil:", Object.keys(errors).length ? errors : "ingen");

const dup = await sql`SELECT station, number, count(*) FROM tickets GROUP BY station, generation, number HAVING count(*) > 1`;
const called = await sql`SELECT station, count(*) FROM tickets WHERE status = 'called' GROUP BY station HAVING count(*) > 1`;
const issued = await sql`SELECT station, count(*)::int AS n, max(number) AS max FROM tickets GROUP BY station ORDER BY station`;
console.log("Lapper per stasjon:", issued.map((r) => `${r.station}: ${r.n} (maks nr ${r.max})`).join(", "));
console.log(dup.length || called.length ? "✗ Integritetsfeil funnet!" : "✓ Ingen dupliserte nummer, maks én kalt per stasjon");
await sql.end();
process.exit(dup.length || called.length ? 1 : 0);
