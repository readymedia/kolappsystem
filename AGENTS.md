# AGENTS.md – guide for AI-agenter (og mennesker)

Les denne filen helt før du endrer noe. Den er skrevet for at en hvilken som helst AI-assistent (Claude, Copilot, Cursor, ChatGPT m.fl.) raskt skal forstå prosjektet og jobbe trygt i det.

## 1. Hva prosjektet er

Kølappsystem for meet-and-greet med tre faste stasjoner (A, B, C) på en konferanse med noen hundre deltakere. Publikum skanner QR → får kølapp → følger køen på mobilen. Operatører trykker NESTE. Storskjerm viser hvem som betjenes. Alt på **norsk** (bokmål).

Produksjon: Vercel **Hobby** (gratis) + Neon Postgres **Free**. Begge har harde grenser – se §7.

| Miljø | Verdi |
| --- | --- |
| Produksjons-URL | https://kolappsystem.vercel.app |
| Vercel-prosjekt | `magnus-lians-projects/kolappsystem` (Hobby), funksjoner i `fra1` |
| Database | Neon `kolappsystem` (Free, Frankfurt), koblet til **kun Production**, **uten** «Create Database Branch For Deployment» |
| GitHub | `readymedia/kolappsystem`, `main` deployes automatisk til produksjon |

## 2. Kart over koden

```
db/migrations/        SQL-migreringer (001_init.sql …). Aldri endre en kjørt migrering – lag en ny.
scripts/migrate.mjs   Kjører migreringer + startdata. Kjøres av `npm run build` (dvs. hver Vercel-deploy).
scripts/reset-pin.mjs Nødløsning ved glemt PIN (se docs/SIKKERHET.md).
scripts/smoke.mjs     Røyktest mot vilkårlig URL, også produksjon. Endrer ingen data.
scripts/load.mjs      Lasttest (300 telefoner + 3 operatører) – KUN mot localhost.
src/lib/
  config.ts           Konstanter: stasjoner, intervaller, grenser, farger per stasjon. Ingen hemmeligheter.
  texts.ts            Publikumstekster og feilkoder (ERROR_TEXT). Endre tekster HER.
  public-state.ts     Typer for offentlige API-svar + deriveTicket() (ren logikk, testet).
  db.ts               Postgres-tilkobling (server-only).
  queue.ts            ALL forretningslogikk for køen (server-only). Atomiske transaksjoner.
  auth.ts             PIN-innlogging, økt (JWT i httpOnly-cookie), bytte av PIN (server-only).
  rate-limit.ts       Forsøksgrenser i Postgres (server-only).
  http.ts             Felles API-hjelpere: handle() (Origin, økt, ny henting, feilkoder), ok(), fail() (server-only).
  net.ts              normalizeIp() – IPv4 / IPv6-/64 for forsøksgrenser (ren, testet).
  version.ts          Appversjon (package.json) og commit – vises i /admin og /api/health.
  pin-hash.mjs        scrypt-hash + tilfeldige nøkler. .mjs fordi migrate-skriptet også bruker den.
  client-api.ts       fetch-hjelper for nettleseren.
  site-config.ts      Innstillinger (site_config) og opplastede filer (media) (server-only).
  media.ts            Gjenkjenning av filtyper på innhold + grenser for opplasting (ren, testet).
  announce.ts         Når lydsignal skal spilles: detectNewCalls(), parseStationFilter() (ren, testet).
  sound.ts            SoundPlayer: Web Audio, standardlyd og egen lyd (kun nettleser).
src/components/       hooks.ts (usePolling, useWakeLock), ui.tsx, PinGate, LogoutButton.
src/app/              Sider (App Router) og API-ruter under src/app/api/. Lydsiden: src/app/audio/ (med poller.worker.ts).
tests/unit/           Rene tester (ingen database).
tests/integration/    Tester mot ekte Postgres (krever TEST_DATABASE_URL). Sletter data!
tests/e2e/            Playwright i ekte nettleser (krever E2E_DATABASE_URL og bygget app). Sletter data!
docs/                 Menneskelig og AI-vennlig dokumentasjon.
```

