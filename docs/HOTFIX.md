# Hotfix-liste (oppsamling)

Små feil og skjønnhetsfeil som er funnet, men ikke rettet med en gang. De samles og rettes i én runde
(en patch-versjon, f.eks. 1.8.1). Nye funksjoner hører ikke hjemme her – de står i `FEATURE-REQUESTS.md`.

**Slik brukes lista**
- Ny sak: legg til nederst under «Åpne» med neste nummer (HF-N), dato, hvor, hva som skjer og hvordan det gjenskapes.
- Alvorlighet: **Lav** = kosmetisk / sjelden, **Middels** = forvirrer brukere, men har en omvei, **Høy** = rettes med en gang (havner ikke her).
- Når en sak er rettet: flytt den til «Rettet» med versjon, og nevn den i `CHANGELOG.md`.
- Ikke rett noe her under et arrangement (kodefrys, se `KJOREPLAN.md`).

## Åpne

| Nr. | Funnet | Hvor | Hva | Alvorlighet |
| --- | --- | --- | --- | --- |
| HF-1 | 2026-10-16 (test i prod, v1.8.0) | Storskjerm `/display`, toppfelt | I et smalt nettleservindu (ca. 500 px bredt) legger logoen seg over starten av overskriften («NOKIOS …» vises som «OKIOS …»). Ser riktig ut på vanlig skjermstørrelse og i fullskjerm. Gjenskapes: last opp logo, sett overskrift, gjør vinduet smalt. Retting: logo og overskrift i samme flex-rad med avstand, eller overskriften trekkes inn så den aldri går under logoen. | Lav |
| HF-2 | 2026-10-16 (test i prod, v1.8.0) | Storskjerm `/display`, stengt stasjon | Med 4 stasjoner på én rad (ca. 2000 px bredt vindu) går den innrammede «STENGT»-boksen litt ut over kortets høyre kant. Gjenskapes: 4 stasjoner, steng 1–3 av dem. Retting: skaler skrift/sporing i boksen med kolonnebredden (`cqw`) og begrens bredden til kortet (`max-w-full`). | Lav |

## Til verifisering

| Nr. | Funnet | Hva | Status |
| --- | --- | --- | --- |
| V-1 | 2026-10-16 | Knappen «Angre – ta plassen tilbake (N s)» var ikke med på skjermbildet av «Du har gitt fra deg plassen» (iPhone, kalt gjest). Trolig tatt etter at de 60 sekundene var ute (da forsvinner knappen med vilje). E2E-testen er grønn. | Test på nytt og ta skjermbilde med en gang. Mangler knappen, flyttes saken til «Åpne». |

## Rettet

_Ingen ennå._
