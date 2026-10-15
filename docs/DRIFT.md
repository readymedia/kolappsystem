# Drift og overvåking

Hvordan appen holdes stabil i produksjon, og hva du gjør når noe skjer.

## Helsesjekk og røyktest

| Verktøy | Bruk | Endrer data? |
| --- | --- | --- |
| `GET /api/health` | Svarer `{"ok":true,"version":…,"commit":…,"db":"ok","migration":…}`. 503 hvis databasen ikke svarer. | Nei |
| `BASE_URL=https://kolappsystem.vercel.app npm run smoke` | 14 sjekker: helse, offentlig status og konfig uten hemmeligheter, CDN-mellomlagring, sikkerhetshoder, innloggingskrav, Origin-vern, lydside, 404. | Nei |

Kjør røyktesten etter hver deploy og morgenen før arrangementet.

**Ekstern overvåking (valgfritt):** En tjeneste som UptimeRobot kan kalle `/api/health`. Sett intervallet til **én gang i timen eller sjeldnere**. Neon Free sover etter 5 minutter uten trafikk, og hyppigere kall holder databasen våken døgnet rundt. Det bruker opp de 100 gratis CU-timene i måneden.

## Deploy og versjoner

**Hvilken versjon kjører i produksjon?** Sjekk ett av disse:

| Hvor | Hva du ser |
| --- | --- |
| Vercel → **Deployments** | Raden med **blått «Production»-merke** er den som kjører nå. Commit-koden (f.eks. `cb2c269`) står på raden. |
| `https://kolappsystem.vercel.app/api/health` | `"version"` og `"commit"` for koden som kjører. |
| `/admin` → «Om appen» | Versjon og commit. |

Commit-koden skal være den samme som den nyeste committen på `main` i GitHub.

**Regler for deploy:**

- **Ny versjon = push til `main`.** Vercel bygger og setter den i produksjon automatisk, og migreringer kjøres.
- **Ikke trykk «Redeploy» på en eldre rad.** Da settes gammel kode i produksjon (tilbakerulling). «Redeploy» skal bare brukes på den **øverste Production-raden**, f.eks. etter endret innstilling eller miljøvariabel.
- **Ikke bruk «Promote» eller «Instant Rollback»** uten å vite hva du gjør, se «Under arrangementet».
- **Rader merket «Preview»** (f.eks. `chore(deps)…`) er test-bygg fra pull requests. De har ingen database koblet til, hopper over migrering (`[migrate] VERCEL_ENV=preview – hopper over migrering`) og påvirker aldri produksjon. De kan ignoreres.

**Node-versjon:** Appen er låst til Node 22 (`engines` i `package.json`). Står Project Settings i Vercel på en annen versjon (f.eks. 24.x), viser byggeloggen et varsel om at 22.x brukes. Det er ufarlig. Fjern varselet ved å sette Settings → Build and Deployment → **Node.js Version** til **22.x**.

## Avhengigheter (Dependabot)

Dependabot lager pull requests med oppdateringer hver mandag. Hver PR får automatisk CI (alle tester) og et forhåndsvisningsbygg i Vercel.

| Type oppdatering | Hva skjer | Hva du gjør |
| --- | --- | --- |
| Feilrettinger og små oppdateringer (patch/minor) | Samlet i én PR for produksjon og én for utvikling | Merge når CI er grønn – helst ikke rett før et arrangement |
| Sikkerhetsoppdateringer | Egen PR | Merge når CI er grønn |
| Hovedversjoner av npm-pakker (major) | **Foreslås ikke** (`ignore` i `.github/dependabot.yml`) | Oppgraderes bevisst på egen gren med full testkjøring |
| GitHub Actions | Månedlig PR | Merge når CI er grønn (påvirker bare CI, ikke appen) |

Hvorfor majors er slått av: I oktober 2026 foreslo Dependabot TypeScript 7 (CI feilet, verktøyene støtter bare TypeScript under 6.1) og `@types/node` 26 (passer ikke Node 22, som appen kjører på). Slike PR-er skal lukkes, ikke merges.

## Under arrangementet

