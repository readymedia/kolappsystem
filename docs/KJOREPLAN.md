# Kjøreplan for arrangementsdagen

## Dagen før

- [ ] Åpne `/admin` og logg inn.
- [ ] Bytt PIN (minst 6 sifre) og del den bare med funksjonærene. Det gule varselet forsvinner når standard-PIN er byttet.
- [ ] Sett opp brannmurregelen for `/api/state` (se `docs/DRIFT.md`).
- [ ] Kjør røyktesten: `BASE_URL=https://kolappsystem.vercel.app npm run smoke` (eller sjekk at `/api/health` viser `"ok":true`).
- [ ] Stasjoner: riktig antall, navn, farger og rekkefølge (`/admin`). Sjekk beskrivelsen for hver stasjon.
- [ ] Utseende (`/admin` → «Utseende»): arrangementsnavn, logo, farge og fonter. Se forhåndsvisningen, og sjekk forsiden og en kølapp på mobil. Gjør dette **før** utskrift av QR (logo og navn kommer med på utskriften).
- [ ] Trykk «Bytt nøkkel» for alle stasjoner (gamle test-QR slutter å virke).
- [ ] Skriv ut QR-kodene (én side per stasjon). Gjerne laminert og i A4 eller større.
- [ ] Test én QR-kode med mobil, og nullstill den køen etterpå.
- [ ] Sjekk at PC-en for storskjermen har nett og kan åpne `/display`.
- [ ] Skjermer: sett overskrift og lag skjermlenker under «Skjermer» i admin (gjerne «Én skjerm per stasjon»). Lag lenkene **etter** «Bytt nøkkel» hvis QR vises på skjermen. Se `docs/ADMIN-GUIDE.md`.
- [ ] Push-varsler (valgfritt): slå på i admin og gjør den manuelle testen i `docs/PUSH.md` på én Android og én iPhone. Virker det ikke, slå det av – kølappen virker som før.
- [ ] Kø og ventetid (valgfritt, v1.8): «Vis køen før gjesten tar lapp», ventetid som tid/klokkeslett, og sluttid/maks i kø per stasjon («Bruk på alle stasjoner»). Sjekk «Plass til ca. N til» på stasjonskortene.
- [ ] Lydsignal: velg lyd og volum i admin, sett opp lydsiden etter `docs/LYD-OPPSETT.md`, og test med lydanlegget.

## Rett før dørene åpner

- [ ] «Nullstill alle køer …» øverst i admin (testlapper havner under «Tidligere runder» i rapporten).
- [ ] Alle stasjoner står som «Aktiv».
- [ ] Storskjerm: åpne `/display` og trykk fullskjerm-ikonet øverst til høyre.
- [ ] Hver operatør åpner `/operator?station=X` på sin mobil og logger inn.
- [ ] Lydsiden: åpne `/audio`, trykk «Start lydsignal» og «Test lyd».
- [ ] Heng opp QR-kodene.

## Under arrangementet

Ikke push kode til `main` mens arrangementet pågår (hver push deployer produksjon).

| Situasjon | Gjør dette |
| --- | --- |
| Gjest kommer ikke når nummeret ropes | Operatør trykker «Hopp over». |
| Gjest som ble hoppet over dukker opp | Operatør trykker «Sett tilbake i kø» på nummeret. Gjesten blir neste. |
| Trykket feil | «Angre siste». Kan trykkes flere ganger. |
| Pause eller stenging av en stasjon | `/admin` → «Deaktiver», skriv gjerne en melding («Tilbake kl. 14.00») og trykk «Steng stasjonen». Storskjermen viser «STENGT» med meldingen, nye skann får beskjed, og de som står i kø beholder plassen. |
| QR-koden er delt på nett | `/admin` → «Bytt nøkkel» for stasjonen, skriv ut og heng opp ny. Fjern falske lapper med «Fjern ventende lapper …». |
| Mange falske lapper / mistenkelig trafikk | Se «Ved mistanke om misbruk» i `docs/DRIFT.md`. |
| Køen er for lang til å rekke alle | `/admin` → «Navn, farge, sluttid og rekkefølge …» → sett «Siste betjening kl.» eller «Maks i kø». Nye får «Køen er full», de som står beholder plassen. |
| Operatør er logget ut | Logg inn med PIN igjen. Køen er uendret. |
| Gjest har lukket siden | Skann samme QR igjen med samme mobil – da kommer samme lapp tilbake. |

## Etter arrangementet

- [ ] «Rapport» → «Last ned CSV» (tall per stasjon til evalueringen).
- [ ] «Nullstill alle køer …».
- [ ] Bytt PIN.
- [ ] Ta ned QR-kodene.