## 3. Invarianter – ALDRI bryt disse

1. **Hemmeligheter forlater aldri serveren.** `join_key`, `pin_hash` og `session_secret` skal bare leses i `queue.ts`/`auth.ts`, og kun returneres fra `/api/admin/*` (nøkkel/QR) bak innlogging. `/api/state` og `/api/tickets/:id` skal aldri inneholde dem (det finnes en test for dette).
2. **Nettleseren snakker aldri med databasen direkte.** All tilgang går via `src/app/api/*`.
3. **Alle køendringer skjer i én transaksjon som låser stasjonsraden** (`lockStation()` i `queue.ts`). Det er dette som hindrer duplikatnummer og to kalte lapper. Ikke del en operasjon opp i flere kall fra klienten.
4. **Alle endrings-ruter bruker `handle(req, { mutation: true, ... })`** (Origin-sjekk) og beskyttede ruter `requireSession: true`.
5. **PIN sjekkes kun på serveren** mot scrypt-hash. Aldri lagre eller logge PIN i klartekst.
6. **Publikum skal aldri se tekniske feil.** Bruk koder fra `ERROR_TEXT` i `texts.ts`.
7. **Ikke øk polling-frekvensen eller fjern CDN-mellomlagringen av `/api/state`** uten å regne på Hobby-budsjettet (§7).
8. Moduler med `import "server-only"` skal aldri importeres fra klientkomponenter (bare `import type`).
9. **Alle køtransaksjoner går via `begin()` i `queue.ts`** (setter `lock_timeout`/`statement_timeout`). Aldri `getSql().begin` direkte for skriving.
10. **Utviklerinfo («Om appen») vises bare i `/admin`.** Publikumssidene skal ikke vise den (E2E-test sjekker dette).
11. **IP-adresser lagres aldri**, bare `networkFingerprint()` (HMAC) i `tickets.ip_hash`.
12. **Opplastede filer** sjekkes på innhold (`media.ts`), lagres i `media` og serveres bare via `/api/media/<sha256>` med `sandbox`-CSP. `/api/config` skal aldri inneholde hemmeligheter.

## 4. Planlagt arbeid

Neste utvidelser (v1.2 lydsignal, v1.3 skjermer, v1.4 utseende/logo, v1.5 push-varsel, v1.6 fleksible stasjoner,
2.0 flere instanser) er beskrevet i detalj i `docs/PLAN-UTVIDELSER.md`. **1.2–1.4 er godkjent (15.10).** 1.5, 1.6 og 2.0 ligger på roadmap og krever ny godkjenning før det skrives kode. Følg planen og dens «definisjon av ferdig». Viktigst: dagens oppførsel er standard,
alt nytt er tillegg, migreringer er bare tillegg, og ingenting arrangementsspesifikt hardkodes.

## 5. Vanlige oppgaver

| Oppgave | Hvor |
| --- | --- |
| Endre en tekst publikum ser | `src/lib/texts.ts` eller siden i `src/app/…` + oppdater `docs/UI-SPEC.md` |
| Endre farger per stasjon | `STATION_THEME` i `src/lib/config.ts` |
| Endre ventetid-formel | `waitText()` i `src/lib/texts.ts` (+ test i `tests/unit/logic.test.ts`) |
| Ny kolonne/tabell | Ny fil `db/migrations/00N_navn.sql`, oppdater typer i `queue.ts` |
| Ny API-rute | `src/app/api/…/route.ts`, bruk `handle()` fra `http.ts` |
| Ny operatørhandling | Funksjon i `queue.ts` (transaksjon + `lockStation`), case i `api/operator/[station]/[action]/route.ts`, knapp i `OperatorClient.tsx`, integrasjonstest |

Flere stasjoner enn A/B/C krever endring i: `STATION_IDS` (config.ts), `CHECK`-regel på `stations.id` (ny migrering), `STATION_SEED` (migrate.mjs) og `STATION_THEME`.

## 6. Arbeidsflyt