- **Frys deploy.** Ikke push til `main` mens arrangementet pågår, fordi hver push deployer og migrerer produksjon. Gjør endringer på en egen gren.
- **Ikke bruk «Promote» eller «Instant Rollback»** uten å vite hva du gjør. De kjører ikke migreringer, så ny kode kan møte gammelt skjema. Rull heller tilbake med `git revert` og vanlig deploy.
- **Følg med på forbruket:** Vercel → prosjektet → **Usage**. Grensene står i `AGENTS.md` §7.
- **Ved mistanke om misbruk** (mange falske lapper, uvanlig trafikk):
  1. `/admin` → «Bytt nøkkel» for stasjonen og heng opp ny QR.
  2. `/admin` → «Fjern ventende lapper …» for nummerområdet med falske lapper.
  3. Vercel → **Firewall** → slå på **Attack Challenge Mode** midlertidig. Ekte nettlesere slipper gjennom etter en kort sjekk.

## Anbefalte brannmurregler (Vercel Firewall, Hobby har inntil 3 egne regler)

| Regel | Hvorfor |
| --- | --- |
| **Deny** når sti er `/api/state` **og** spørringsstrengen ikke er tom | Appen bruker aldri parametere på `/api/state`. Med parametere omgås CDN-mellomlagringen, og hvert kall koster et funksjonskall. Dette stenger den døren. |
| (Valgfritt) **Deny** for land der ingen gjester kommer fra, på `/api/join` og `/api/auth/login` | Mindre støy og gjetting. |

Sett opp reglene i Vercel → prosjektet → **Firewall** → **Configure** → **New Rule**. Bruk «Log» først hvis du er usikker, og bytt til «Deny» etter å ha sett at ingen ekte trafikk treffes.

## Innebygd vern i appen

| Vern | Grense |
| --- | --- |
| Nye kølapper per nettverk | 300 per minutt |
| Skann med feil nøkkel per nettverk | 20 per minutt |
| Ventende lapper per nettverk per stasjon | 100 |
| PIN-forsøk per nettverk | 5 per 15 min |
| Feil PIN-forsøk totalt | 100 per 15 min |
| Tidsgrense per nettleserkall | 8 s |
| Låsetid / spørretid i databasen | 5 s / 10 s |

Et nettverk er én IPv4-adresse, eller ett IPv6-/64-nett. Grensene settes i `src/lib/config.ts`.

## Når noe går galt

| Symptom | Sannsynlig årsak | Løsning |
| --- | --- | --- |
| Gjester ser «Mistet kontakten – prøver igjen» | Dårlig nett på stedet, eller Vercel/Neon nede | Sjekk `/api/health`. Siden henter seg inn igjen selv når nettet er tilbake. |
| «Systemet er travelt akkurat nå» | Tidsgrense i databasen nådd | Forsvinner vanligvis av seg selv. Sjekk Neon-konsollen hvis det varer. |
| «Det står allerede svært mange i kø fra dette nettverket» | Over 100 ventende fra samme nett | Skjer ved flom fra en delt QR. Fjern falske lapper og bytt nøkkel. |
| Operatørsiden viser «Mistet kontakten» eller gammelt klokkeslett ved «Oppdatert» | Nettet på enheten | Sjekk Wi-Fi/mobilnett. Siden henter seg inn igjen selv, eller trykk «Oppdater». |
| Ingen lydsignal | Lydsiden ikke startet, satt på pause eller lagt i dvale | Se feilsøking i `docs/LYD-OPPSETT.md`. |
| Operatør kastes ut til PIN-skjermen | PIN er byttet, eller økta er utløpt (24 t uten bruk) | Logg inn igjen. Køen er uendret. |
| `/api/health` gir `db: "error"` | Neon utilgjengelig eller kvote brukt opp | Neon-konsollen → Monitoring. Vercel → Storage. |
| Prosjektet er pauset | Hobby-kvote brukt opp | Oppgrader til Pro, eller vent 30 dager. Se `AGENTS.md` §7. |

## Logger

Vercel → prosjektet → **Logs** (Hobby beholder dem i 1 time). API-feil logges som `[api] …`, og travle eller tapte tilkoblinger som `[api] travelt/tilkobling …`. PIN, nøkler og IP-adresser logges aldri.
