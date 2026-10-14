# UI-spesifikasjon

Kilden til sannhet for utseende og tekster. Oppdater denne når du endrer noe publikum eller funksjonærer ser. Tekstene er hentet fra piloten og beholdt ordrett der det var mulig.

## Felles

| Element | Verdi |
| --- | --- |
| Fonter | Space Grotesk (overskrifter, store tall) og Inter (brødtekst), lastet fra appen via `@fontsource` |
| Lys bakgrunn | `#fbfaf8` (`bg-paper`), hvite kort med `rounded-[2rem]` og myk skygge |
| Stasjon A | Himmelblå: `sky-50` / `sky-200` / `sky-500` / `sky-600`, storskjerm `sky-400` |
| Stasjon B | Fiolett: `violet-*`, samme trinn |
| Stasjon C | Smaragd: `emerald-*`, samme trinn |
| Animasjon `pulser` | Nummer på «din tur»-skjermen: 1 → 1,05 → 1, 1,8 s, uendelig |
| Animasjon `kallblink` | Storskjerm-kolonne: opasitet 0,35 og 4 px opp, 0,9 s × 4 (4,5 s totalt) |
| Bevegelse av | `prefers-reduced-motion` slår av begge animasjonene |
| Tittel | «Kølapp – Meet & Greet», app-navn «KøKlar» |
| Oppdatering | Hvert 3. sekund, pauser når fanen er skjult |

## `/` Forside

Overtekst «MEET & GREET», tittel «Kølappsystem», ingress «Tre stasjoner, én digital kø. Publikum skanner QR-koden ved inngangen og følger med på sin egen kølapp.» Tre kort per stasjon («STASJON A», beskrivelse, «ÅPEN»/«STENGT»). Knapper: «Storskjerm», «Operator», «Admin».

## `/join`

| Tilstand | Tittel | Tekst |
| --- | --- | --- |
| Henter | Henter kølappen din … | Du får et nummer og kan følge køen videre. |
| Ukjent stasjon | Ugyldig lenke | Denne lenken peker ikke på en gyldig stasjon. |
| Feil nøkkel | Ugyldig lenke | Lenken er ikke gyldig. Spør en funksjonær om hjelp. |
| Stengt | Stasjon X er stengt | Det deles ikke ut kølapper her akkurat nå. Ta kontakt med en funksjonær, så hjelper vi deg videre. |
| For mange | Ugyldig lenke | Det kom mange forespørsler på kort tid. Vent litt og prøv igjen. |
| Flom fra nettverk | Ugyldig lenke | Det står allerede svært mange i kø fra dette nettverket. Ta kontakt med en funksjonær. |
| Travelt | Ugyldig lenke | Systemet er travelt akkurat nå. Prøv igjen om et øyeblikk. |
| Annen feil | Ugyldig lenke | Noe gikk galt. Prøv å skanne koden på nytt. |

## `/ticket/:id`

| Status | Visning |
| --- | --- |
| Venter | Bakgrunn i stasjonsfarge. «KØLAPP · STASJON A», kort «Din plass i køen» + «A12» (6,5rem) + merke «Venter». Kort med antall foran og ventetid. Knapp «Trykk her for å få vibrering når det er din tur» (bare Android). Kort «DU SKAL MØTE». Bunntekst «Siden oppdaterer seg selv. Ha den åpen – vi gir beskjed her når det er din tur.» |
| Kalt | Grønn (`emerald-500`), pulserende «A12», «Det er din tur!», «Gå til stasjon A», beskrivelse. Vibrerer 300-150-300-150-500 ms. Fanetittel «Din tur! A12». |
| Hoppet over | Gul (`amber-400`), timeglass, «Du ble hoppet over», «Vi ropte opp nummeret ditt, men så deg ikke. Snakk med en funksjonær, så setter vi deg inn igjen i køen.», nummer. |
| Ferdig | Mørk (`slate-900`), grønn hake, «Ferdig – takk for besøket!», «Kølappen er avsluttet. Velkommen tilbake senere.» |
| Ikke funnet | «Fant ikke kølappen», «Lenken kan være utdatert. Skann QR-koden på nytt for å få en ny lapp.» |

