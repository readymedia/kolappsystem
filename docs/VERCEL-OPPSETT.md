# Oppsett på Vercel – steg for steg

Tar ca. 10 minutter. Alt er gratis (Vercel Hobby + Neon Free). Du trenger bare en Vercel-konto koblet til GitHub.

## Steg 1 – Importer prosjektet

1. Gå til [vercel.com/new](https://vercel.com/new).
2. Velg **Import** ved repoet `readymedia/kolappsystem`.
3. La alt stå som det er (Framework: Next.js blir valgt automatisk).
4. Trykk **Deploy**.

Første bygg går fint uten database. Til steg 2 og 3 er gjort, viser forsiden ingen stasjoner, og innlogging på `/operator` og `/admin` gir meldingen «Databasen er ikke koblet til ennå».

## Steg 2 – Legg til gratis database (Neon)

1. Åpne prosjektet i Vercel og gå til fanen **Storage**.
2. Trykk **Create Database** og velg **Neon** (Serverless Postgres).
3. Velg plan **Free** og region **Frankfurt (eu-central-1)**. Den ligger nærmest Norge og samme sted som appen kjører (`fra1`).
4. Trykk **Create**, og deretter **Connect** til prosjektet. Huk av **bare Production** (ta bort Preview og Development).

Vercel legger nå selv inn `DATABASE_URL` i prosjektet. Du skal ikke kopiere noe for hånd.

Hvorfor bare Production: da kan ingen test-versjon (forhåndsvisning) eller lokal maskin tilfeldigvis endre den ekte køen. Vil du teste i forhåndsvisninger senere, lag en egen Neon-gren til dem.

## Steg 3 – Bygg på nytt (lager tabellene)

1. Gå til fanen **Deployments**.
2. Trykk **⋯** på øverste rad og velg **Redeploy**.

Under bygget lages tabellene, stasjonene A, B og C med nye hemmelige nøkler, og PIN `1234`. I byggeloggen står det `[migrate] databasen er oppdatert`.

## Steg 4 – Bytt PIN og skriv ut QR-koder

1. Åpne `https://<ditt-prosjekt>.vercel.app/admin`.
2. Logg inn med PIN **1234**.
3. **Bytt PIN med en gang** nederst på siden (4–12 sifre). Del den nye PIN-en bare med funksjonærene.
4. Sjekk at beskrivelsene for A, B og C stemmer (blyant-ikonet).
5. Trykk **Skriv ut**. Hver stasjon kommer på sin egen side.

## Steg 5 – Test

- [ ] Skann QR for A med mobilen → du får lapp **A1** og ser «Du er nest i køen».
- [ ] Skann samme kode igjen med samme mobil → du får **samme** lapp, ikke ny.
- [ ] Åpne `/operator?station=A` på en annen mobil, logg inn, trykk **NESTE** → første mobil blir grønn.
- [ ] Åpne `/display` på en PC → A1 vises under «Nå betjenes».
- [ ] Trykk **Nullstill kø** for A i `/admin` før arrangementet.

## Valgfritt

| Hva | Hvor | Hvorfor |
| --- | --- | --- |
| Eget domene | Settings → Domains | Penere QR-lenke. Skriv ut QR-kodene **etter** at domenet er satt. |
| `SESSION_SECRET` | Settings → Environment Variables | Ikke nødvendig – appen lager en selv og lagrer den i databasen. Sett en (minst 32 tilfeldige tegn) hvis du vil styre den selv. |
| `INITIAL_PIN` | Settings → Environment Variables | Bare nyttig **før** steg 3 hvis du ikke vil starte med 1234. |
| `PUBLIC_BASE_URL` | Settings → Environment Variables | Adressen QR-kodene skal peke på, f.eks. `https://ko.readymedia.no`. Uten den brukes prosjektets produksjonsdomene automatisk. |

## Hvis noe går galt

| Symptom | Løsning |
| --- | --- |
| «Databasen er ikke koblet til ennå» eller ingen stasjoner på forsiden | Steg 2 er ikke gjort, eller steg 3 (Redeploy) mangler. |
| Byggfeil `[migrate] feilet` | Sjekk at Neon er koblet til (Settings → Environment Variables skal ha `DATABASE_URL`). |
| Glemt PIN | Se `docs/SIKKERHET.md` → «Glemt PIN». |
| Prosjektet er pauset | Hobby-grensen er nådd (svært usannsynlig, se `AGENTS.md` §6). Oppgrader til Pro midlertidig. |
