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
| Personvern | Ingen persondata. IP-adresser lagres aldri; kun en HMAC av nettverket (for flomvern) som slettes ved nullstilling. |

Funn fra piloten (Base44) som er rettet: nøkler og PIN lå åpent i nettleseren, PIN ble sjekket i nettleseren, databasen tok imot skriving fra alle, og QR-kodene ble laget hos en tredjepart med nøkkelen i URL-en.

## Hemmeligheter

| Hva | Hvor | Hvem ser den |
| --- | --- | --- |
| `DATABASE_URL` | Vercel → Environment Variables (settes av Neon) | Vercel-eiere |
| `join_key` per stasjon | Databasen | Admin (i QR og lenke) |
| PIN | Databasen som scrypt-hash | Ingen – bare den som vet den |
| Øktnøkkel | `SESSION_SECRET` i Vercel, ellers `settings.session_secret` | Ingen |

## Rutiner

- **Før arrangementet:** Bytt PIN, trykk «Bytt nøkkel» for alle stasjoner, skriv ut nye QR-koder.
- **QR-kode delt på nett:** «Bytt nøkkel» for den stasjonen, heng opp ny utskrift. Lapper som allerede er delt ut, virker fortsatt.
- **PIN kommet på avveie:** Bytt PIN i `/admin`. Alle andre logges ut med en gang.
- **Etter arrangementet:** Nullstill alle køer og bytt PIN.

## Glemt PIN

1. Kopier `DATABASE_URL` fra Vercel → Settings → Environment Variables (Production).
2. Kjør fra en maskin med repoet klonet og `npm install` gjort:

```bash
DATABASE_URL="<lim inn>" node scripts/reset-pin.mjs 1234
```

PIN er nå 1234 og alle er logget ut. Bytt den i `/admin` med en gang.

## Kjente begrensninger

- PIN-en er felles for operator og admin (kundens valg). En operatør kan derfor også nullstille køer. Kan deles i to PIN-er senere.
- Den globale PIN-grensen betyr at noen som bevisst gjetter mye kan sperre innlogging i 15 minutter. Allerede innloggede operatører påvirkes ikke, og økta fornyes mens de bruker den.
- `script-src 'unsafe-inline'` er nødvendig for Next.js uten nonce-oppsett. Det finnes ingen eksterne skript.
- Lokalt (uten Vercel foran) kan `x-real-ip` forfalskes. På Vercel settes den av plattformen.
- `npm audit` viser varsler i ESLint-verktøy (kun utvikling, sendes ikke til produksjon).