Antall foran: 0 → «Du er nest i køen», 1 → «1 person foran deg», ellers «X personer foran deg».
Ventetid: 0 → «Under 2 minutter», ellers «Ca. X×2 minutter».
Skjermen holdes våken (Wake Lock) mens lappen venter eller er kalt.
Etter 3 mislykkede oppdateringer på rad vises et gult felt: «Mistet kontakten – prøver igjen. Sjekk at du har nett.»

## `/operator?station=X`

- PIN-skjerm: lås-ikon, «Operator», «Skriv inn PIN-koden for å fortsette», felt «PIN», knapp «Lås opp», feil «Feil PIN-kode. Prøv igjen.» / «For mange feil forsøk. Vent 15 minutter og prøv igjen.»
- Topp: stasjonsvelger A/B/C og «Logg ut».
- «OPERATOR», «Stasjon A», merke «N venter».
- Kort «BETJENES NÅ» med nummer eller «–», undertekst «Åpen for kø» eller «Stasjonen er satt til stengt» (rød).
- Kort «NESTE I KØEN» med 5 neste («Neste», «2. i kø» …) eller «Ingen venter akkurat nå.»
- Kort «HOPPET OVER» (bare når det finnes) med «Sett tilbake i kø» per lapp.
- Fast bunnpanel: «NESTE» (96 px, stasjonsfarge), «Hopp over» (av når ingen betjenes), «Angre siste» (av når det ikke er noe å angre).

## `/display`

Svart bakgrunn. «MEET & GREET · KØSTATUS» og en diskret fullskjerm-knapp. Tre kolonner: «Stasjon A», «ÅPEN»/«STENGT», «NÅ BETJENES», gigantisk «A12» i stasjonsfarge (eller svak «–»), «Neste: A13, A14, A15». Blinker ved nytt nummer. Viser «Mistet kontakten med serveren – prøver igjen …» ved nettfeil.

## `/admin`

- Samme PIN-skjerm med tittel «Admin».
- Gult varsel øverst så lenge standard-PIN brukes: «Du bruker fortsatt standard-PIN 1234. Bytt den nederst på siden før arrangementet (minst 6 sifre).»
- «ADMIN», «Stasjoner og QR-koder», forklaring, knappene «Logg ut» og «Skriv ut».
- Kort per stasjon: navn, «Aktiv»/«Stengt», QR-kode, lenke, «Kopier lenke», «N venter · M lapper delt ut», beskrivelse med redigering, «Nullstill kø» (bekreft: «Bekreft nullstilling»), «Deaktiver»/«Aktiver», «Bytt nøkkel» (bekreft: «Bekreft – gamle QR slutter å virke»), lenker «Operator» og «Storskjerm».
- «Fjern ventende lapper …» per stasjon: felt «Fra A…» og «til A…», knapp «Fjern», svar «Fjernet N ventende lapper.»
- Kort «PIN-kode»: «Felles for operator og admin. Ny PIN logger ut alle andre enheter.», felt «Ny PIN», «Lagre», feil «PIN må være 6–12 sifre.», bekreftelse «PIN-koden er lagret. Alle andre er logget ut.»
- Kort «Om appen» (kun i admin, aldri for publikum): App «KøKlar – kølappsystem for meet-and-greet», Versjon «1.1.0 · <commit>», Utvikler «Andreas Aarlott · andreas.aarlott@ntnu.no» (mailto-lenke), Utvikling «AI-støttet utvikling».
- Utskrift: én stasjon per side med stort navn, beskrivelse, QR (12 cm) og «Skann for å få kølapp».

## 404

«404», «Siden finnes ikke», «Har du en kølapp? Skann QR-koden ved stasjonen på nytt.», knapp «Til forsiden».

## Feilside

Ved krasj: «Noe gikk galt», «Prøv igjen. Hjelper ikke det, spør en funksjonær.», knapp «Prøv igjen».
