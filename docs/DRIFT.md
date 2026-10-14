# Drift og overvåking

Hvordan appen holdes stabil i produksjon, og hva du gjør når noe skjer.

## Helsesjekk og røyktest

| Verktøy | Bruk | Endrer data? |
| --- | --- | --- |
| `GET /api/health` | Svarer `{"ok":true,"version":…,"commit":…,"db":"ok","migration":…}`. 503 hvis databasen ikke svarer. | Nei |
| `BASE_URL=https://kolappsystem.vercel.app npm run smoke` | 10 sjekker: helse, offentlig status uten hemmeligheter, CDN-mellomlagring, sikkerhetshoder, innloggingskrav, Origin-vern, 404. | Nei |

Kjør røyktesten etter hver deploy og morgenen før arrangementet.

**Ekstern overvåking (valgfritt):** En tjeneste som UptimeRobot kan kalle `/api/health`. Sett intervallet til **én gang i timen eller sjeldnere**. Neon Free sover etter 5 minutter uten trafikk, og hyppigere kall holder databasen våken døgnet rundt. Det bruker opp de 100 gratis CU-timene i måneden.

## Under arrangementet

- **Frys deploy.** Ikke push til `main` mens arrangementet pågår, fordi hver push deployer og migrerer produksjon. Gjør endringer på en egen gren.
- **Ikke bruk «Promote» eller «Instant Rollback»** uten å vite hva du gjør. De kjører ikke migreringer, så ny kode kan møte gammelt skjema. Rull heller tilbake med `git revert` og vanlig deploy.
- **Følg med på forbruket:** Vercel → prosjektet → **Usage**. Grensene står i `AGENTS.md` §6.
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
| Operatør kastes ut til PIN-skjermen | PIN er byttet, eller økta er utløpt (24 t uten bruk) | Logg inn igjen. Køen er uendret. |
| `/api/health` gir `db: "error"` | Neon utilgjengelig eller kvote brukt opp | Neon-konsollen → Monitoring. Vercel → Storage. |
| Prosjektet er pauset | Hobby-kvote brukt opp | Oppgrader til Pro, eller vent 30 dager. Se `AGENTS.md` §6. |

## Logger

Vercel → prosjektet → **Logs** (Hobby beholder dem i 1 time). API-feil logges som `[api] …`, og travle eller tapte tilkoblinger som `[api] travelt/tilkobling …`. PIN, nøkler og IP-adresser logges aldri.
