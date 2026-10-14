# Kjøreplan for arrangementsdagen

## Dagen før

- [ ] Åpne `/admin` og logg inn.
- [ ] Bytt PIN og del den bare med funksjonærene.
- [ ] Sjekk beskrivelsen for A, B og C.
- [ ] Trykk «Bytt nøkkel» for alle tre stasjoner (gamle test-QR slutter å virke).
- [ ] Skriv ut QR-kodene (én side per stasjon). Gjerne laminert og i A4 eller større.
- [ ] Test én QR-kode med mobil, og nullstill den køen etterpå.
- [ ] Sjekk at PC-en for storskjermen har nett og kan åpne `/display`.

## Rett før dørene åpner

- [ ] «Nullstill kø» for A, B og C.
- [ ] Alle stasjoner står som «Aktiv».
- [ ] Storskjerm: åpne `/display` og trykk fullskjerm-ikonet øverst til høyre.
- [ ] Hver operatør åpner `/operator?station=X` på sin mobil og logger inn.
- [ ] Heng opp QR-kodene.

## Under arrangementet

| Situasjon | Gjør dette |
| --- | --- |
| Gjest kommer ikke når nummeret ropes | Operatør trykker «Hopp over». |
| Gjest som ble hoppet over dukker opp | Operatør trykker «Sett tilbake i kø» på nummeret. Gjesten blir neste. |
| Trykket feil | «Angre siste». Kan trykkes flere ganger. |
| Pause eller stenging av en stasjon | `/admin` → «Deaktiver». Nye skann får beskjed om at stasjonen er stengt. De som står i kø beholder plassen. |
| QR-koden er delt på nett | `/admin` → «Bytt nøkkel» for stasjonen, skriv ut og heng opp ny. |
| Operatør er logget ut | Logg inn med PIN igjen. Køen er uendret. |
| Gjest har lukket siden | Skann samme QR igjen med samme mobil – da kommer samme lapp tilbake. |

## Etter arrangementet

- [ ] «Nullstill kø» for alle stasjoner.
- [ ] Bytt PIN.
- [ ] Ta ned QR-kodene.
