#!/usr/bin/env node
// Røyktest mot en kjørende app – også produksjon. Endrer INGEN data.
//
//   BASE_URL=https://kolappsystem.vercel.app npm run smoke
//
// Sjekker helse, offentlig status (form, ingen hemmeligheter, CDN-mellomlagring), sikkerhetshoder,
// at beskyttede API-er krever innlogging, og at falske forespørsler avvises.

const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const results = [];

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - started, error: err.message });
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function get(path, init) {
  return fetch(base + path, { redirect: "manual", ...init, signal: AbortSignal.timeout(15_000) });
}

await check("helse: app og database svarer", async () => {
  const res = await get("/api/health");
  const body = await res.json();
  assert(res.status === 200 && body.ok === true, `status ${res.status}, svar ${JSON.stringify(body)}`);
  console.log(`  versjon ${body.version} (${body.commit}), migrering ${body.migration}, ${body.ms} ms`);
});

await check("offentlig status: tre stasjoner, riktig form", async () => {
  const res = await get("/api/state");
  assert(res.ok, `status ${res.status}`);
  const body = await res.json();
  assert(Array.isArray(body.stations) && body.stations.length === 3, "forventet 3 stasjoner");
  for (const s of body.stations) {
    for (const k of ["id", "description", "active", "closedMessage", "generation", "nextNumber", "current", "waiting", "skipped"]) {
      assert(k in s, `mangler felt ${k} på stasjon ${s.id}`);
    }
  }
});

await check("offentlig status: ingen hemmeligheter", async () => {
  const text = await (await get("/api/state")).text();
  assert(!/join_key|joinKey|pin_hash|session_secret|ip_hash|"key"/.test(text), "fant hemmelig felt i svaret");
});

await check("offentlig status: mellomlagres på CDN", async () => {
  const res = await get("/api/state");
  const cdn = res.headers.get("cdn-cache-control") || "";
  const vercelCache = res.headers.get("x-vercel-cache");
  assert(cdn.includes("s-maxage=1") || vercelCache, "mangler CDN-Cache-Control");
  if (vercelCache) console.log(`  x-vercel-cache: ${vercelCache}`);
});

await check("offentlig konfig: lydinnstillinger, ingen hemmeligheter", async () => {
  const res = await get("/api/config");
  assert(res.ok, `status ${res.status}`);
  const text = await res.text();
  const body = JSON.parse(text);
  assert(["default", "custom", "off"].includes(body?.audio?.mode), "mangler audio.mode");
  assert(!/join_key|joinKey|pin_hash|session_secret|ip_hash/.test(text), "fant hemmelig felt");
});

await check("ugyldig mediefil gir 404", async () => {
  const res = await get("/api/media/" + "0".repeat(64));
  assert(res.status === 404, `forventet 404, fikk ${res.status}`);
  // Opplastede filer skal alltid ha sandbox-CSP (ikke sidenes CSP).
  const csp = res.headers.get("content-security-policy") || "";
  assert(csp.includes("sandbox") && !csp.includes("script-src"), `feil CSP på /api/media: ${csp}`);
});

await check("offentlig konfig: overskrift på storskjerm", async () => {
  const body = await (await get("/api/config")).json();
  assert(typeof body?.display?.title === "string", "mangler display.title");
});

await check("storskjerm-QR uten gyldig signert lenke gir 403", async () => {
  const none = await get("/api/display/qr?station=A");
  assert(none.status === 403, `uten token: forventet 403, fikk ${none.status}`);
  const bad = await get("/api/display/qr?station=A&t=" + "a".repeat(32));
  assert(bad.status === 403, `feil token: forventet 403, fikk ${bad.status}`);
  assert(!/<svg/.test(await bad.text()), "QR lekket uten gyldig token");
});

await check("storskjerm med skjermvalg svarer", async () => {
  const res = await get("/display?station=A&size=xl");
  assert(res.ok, `status ${res.status}`);
});

await check("utseende-API krever innlogging", async () => {
  const res = await fetch(base + "/api/admin/branding", { method: "PUT", headers: { origin: base, "content-type": "application/json" }, body: "{}" });
  assert(res.status === 401, `forventet 401, fikk ${res.status}`);
});

await check("push: service worker og offentlig konfig (ingen privatnøkkel)", async () => {
  const sw = await get("/sw.js");
  assert(sw.ok, `/sw.js: status ${sw.status}`);
  assert((sw.headers.get("cache-control") || "").includes("no-store"), "sw.js skal aldri mellomlagres");
  const text = await (await get("/api/config")).text();
  const body = JSON.parse(text);
  assert(typeof body?.push?.enabled === "boolean", "mangler push.enabled");
  assert(!/vapid_private|privateKey/.test(text), "privatnøkkel i offentlig konfig");
});

await check("lydsiden svarer", async () => {
  const res = await get("/audio");
  assert(res.ok, `status ${res.status}`);
});

await check("sikkerhetshoder på sider", async () => {
  const res = await get("/");
  const h = (n) => res.headers.get(n) || "";
  assert(h("content-security-policy").includes("frame-ancestors 'none'"), "CSP mangler");
  assert(h("referrer-policy") === "no-referrer", "Referrer-Policy mangler");
  assert(h("x-content-type-options") === "nosniff", "nosniff mangler");
  assert(h("x-frame-options") === "DENY", "X-Frame-Options mangler");
  assert(!h("x-powered-by"), "X-Powered-By skal ikke sendes");
});

await check("operatør-API krever innlogging", async () => {
  const res = await get("/api/operator/A");
  assert(res.status === 401, `forventet 401, fikk ${res.status}`);
});

await check("operatørdata mellomlagres aldri (alltid ferske tall)", async () => {
  const res = await get("/api/operator/A");
  const cc = res.headers.get("cache-control") || "";
  assert(cc.includes("no-store"), `forventet no-store, fikk «${cc}»`);
  assert(res.headers.get("x-vercel-cache") !== "HIT", "svaret kom fra CDN-cache");
});

await check("admin-API krever innlogging", async () => {
  const res = await get("/api/admin/stations");
  assert(res.status === 401, `forventet 401, fikk ${res.status}`);
});

await check("endring fra fremmed nettsted avvises (Origin)", async () => {
  const res = await get("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://ondsinnet.example" },
    body: JSON.stringify({ pin: "0000" }),
  });
  assert(res.status === 403, `forventet 403, fikk ${res.status}`);
});

await check("ukjent kølapp gir 404 uten detaljer", async () => {
  const res = await get("/api/tickets/00000000-0000-4000-8000-000000000000");
  const body = await res.json();
  assert(res.status === 404 && body.error === "not_found", `fikk ${res.status}`);
});

await check("ukjent side gir 404", async () => {
  const res = await get("/finnes-ikke-" + Date.now());
  assert(res.status === 404, `forventet 404, fikk ${res.status}`);
});

console.log(`\nRøyktest mot ${base}\n`);
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.name} (${r.ms} ms)${r.ok ? "" : `\n    ${r.error}`}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} av ${results.length} OK`);
process.exit(failed ? 1 : 0);
