# Kølappsystem (KøKlar)

Digitalt kølappsystem for meet-and-greet med tre stasjoner, **A**, **B** og **C**. Publikum skanner en QR-kode, får en kølapp på mobilen og følger køen live. Funksjonærer styrer køen fra mobilen, og en storskjerm viser hvem som betjenes.

Alt er på norsk, laget for mobil og kjører gratis på **Vercel Hobby** med **Neon Postgres (Free)**.

| | |
| --- | --- |
| Versjon | se [`CHANGELOG.md`](CHANGELOG.md) og `package.json` |
| Stack | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Postgres (Neon) via `postgres` |
| Produksjon | https://kolappsystem.vercel.app |
| Drift | Vercel Hobby (region `fra1`) + Neon Free (Frankfurt) |
| Forløper | Pilot i Base44 (mtsko.base44.app), erstattet av denne versjonen fra v1.0.0 |

## Sider

| Side | Hvem | Tilgang |
| --- | --- | --- |
| `/` | Alle | Åpen. Oversikt over stasjoner og lenker. |
| `/join?station=A&key=…` | Publikum (via QR) | Åpen, men krever stasjonens hemmelige nøkkel |
| `/ticket/:id` | Publikum | Åpen, id-en er en tilfeldig UUID |
| `/display` | Storskjerm (PC/TV) | Åpen. Valg i adressen (`?station=A&size=xl` …) lages under «Skjermer» i admin. `?sound=1` spiller lydsignal. |
| `/audio` | Lydside for PC/iPad mot lydanlegg (`?station=A` for én stasjon) | Åpen |
| `/operator?station=A` | Funksjonærer | PIN |
| `/admin` | Ansvarlig | PIN (samme PIN som operator) |
| `/admin/utseende` | Ansvarlig: navn, logo, farge og fonter per arrangement | PIN |

## Kom i gang lokalt

Krever Node 22 og en Postgres-database (lokal eller en Neon-gren).

```bash
npm install
cp .env.example .env.local        # sett DATABASE_URL
npm run db:migrate                # lager tabeller + stasjoner A/B/C + PIN 1234
npm run dev                       # http://localhost:3000
```

## Kommandoer

| Kommando | Hva den gjør |
| --- | --- |
| `npm run dev` | Utviklingsserver |
| `npm run build` | Migrerer databasen (hvis `DATABASE_URL` finnes) og bygger. Brukes av Vercel. |
| `npm run db:migrate` | Kjører migreringer og startdata manuelt |
| `npm run check` | Typesjekk + lint + tester (kjør før hver commit) |
| `npm test` | Enhetstester. Integrasjonstester kjøres når `TEST_DATABASE_URL` er satt. |
| `npm run test:e2e` | Ende-til-ende i ekte nettleser (krever `E2E_DATABASE_URL` og `npm run build`) |
| `npm run smoke` | Røyktest mot `BASE_URL` (også produksjon) – endrer ingen data |
| `npm run load` | Lasttest mot lokal app (300 telefoner + 3 operatører) |

## Dokumentasjon

| Fil | Innhold |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | **Start her hvis du er en AI-agent.** Regler, invarianter, kart over koden. |
| [`docs/START-PROMPT.md`](docs/START-PROMPT.md) | Ferdig startprompt for å la en hvilken som helst AI ta over prosjektet |
| [`docs/VERCEL-OPPSETT.md`](docs/VERCEL-OPPSETT.md) | Steg for steg: fra GitHub til kjørende app på Vercel |
| [`docs/ARKITEKTUR.md`](docs/ARKITEKTUR.md) | Datamodell, API, flyt, kostnadsbudsjett for Vercel Hobby |
| [`docs/SIKKERHET.md`](docs/SIKKERHET.md) | Trusselbilde, tiltak og hva du gjør ved lekkasje |
| [`docs/UI-SPEC.md`](docs/UI-SPEC.md) | Alle tekster, farger og tilstander per side |
| [`docs/KJOREPLAN.md`](docs/KJOREPLAN.md) | Sjekkliste før, under og etter arrangementet |
| [`docs/ADMIN-GUIDE.md`](docs/ADMIN-GUIDE.md) | Admin steg for steg: stasjoner, stenging med melding, skjermer, utseende og logo, lydsignal |
| [`docs/LYD-OPPSETT.md`](docs/LYD-OPPSETT.md) | Oppsett og feilsøking av lydsignal (PC med musikk, iPad, storskjerm) |
| [`docs/DRIFT.md`](docs/DRIFT.md) | Overvåking, brannmur, grenser og feilsøking i drift |
| [`docs/PRODKLARHET.md`](docs/PRODKLARHET.md) | Vurdering av prodklarhet og gjenstående risiko |
| [`docs/PLAN-UTVIDELSER.md`](docs/PLAN-UTVIDELSER.md) | Implementasjonsplan v1.2–2.0: lyd, skjermer, utseende/logo, push, fleksible stasjoner (1.2–1.4 godkjent) |
| [`docs/OPERATOR-GUIDE.md`](docs/OPERATOR-GUIDE.md) | Én side for funksjonærene |
| [`docs/BESLUTNINGER.md`](docs/BESLUTNINGER.md) | Arkitekturbeslutninger (ADR) med begrunnelse |
| [`CHANGELOG.md`](CHANGELOG.md) | Versjonshistorikk |

## Versjonering

[Semantisk versjonering](https://semver.org/lang/no/): `MAJOR.MINOR.PATCH`. Hver release får en linje i `CHANGELOG.md`, ny `version` i `package.json` og en git-tag `vX.Y.Z`. Se [`AGENTS.md`](AGENTS.md#versjonering-og-commits).

## Om

Utviklet av **Andreas Aarlott** ([andreas.aarlott@ntnu.no](mailto:andreas.aarlott@ntnu.no)) med AI-støttet utvikling. Informasjonen vises også i «Om appen» på `/admin` (ikke på publikumssidene).
