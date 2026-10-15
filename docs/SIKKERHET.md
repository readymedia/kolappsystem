# Sikkerhet

Målet er enkelt: publikum trenger bare QR-koden, og bare funksjonærer med PIN kan styre køen. Ingen persondata lagres – en kølapp er bare et nummer.

## Trusselbilde og tiltak

| Trussel | Tiltak |
| --- | --- |
| Noen lager kølapper uten å være på stedet | Hemmelig nøkkel på 128 bit i QR-lenken, sjekket på serveren i konstant tid. Nøkkelen sendes aldri i offentlige API-svar. |
| QR-koden deles på nett | «Bytt nøkkel» i `/admin` gjør gamle koder ugyldige straks. Skriv ut nye. |
| Masse-oppretting av lapper (f.eks. fra en QR delt på nett) | Krever gyldig nøkkel. Maks 300 nye lapper per minutt og maks 100 **ventende** per nettverk per stasjon. Skann med feil nøkkel har egen grense (20/min) og sjekkes før stasjonen låses. Admin kan fjerne ventende lapper i et nummerområde. |
| Gjetting av PIN | 5 forsøk per 15 minutter per nettverk (IPv6 grupperes på /64), telt før PIN sjekkes, og maks 100 feil totalt per 15 minutter. Ny PIN må ha 6–12 sifre. `/admin` varsler så lenge standard-PIN 1234 brukes. PIN lagres som scrypt-hash. |
| Stjålet eller gammel innlogging | Økta varer 24 timer og fornyes ved bruk. Å bytte PIN logger ut alle andre enheter (`pin_version`). |
| CSRF (falske skjema fra andre nettsteder) | `SameSite=Lax`-cookie + krav om riktig `Origin` på alle endringer. |
| XSS / innsatt skript | React escaper all tekst. Streng CSP uten eksterne kilder. QR-SVG lages på serveren av egen URL. |
| Nøkkel lekker via Referer | `Referrer-Policy: no-referrer`, og `/join` erstattes i historikken med `/ticket/:id`. |
| Innramming / clickjacking | `X-Frame-Options: DENY` og `frame-ancestors 'none'`. |
| Gjetting av andres lapp | Lapp-id er tilfeldig UUID (122 bit). Lappen inneholder ingen persondata. |
| Direkte databasetilgang | Ingen. Databasen nås bare fra serveren med `DATABASE_URL` i Vercel. |
| Test-versjon endrer ekte data | Databasen kobles bare til Production, og migrering kjøres bare i produksjonsbygg. |
| Oppbrukt Vercel-kvote (DoS) | `/api/state` deles via CDN. Brannmurregel mot parametere på `/api/state` og Attack Challenge Mode, se `docs/DRIFT.md`. |
| Noen gir fra seg andres plass (v1.7) | Krever lapp-id (tilfeldig UUID, bare på gjestens mobil). Origin-sjekk og forsøksgrense. Kan slås av i admin. |
| Gjetting av stasjonskoder (v1.6) | Skann mot ukjent eller arkivert stasjon teller som feil forsøk (20/min). Uten riktig nøkkel får man uansett ingen lapp. |
| QR-kode vist på storskjerm (valgfritt, v1.3) | Bevisst akseptert risiko: bildet kan fotograferes og deles, og skjermlenken gir også tilgang. Admin viser risikovarsel når QR slås på. Skjermlenken inneholder et signert token (HMAC av stasjoner og nøkler), aldri nøkkelen. Tokenet sjekkes i konstant tid, og «Bytt nøkkel» gjør både QR og skjermlenke ugyldige. Ellers gjelder vernet over (maks 100 ventende per nettverk, «Fjern ventende lapper»). |
| Serveren misbrukes til å kalle vilkårlige adresser (SSRF) via push | Push-adresser godtas bare for kjente push-tjenester over https (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`, `*.notify.windows.com`), uten brukernavn eller annen port. Testmottaker kun med `PUSH_TEST_ENDPOINT` utenfor produksjon. |
| Push-varsel til feil person | Abonnement knyttes til lapp-id (tilfeldig UUID, adgangsbeviset til lappen). Innholdet er kryptert til gjestens nettleser. Ingen persondata. |
| Ondsinnet logo (SVG med skript) | Kun med admin-økt og riktig Origin. Maks 512 kB, filtype sjekket på innhold. SVG avvises hvis den inneholder skript (også med navnerom-prefiks), hendelser (`on…=`), `foreignObject`, elementer med prefiks, entiteter og tegnkoder (utover `&amp;` `&lt;` `&gt;` `&quot;` `&apos;`), `javascript:`, `@import`, skråstrek bakover (CSS-escape), animasjon av lenker (`<set>`/`<animate>` på `href`) eller lenker/`url()` til andre filer. Filteret er et ekstra lag og ble strammet inn etter en uavhengig gjennomgang (v1.4.1). Logoen vises alltid som `<img>` (der nettlesere aldri kjører skript), og serveres med `sandbox`-CSP. |
| Ondsinnet opplasting (lyd) | Kun med admin-økt og riktig Origin. Maks 2 MB. Filtype sjekkes på innholdet (magiske bytes), ikke filnavnet. Filer serveres med `Content-Security-Policy: sandbox`, `nosniff` og egen `Content-Type`, så de aldri kan kjøres som side eller skript. |
| Rapport og CSV (v1.8) | Bare bak admin-økt, aldri mellomlagret (`no-store`). Inneholder bare tellinger og tider per stasjon – ingen lapp-id, IP-hash eller nøkler (integrasjonstest). «Nullstill alle køer» krever økt og Origin-sjekk. |
| Fylle opp køen for å stenge andre ute (v1.8, når maks i kø er satt) | Samme vern som for falske lapper (nøkkel, 100 ventende per nettverk, «Fjern ventende lapper»). Grensen er valgfri og av som standard. |
| Personvern | Ingen persondata. IP-adresser lagres aldri; kun en HMAC av nettverket (for flomvern) som slettes ved nullstilling. |

Funn fra piloten (Base44) som er rettet: nøkler og PIN lå åpent i nettleseren, PIN ble sjekket i nettleseren, databasen tok imot skriving fra alle, og QR-kodene ble laget hos en tredjepart med nøkkelen i URL-en.

## Hemmeligheter

| Hva | Hvor | Hvem ser den |
| --- | --- | --- |
| `DATABASE_URL` | Vercel → Environment Variables (settes av Neon) | Vercel-eiere |
| `join_key` per stasjon | Databasen | Admin (i QR og lenke) |
| PIN | Databasen som scrypt-hash | Ingen – bare den som vet den |
| Øktnøkkel | `SESSION_SECRET` i Vercel, ellers `settings.session_secret` | Ingen |
| VAPID-privatnøkkel (push) | `VAPID_PRIVATE_KEY` i Vercel, ellers `settings.vapid_private` | Ingen. Den offentlige nøkkelen sendes til nettleseren. |

## Rutiner

- **Før arrangementet:** Bytt PIN, trykk «Bytt nøkkel» for alle stasjoner, skriv ut nye QR-koder.
- **QR-kode delt på nett:** «Bytt nøkkel» for den stasjonen, heng opp ny utskrift. Lapper som allerede er delt ut, virker fortsatt. Bruker storskjermen QR: lag ny skjermlenke under «Skjermer» (den gamle slutter å virke), eller slå av QR.
- **PIN kommet på avveie:** Bytt PIN i `/admin`. Alle andre logges ut med en gang.
- **Etter arrangementet:** Nullstill alle køer og bytt PIN.

## Glemt PIN

1. Kopier `DATABASE_URL` fra Vercel → Settings → Environment Variables (Production).
2. Kjør fra en maskin med repoet klonet og `npm install` gjort:

```bash
DATABASE_URL="<lim inn>" node scripts/reset-pin.mjs 1234
```

PIN er nå 1234 og alle er logget ut. Bytt den i `/admin` med en gang.

## Rettet i v1.4

- **Sandbox-CSP på opplastede filer virket ikke (v1.2–v1.3).** Sidenes felles CSP fra `next.config.ts` overstyrte hodet ruten `/api/media` satte. Nå settes `default-src 'none'; sandbox` for `/api/media/*` i `next.config.ts`, og sidenes CSP gjelder alle andre adresser. Røyktesten og E2E sjekker hodet. Lydfiler var aldri utsatt (kan ikke kjøre kode), og logo-opplasting fantes ikke før v1.4.

## Uavhengig gjennomgang av v1.2–v1.4 (15.10)

En egen gjennomgang uten kjennskap til arbeidet fant ingen lekkasjer av hemmeligheter og ingen utnyttbare hull. Rettet i v1.4.1: omgåelser av SVG-filteret (ikke utnyttbare pga. `<img>` og sandbox-CSP), samtidige filopplastinger kunne gi feil, og noen admin-detaljer (se `CHANGELOG.md`). Bevisst ikke endret: lydens lengde (15 s) sjekkes bare i nettleseren; `/api/display/qr` har ingen egen forsøksgrense (tokenet er 192 bit, og formatet sjekkes før databasen).

## Kjente begrensninger

- PIN-en er felles for operator og admin (kundens valg). En operatør kan derfor også nullstille køer. Kan deles i to PIN-er senere.
- Den globale PIN-grensen betyr at noen som bevisst gjetter mye kan sperre innlogging i 15 minutter. Allerede innloggede operatører påvirkes ikke, og økta fornyes mens de bruker den.
- `script-src 'unsafe-inline'` er nødvendig for Next.js uten nonce-oppsett. Det finnes ingen eksterne skript.
- Lokalt (uten Vercel foran) kan `x-real-ip` forfalskes. På Vercel settes den av plattformen.
- `npm audit` viser varsler i ESLint-verktøy (kun utvikling, sendes ikke til produksjon).
