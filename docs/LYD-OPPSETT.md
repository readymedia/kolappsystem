# Lydsignal – oppsett

Lydsignalet spilles når et nytt nummer kalles (NESTE, Hopp over som kaller neste, eller Angre som kaller tilbake). Det spilles på **lydsiden** `/audio`, som står åpen på en PC eller iPad koblet til lydanlegget, og eventuelt på **storskjermen** med `?sound=1`.

## Kort fortalt

1. `/admin` → **Lydsignal**: velg «Standardlyd» eller last opp egen lyd, og still volumet.
2. Åpne `https://kolappsystem.vercel.app/audio` på maskinen som er koblet til lydanlegget.
3. Trykk **«Start lydsignal»**. Nettlesere krever ett trykk før de spiller lyd.
4. Trykk **«Test lyd»** og juster volumet på maskinen og lydanlegget.
5. La siden stå åpen. «Sist sjekket» skal oppdateres hvert 3. sekund.

## Adresser

| Adresse | Spiller for |
| --- | --- |
| `/audio` | Alle stasjoner |
| `/audio?station=A` | Bare stasjon A |
| `/audio?station=A,C` | Stasjon A og C |
| `/display?sound=1` | Storskjermen spiller selv (klikk «Klikk for å slå på lyd» én gang). Lages også med «Lydsignal» under «Skjermer» i admin, og kan kombineres med andre skjermvalg, f.eks. `/display?station=A&sound=1`. |
| `/audiosignal` | Samme som `/audio` |

## Innstillinger i admin

| Innstilling | Virkning |
| --- | --- |
| Standardlyd | Et rolig todelt klokkeslag som er bygd inn i appen |
| Egen lyd | Opplastet fil. MP3 eller WAV anbefales, fordi de spilles i alle nettlesere. Også M4A, OGG, FLAC og AIFF. Maks 2 MB og 15 sekunder. |
| Av | Ingen lyd. Lydsiden viser «Lyd er slått av i admin». |
| Volum | 0–100 %. Gjelder alle lydsider og storskjermer innen 15 sekunder. |

**AIFF** spilles bare i Safari, og **OGG** ikke i eldre Safari. Kan nettleseren på lydsiden ikke spille filen, brukes standardlyden, og lydsiden viser et varsel.

## Anbefalt oppsett

### PC som også spiller bakgrunnsmusikk (Spotify o.l.)

Lydsiden fortsetter å lytte når den ligger i bakgrunnen, men nettlesere sparer strøm ved å dempe bakgrunnsfaner. Gjør dette for å være trygg:

- [ ] Åpne lydsiden i **eget vindu** (ikke en fane blant mange). La vinduet stå åpent, gjerne bak musikkspilleren.
- [ ] **Chrome/Edge:** Innstillinger → **Ytelse** → under «Minnesparing», legg `kolappsystem.vercel.app` til i «Alltid hold disse nettstedene aktive». Slå gjerne av «Energisparing» mens arrangementet pågår.
- [ ] Slå av dvale og skjermsparer som låser maskinen.
- [ ] Musikk og lydsignal går ut samme lydkort. Juster volumet i admin så signalet høres over musikken.
- [ ] Test: la lydsiden ligge i bakgrunnen i 10 minutter, trykk NESTE på en operatør, og sjekk at signalet høres.

### Egen iPad eller nettbrett

- [ ] Koble til lydanlegget med kabel eller Bluetooth.
- [ ] Åpne `/audio` i Safari, trykk «Start lydsignal» og la siden stå **i forgrunnen**. Skjermen holdes våken av siden.
- [ ] Slå av «Automatisk lås» (Innstillinger → Skjerm og lysstyrke) og ha laderen i.
- [ ] Sett lydbryteren/stille-modus av.

### Storskjermen

- [ ] Bruk `/display?sound=1` og klikk «Klikk for å slå på lyd» etter at siden er åpnet. Det må gjøres igjen hvis siden lastes på nytt.

## Hvis det ikke kommer lyd

| Symptom | Løsning |
| --- | --- |
| Rød melding «Nettleseren har satt lyden på pause» | Trykk på meldingen. Skjer typisk på iPad etter et avbrudd. |
| Storskjermen viser «Klikk for å slå på lyd» igjen | Nettleseren har satt lyden på pause (f.eks. etter dvale). Klikk på knappen. |
| «Sist sjekket» står stille | Nettet er borte, eller fanen er lagt i dvale. Sjekk nettet, og at nettstedet ligger i «Alltid hold aktive» i Chrome. |
| Gult varsel «Mistet kontakten» | Nettet er borte. Siden henter seg inn igjen selv. |
| «Test lyd» gir ingen lyd | Sjekk volum på maskinen, lydanlegget og i admin, og at riktig lydutgang er valgt. |
| Egen lyd spilles ikke, standardlyd spilles | Nettleseren støtter ikke filtypen. Last opp MP3 eller WAV. |
| Lyden kommer 3–4 sekunder etter NESTE | Normalt. Siden sjekker hvert 3. sekund, som storskjermen. |
