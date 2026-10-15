# Push-varsel – oppsett, test og feilsøking (v1.5)

Gjester kan få varsel på mobilen når de er **nest i køen** og når **det er deres tur**, også med låst skjerm. Push er **av som standard**, og er det av, ser gjestene ingenting om det.

## Slå på og av

`/admin` → kortet **Push-varsler** → bryteren **Av/På**. Gjelder nye og åpne kølapper innen ca. 5 sekunder.
- **På:** kølappen viser «Varsle meg når det er min tur» (Android/PC) eller en veiviser (iPhone i Safari).
- **Av:** knappen og veiviseren forsvinner, og ingenting sendes – heller ikke til dem som har slått på varsel.

## Hva gjesten opplever

| Plattform | Slik virker det |
| --- | --- |
| Android (Chrome, Samsung, Firefox, Edge) | Trykk «Varsle meg» → «Tillat». Får straks et bekreftelsesvarsel «Varsel er på – A12». |
| PC/Mac (Chrome, Edge, Firefox, Safari) | Som Android. |
| iPhone/iPad, iOS 16.4 eller nyere | I Safari vises «Vil du få varsel på iPhone når det er din tur?» med tre steg: Del → «Legg til på Hjem-skjerm» → åpne «Kølapp» fra Hjem-skjermen og trykk «Varsle meg». Samme kølapp åpnes (eget manifest per lapp). |
| iPhone eldre enn 16.4 | Ingen knapp. Ha siden åpen som før. |
| Varsler blokkert i nettleseren | «Varsler er blokkert for denne siden i nettleseren. Ha siden åpen, så ser du når det er din tur.» |

Varslene: **«Varsel er på – A12»** (bekreftelse), **«Du er nest i køen – A12»**, **«Det er din tur! A12 – Gå til stasjon A nå.»** og **«Du ble hoppet over – A12»**. Trykk på varselet åpner kølappen. Varselet kan slås av på kølappen (bjelle-ikonet).

Den åpne kølappen (grønn skjerm, vibrering) virker som før. Push er et tillegg.

## Manuell test før arrangementet (må gjøres på ekte telefoner)

Automatiske tester dekker server, kryptering og service worker i Chromium, men ikke Apples og Googles push-tjenester. Test derfor slik etter at push er slått på i produksjon:

**Android (Chrome)**
- [ ] Skann en test-QR, trykk «Varsle meg» og «Tillat». Bekreftelsesvarsel kommer innen få sekunder.
- [ ] Lås telefonen. Operatør trykker NESTE til du er nest: «Du er nest i køen» kommer.
- [ ] NESTE igjen: «Det er din tur!» kommer med vibrering. Trykk på varselet: kølappen åpnes, grønn.

**iPhone (iOS 16.4+)**
- [ ] Skann en test-QR i Safari. Veiviseren vises. Følg stegene (Del → Legg til på Hjem-skjerm).
- [ ] Åpne «Kølapp» fra Hjem-skjermen. Samme nummer vises. Trykk «Varsle meg» → «Tillat». Bekreftelsesvarsel kommer.
- [ ] Lukk appen og lås telefonen. NESTE til du er nest, deretter din tur: begge varsler kommer.
- [ ] Trykk på varselet: kølappen åpnes.
- [ ] Sjekk at «Fokus»/«Ikke forstyrr» er av på testtelefonen (ellers holdes varsler tilbake).

**Etterpå:** «Nullstill kø» for teststasjonen. Fjern «Kølapp» fra Hjem-skjermen på testtelefonene.

## Feilsøking

| Symptom | Årsak | Løsning |
| --- | --- | --- |
| Ingen «Varsle meg»-knapp | Push er av i admin, nettleseren støtter ikke push, eller iPhone i Safari (viser veiviser i stedet) | Sjekk bryteren i admin. På iPhone: følg veiviseren. |
| «Klarte ikke å slå på varsel» | Nettleseren fikk ikke kontakt med push-tjenesten (nett, privat modus, Firefox-innstilling) | Prøv igjen med vanlig fane og nett. Ha siden åpen. |
| Bekreftelsen kommer, men ikke «din tur» | Push slått av i admin underveis, eller lappen er nullstilt | Sjekk bryteren. Etter «Nullstill kø» må gjesten skanne på nytt. |
| Ingen varsler på iPhone | Ikke åpnet fra Hjem-skjerm, Fokus-modus på, eller varsler slått av for «Kølapp» i Innstillinger → Varslinger | Åpne fra Hjem-skjermen og sjekk Innstillinger. |
| Varsel kommer flere sekunder etter NESTE | Normalt: push-tjenestene leverer vanligvis innen 1–5 s | – |

## Teknisk

- Standard Web Push (VAPID) med service worker `/sw.js`. Nøkler lages automatisk i databasen ved første migrering (`settings.vapid_public/vapid_private`). Kan overstyres med `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` og `VAPID_SUBJECT`.
- Bytter du nøkler, må gjestene slå på varsel på nytt.
- Detaljer: `docs/ARKITEKTUR.md` §5e og `docs/SIKKERHET.md`.
