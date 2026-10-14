# Arkitekturbeslutninger (ADR)

Kort logg over viktige valg. Nye beslutninger legges til nederst med neste nummer. Endres en beslutning, skriv en ny ADR som erstatter den gamle.

## ADR-001 – Bygge på nytt i stedet for å flytte piloten
**Dato:** 2026-10-14 · **Status:** Vedtatt
Piloten i Base44 hadde nøkler og PIN åpent i nettleseren og en database alle kunne skrive til. Det kan ikke rettes uten å flytte logikken til en server. Vi beholder alle funksjoner, tekster og utseende, men bygger på nytt.

## ADR-002 – Next.js på Vercel
**Status:** Vedtatt
Sider og API i ett prosjekt, førsteklasses støtte på Vercel, enkelt for både mennesker og AI. Alternativer (egen Express-server, SvelteKit) gir ingen gevinst for denne størrelsen.

## ADR-003 – Neon Postgres (Free) via Vercel Marketplace
**Status:** Vedtatt
Vi trenger ekte transaksjoner med radlås for å garantere unike nummer og én kalt per stasjon. Neon er gratis, kobles til med ett klikk og setter `DATABASE_URL` automatisk. Vercel KV/Redis og Edge Config ble vurdert, men mangler transaksjoner og radlås.

## ADR-004 – Ingen ORM, rå SQL med `postgres`
**Status:** Vedtatt
Køens korrekthet ligger i noen få SQL-setninger. Rå SQL med taggede maler er lesbart, trygt mot SQL-injeksjon og gir én avhengighet. Migreringer er rene `.sql`-filer.

## ADR-005 – Polling med delt, CDN-mellomlagret status i stedet for sanntidstjeneste
**Status:** Vedtatt
Kravet er oppdatering hvert 3. sekund. WebSockets/SSE er dårlig egnet på serverløse funksjoner, og eksterne sanntidstjenester er en avhengighet til. Alle kølapper og storskjermen leser én felles `/api/state` som mellomlagres 1 sekund på Vercel CDN. Det holder antall funksjonskall og databasekall nesten konstant uansett antall brukere. Se budsjettet i `ARKITEKTUR.md` §6.

## ADR-006 – Felles PIN for operator og admin, økt i signert cookie
**Status:** Vedtatt (kundens valg)
Én PIN, standard 1234, kan endres i `/admin`. Lagres som scrypt-hash. Økt er en HS256-JWT i httpOnly-cookie med PIN-versjon, så PIN-bytte logger ut alle. Kan utvides til to PIN-er senere.

## ADR-007 – Vercel Hobby
**Status:** Vedtatt, med kjent risiko
Kunden bruker Vercel Hobby. Appen er bygd for å holde seg godt innenfor grensene. Merk at Vercels vilkår sier Hobby er for ikke-kommersiell, personlig bruk. Ved kommersiell bruk bør prosjektet flyttes til Pro (eller Pro-prøveperiode under arrangementet). Ingen kodeendring trengs for å bytte plan.

## ADR-008 – Migrering ved bygging
**Status:** Vedtatt
`npm run build` kjører `scripts/migrate.mjs` før `next build`. Da holder det å trykke «Redeploy» etter at databasen er koblet til, og skjemaet er alltid i takt med koden. Migreringen er idempotent og låst med `pg_advisory_xact_lock`. På Vercel kjøres den bare når `VERCEL_ENV=production`, så forhåndsvisninger aldri endrer produksjonsdatabasen.

## ADR-009 – Ventetid fast 2 minutter per person
**Status:** Vedtatt (kundens valg)
Beholdt fra piloten. Kan senere beregnes fra faktisk tid mellom `called_at`-verdier.

## ADR-010 – Forbedringer utover piloten
**Status:** Vedtatt
Lagt til fordi de er små og løser reelle problemer: vern mot dobbelt trykk på NESTE, «Angre siste» i flere steg, «Sett tilbake i kø» for overhoppede, stasjonsvelger på operator, redigerbar beskrivelse i admin, utskrift én stasjon per side, fullskjerm-knapp, skjerm-våkenhold, vibreringsknapp for Android, norsk 404-side, «Logg ut».

## ADR-011 – Robusthet for live drift (v1.1.0)
**Dato:** 2026-10-14 · **Status:** Vedtatt
Etter en uavhengig revisjon er følgende innført for å tåle dårlig nett, misbruk av delt QR og databasehikke:
idempotente skann (`requestId`), maks ventende per nettverk (HMAC av IP, IPv6 /64), nøkkelsjekk før lås,
tidsgrenser i nettleser (8 s) og database (5/10 s), ny henting av død tilkobling ved lesing, fornyelse av økt,
6-sifret minimum for ny PIN, vern mot dobbelt trykk på «Angre», og «Fjern ventende lapper» i admin.
Alternativene (ekstern rate-limiter, Redis, sanntidstjeneste) ble forkastet for å holde driften gratis og enkel.

## ADR-012 – Testpyramide
**Status:** Vedtatt
Enhetstester (ren logikk), integrasjonstester mot ekte Postgres (samtidighet), E2E i ekte nettleser (Playwright)
og røyktest som kan kjøres mot produksjon uten å endre data. Lasttest kjøres lokalt ved behov (`npm run load`).
Alt unntatt lasttest kjører i CI.

## ADR-013 – «Om appen» kun i admin
**Status:** Vedtatt
Utvikler (Andreas Aarlott, andreas.aarlott@ntnu.no), versjon og at appen er AI-støttet utviklet vises bare i `/admin`,
så publikumssidene holdes rene. E2E-testen sjekker at utviklerinfo ikke vises på publikumssidene.