```bash
npm install
npm run check                      # typecheck + lint + enhetstester – SKAL være grønt før commit
TEST_DATABASE_URL=postgres://… npm run test:integration   # mot en TOM testdatabase
npm run build                      # verifiser at det bygger
E2E_DATABASE_URL=postgres://… npm run test:e2e             # ekte nettleser, mot EGEN testdatabase (bygg først)
BASE_URL=https://kolappsystem.vercel.app npm run smoke     # røyktest, endrer ingen data
```

Lokalt uten nedlastbar Playwright-nettleser: sett `PW_CHROMIUM_PATH` til en Chromium-binær.

Next.js 16-merknader: `params`/`searchParams` er Promises (`await params`), `cookies()` er async, Turbopack er standard. Det finnes ingen `middleware.ts`; sikkerhetshoder settes i `next.config.ts`.

## 7. Vercel Hobby og Neon Free – grenser du må respektere

| Ressurs (per måned) | Grense | Hva appen bruker (anslag, én konferansedag, 300 brukere) |
| --- | --- | --- |
| CDN-forespørsler (Vercel) | 1 000 000 | ca. 195 000 (inkl. 2 lydsider) |
| Funksjonskall (Vercel) | 1 000 000 | ca. 60 000 |
| Active CPU (Vercel) | 4 timer | noen få minutter |
| Compute (Neon Free) | 100 CU-timer | ca. 3 CU-timer |
| Lagring (Neon Free) | 1 GB | under 10 MB |

Går Vercel Hobby over grensen, **stoppes prosjektet i 30 dager**. Derfor:
- `/api/state` er felles for alle og mellomlagres 1 s på CDN (`CDN-Cache-Control`). Kølapper og storskjerm leser bare den.
- Polling pauser når fanen er skjult, går ned til hvert 15. sekund når lappen er ferdig, og stopper når lappen ikke finnes.
- Utregningen står i `docs/ARKITEKTUR.md` §6.

Merk: Vercel Hobby er etter vilkårene for ikke-kommersiell bruk. Se `docs/BESLUTNINGER.md` ADR-007.

## 8. Versjonering og commits

- SemVer. Patch = feilretting, minor = ny funksjon, major = endring som krever ny QR-utskrift eller migrering med datatap.
- Ved release: oppdater `CHANGELOG.md` (nyeste øverst), `version` i `package.json`, commit, `git tag vX.Y.Z`, push med `--tags`. Kan ikke tagger pushes fra verktøyet ditt, lag dem i GitHub under **Releases → Draft a new release**.
- Commit-meldinger: kort imperativ på norsk eller engelsk, f.eks. `fix: hindre dobbel kalling ved samtidig NESTE`. Prefikser: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`.
- Git-bruker for dette repoet: `readymedia` / `magnus@readymedia.no`.
- `main` deployes automatisk til produksjon på Vercel. Bruk en gren + PR for større endringer (får egen forhåndsvisnings-URL uten database).
- Hvilken versjon som kjører i produksjon: `GET /api/health` (`version`, `commit`) eller blått «Production»-merke i Vercel → Deployments. Aldri «Redeploy» av en eldre rad (= tilbakerulling). Se `docs/DRIFT.md` → «Deploy og versjoner».
- Avhengigheter: Dependabot foreslår bare patch/minor for npm. Hovedversjoner (TypeScript, `@types/node`, Next.js, React, ESLint osv.) oppgraderes bevisst på egen gren. `@types/node` skal følge Node-versjonen i `engines` (22).

## 9. Før du sier «ferdig»

- [ ] `npm run check` er grønt
- [ ] Integrasjonstester er grønne hvis du rørte `queue.ts`, `auth.ts`, `rate-limit.ts` eller SQL
- [ ] `npm run build` fungerer
- [ ] E2E er grønt hvis du endret sider, tekster eller flyt (CI kjører det uansett)
- [ ] Dokumentasjonen er oppdatert (UI-SPEC ved tekstendringer, ARKITEKTUR ved API/datamodell, CHANGELOG alltid)
