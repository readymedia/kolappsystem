# Prodklarhet – vurdering

**Konklusjon:** Appen er klar for produksjon på en konferanse med noen hundre deltakere. Det gjenstår tre ting som må gjøres manuelt før arrangementet, se «Før arrangementet» nederst. Vurderingen gjelder versjon 1.1.0 (2026-10-14).

## Status per område

| Område | Status | Grunnlag |
| --- | --- | --- |
| Korrekt kø (unike nummer, én kalt) | Klar | Låst transaksjon per operasjon. Testet med 200 samtidige skann, samtidige NESTE og dobbelt trykk på Angre. Lasttest: 300 telefoner, 0 duplikater. |
| Ytelse | Klar | Lasttest lokalt (300 telefoner + 3 operatører i 60 s): skann p50 11 ms / p95 28 ms, status p50 5 ms, 0 feil. I produksjon deles statusen via CDN i tillegg. |
| Robusthet mot dårlig nett | Klar | 8 s tidsgrense på alle kall, automatisk ny henting, varsel «Mistet kontakten» etter 3 feil. Skann som gjentas gir aldri dobbeltlapp (requestId). |
| Robusthet i database | Klar | Tidsgrenser for lås/spørring (5 s / 10 s), tilkoblinger fornyes hvert 10. minutt, lesing prøves én gang til ved død tilkobling. |
| Sikkerhet – hemmeligheter | Klar | Nøkler og PIN forlater aldri serveren. Testet i integrasjons-, E2E- og røyktest. |
| Sikkerhet – innlogging | Klar | scrypt-hash, sjekk på serveren, 5 forsøk/15 min per nettverk + global grense, ny PIN krever 6+ sifre, varsel ved standard-PIN. |
| Sikkerhet – opplastede filer | Klar | Lyd og logo sjekkes på innhold, SVG-vern, `sandbox`-CSP på `/api/media` (rettet i v1.4, se `SIKKERHET.md`). |
| Sikkerhet – misbruk av delt QR | Klar | Maks 100 ventende per nettverk per stasjon, egen grense for feil nøkkel, «Fjern ventende lapper» og «Bytt nøkkel» i admin. |
| Sikkerhet – nettleser | Klar med forbehold | Streng CSP, nosniff, DENY-ramming, no-referrer, Origin-sjekk. Forbehold: `script-src 'unsafe-inline'` (Next.js uten nonce). |
| Kvoter på Vercel Hobby | Klar med forbehold | Beregnet ca. 17 % av CDN-kvoten per dag. Forbehold: kall med tilfeldige parametere kan omgå CDN-et. Lukkes med én brannmurregel (`docs/DRIFT.md`). |
| Feilsider | Klar | Norske feilsider for 404, sidekrasj og rammekrasj. Publikum ser aldri tekniske detaljer. |
| Overvåking | Klar | `/api/health` og `npm run smoke` (kan kjøres mot produksjon uten å endre data). |
| Tester og CI | Klar | 100 enhetstester, 59 integrasjonstester mot Postgres, 36 E2E-tester i ekte nettleser og 20 røyktester (v1.7.0), pluss lasttest med 7 stasjoner. Uavhengig gjennomgang av v1.2–v1.4 gjort 15.10 (se `SIKKERHET.md`). Alt kjører i GitHub Actions ved hver push. |
| Avhengigheter | Klar | Dependabot ukentlig. `npm audit`-varsler gjelder kun ESLint-verktøy i utvikling. |
| Dokumentasjon | Klar | README, AGENTS.md, startprompt, arkitektur, sikkerhet, drift, oppsett, kjøreplan, operatørguide, admin-guide, lydoppsett, beslutninger. |
| Enheter | Delvis testet | iPhone/Safari testet i produksjon. Android/Chrome testet i automatisk nettleser, ikke på fysisk telefon. |

## Gjenstående risiko

| Risiko | Sannsynlighet | Konsekvens | Tiltak |
| --- | --- | --- | --- |
| Vercel Hobby er etter vilkårene for ikke-kommersiell bruk | Avhenger av arrangementet | Prosjektet kan bli begrenset | Bruk Pro (gjerne prøveperiode) hvis arrangementet er kommersielt. Ingen kodeendring. |
| Kvote brukt opp ved målrettet angrep | Lav | Prosjektet pauses i 30 dager | Brannmurregel i `DRIFT.md`, følg med på Usage, Attack Challenge Mode ved behov |
| QR vist på storskjerm (valgfritt) | Middels hvis slått på | Lapper tas uten å være på stedet | Bevisst akseptert, varsel i admin. «Bytt nøkkel» gjør QR og skjermlenke ugyldige. |
| Ustabilt nett i lokalet | Middels | Gjester ser varsel, mister ikke plassen | Ha storskjermen synlig, operatør roper opp nummer |
| Felles PIN kjent av mange | Middels | En operatør kan også nullstille køer | Del PIN med få. Kan deles i operator-/admin-PIN senere. |
| Deploy under arrangementet | Lav | Kort nedetid eller skjemaendring | Frys `main` under arrangementet |
| Logger beholdes bare 1 time (Hobby) | – | Vanskeligere feilsøking i ettertid | Noter tidspunkt ved problemer og se i loggene med en gang |

## Før arrangementet (manuelt)

- [ ] Sett opp brannmurregelen for `/api/state` (`docs/DRIFT.md`).
- [ ] Bytt PIN til minst 6 sifre (`/admin` viser varsel til det er gjort).
- [ ] Test én QR på en Android-telefon (vibrering + grønn skjerm).

Resten står i `docs/KJOREPLAN.md`.
