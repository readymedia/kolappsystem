# Endringslogg

Formatet følger [Keep a Changelog](https://keepachangelog.com/no/1.1.0/) og [semantisk versjonering](https://semver.org/lang/no/). Nyeste øverst.

## [1.1.2] – 2026-10-15

### Rettet
- Operatørsiden kunne slutte å oppdatere antall i kø til siden ble lastet på nytt. Oppdateringen planlegger nå alltid en ny runde, også etter feil, og våkner når vinduet får fokus, siden vises igjen (tilbake-knapp) eller nettet kommer tilbake. Gjelder også kølapp og storskjerm.
- Ved bytte av stasjon (A/B/C) på operatørsiden vises ikke lenger forrige stasjons tall i opptil 3 sekunder.

### Lagt til
- Operatørsiden viser «Oppdatert hh:mm:ss», har en «Oppdater»-knapp og varsler «Mistet kontakten – prøver igjen» etter to mislykkede oppdateringer.
- E2E-tester: operatør ser nye i køen uten ny innlasting, riktig tall ved stasjonsbytte, og gjenoppretting etter nettbrudd. Røyktest sjekker at operatørdata aldri mellomlagres.

### Dokumentasjon
- `docs/PLAN-UTVIDELSER.md`: implementasjonsplan for v1.2 (skjermer), v1.3 (fleksible stasjoner) og v1.4 (utseende/logo), basert på tilbakemeldinger fra brukerne.

## [1.1.1] – 2026-10-14

### Endret
- ESLint 10 (fjerner varsel om utdatert ESLint 9). Kun utviklingsverktøy.
- GitHub Actions v7 (`checkout`, `setup-node`, `upload-artifact`). Kun CI.
- Dependabot foreslår ikke lenger hovedversjoner av npm-pakker automatisk.

### Avvist
- TypeScript 7 (CI feilet – lint-verktøyene støtter bare TypeScript under 6.1) og `@types/node` 26 (passer ikke Node 22).

### Dokumentasjon
- `docs/DRIFT.md`: «Deploy og versjoner» (hvordan se hva som kjører, aldri redeploy av eldre rad, preview-bygg) og «Avhengigheter (Dependabot)».
- Feilsøking i `docs/VERCEL-OPPSETT.md` for preview-bygg, versjon og Node-varsel.

## [1.1.0] – 2026-10-14

Runde med sikkerhetsrevisjon, stabilitet og flere tester for drift i produksjon. Se `docs/PRODKLARHET.md`.

### Lagt til
- «Om appen» i `/admin` (kun der): utvikler Andreas Aarlott (andreas.aarlott@ntnu.no), AI-støttet utvikling, versjon og commit.
- Varsel i `/admin` så lenge standard-PIN 1234 brukes.
- «Fjern ventende lapper …» i `/admin` for å rydde falske lapper i et nummerområde.
- `GET /api/health` med versjon, commit, database- og migreringsstatus.
- Norske feilsider ved krasj (`error.tsx`, `global-error.tsx`).
- Varsel «Mistet kontakten – prøver igjen» på kølappen etter tre mislykkede oppdateringer.
- Tester: Playwright E2E i ekte nettleser (5 scenarier), røyktest (`npm run smoke`, kan kjøres mot produksjon), lasttest (`npm run load`), 7 nye integrasjonstester og enhetstester for nettverk.
- CI: egen E2E- og røyktestjobb. Dependabot for npm og GitHub Actions.
- Dokumentasjon: `docs/DRIFT.md` og `docs/PRODKLARHET.md`.

### Endret
- Ny PIN må ha 6–12 sifre (innlogging godtar fortsatt 4–12, så standard-PIN virker første gang).
- Økt varer 24 timer og fornyes automatisk ved bruk.
- Forsøksgrenser regnes per nettverk (IPv6 grupperes på /64). Egen grense for skann med feil nøkkel (20/min).
- Maks 100 ventende lapper per nettverk per stasjon.

### Rettet
- Skann som gjentas etter at svaret forsvant (dårlig nett) gir ikke lenger dobbeltlapp (`requestId`).
- En gjest med aktiv lapp ser den igjen ved nytt skann, også når stasjonen er stengt.
- Skann med feil nøkkel låser ikke lenger stasjonen.
- Dobbelt trykk på «Angre siste» angrer bare ett steg.
- Alle kall fra nettleseren har 8 s tidsgrense, så en hengende forbindelse ikke fryser kølapp eller operatørknapper.
- Kølappen ignorerer køstatus som kommer i feil rekkefølge.
- Databasetransaksjoner har lås- og spørretidsgrense. Døde tilkoblinger fornyes, og lesing prøves én gang til.
- Gamle forsøksgrense-rader ryddes automatisk.
- Storskjermen rydder tidtakere når den lukkes.

### Fjernet
- Ubrukt avhengighet `zod` og duplisert `public/icon.svg`.

### Database
- Migrering `002_robust_join.sql`: kolonnene `tickets.request_id` og `tickets.ip_hash` med indekser. Kjøres automatisk ved deploy, uten datatap.

## [1.0.1] – 2026-10-14

### Endret
- Node låst til 22.x på Vercel (`engines`), så en ny Node-versjon ikke tas i bruk uten testing.
- GitHub Actions oppdatert til v5 (Node 24).

### Dokumentasjon
- Oppsettsguiden viser nøyaktig hvordan Neon kobles til: bare Production og **uten** «Create Database Branch For Deployment» (ellers nullstilles databasen ved hver deploy).
- Produksjonsmiljø (URL, Vercel-prosjekt, database) beskrevet i `AGENTS.md` og `README.md`.
- Feilsøking for tapte data etter deploy og feil variabelnavn.

## [1.0.0] – 2026-10-14

Første produksjonsversjon. Erstatter piloten i Base44 (mtsko.base44.app) med samme funksjoner, tekster og utseende, bygd på nytt for sikkerhet og drift på Vercel Hobby.

### Lagt til
- Publikum: `/join` (QR med hemmelig nøkkel), `/ticket/:id` med venter / din tur / hoppet over / ferdig / ikke funnet, vibrering og skjerm-våkenhold.
- Operatør: `/operator` med NESTE, Hopp over, Angre siste (flere steg), Sett tilbake i kø, stasjonsvelger og de fem neste.
- Storskjerm: `/display` med tre kolonner, blink ved nytt nummer og fullskjerm.
- Admin: `/admin` med QR-koder laget på serveren, utskrift én stasjon per side, nullstill, aktiver/deaktiver, bytt nøkkel, rediger beskrivelse og bytt PIN.
- Postgres-skjema med migreringer som kjøres ved hver bygging.
- Enhetstester og integrasjonstester (bl.a. 200 samtidige skann og samtidige NESTE).
- CI i GitHub Actions, dokumentasjon for mennesker og AI (`AGENTS.md`, `docs/`).

### Sikkerhet (rettet fra piloten)
- Nøkler og PIN sendes aldri til nettleseren. PIN sjekkes på serveren og lagres som scrypt-hash.
- Ingen direkte databasetilgang fra nettleseren. Alle endringer krever økt og riktig `Origin`.
- QR-koder lages i appen, ikke hos tredjepart.
- Forsøksgrenser for PIN og nye kølapper, sterke nøkler (128 bit), sikkerhetshoder (CSP m.fl.).
- Nummertildeling og køhandlinger er atomiske (låst transaksjon), så duplikater og dobbel kalling er umulig.
