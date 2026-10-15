# Admin-guide

For den som setter opp og styrer arrangementet i `/admin`. Funksjonærene trenger bare `docs/OPERATOR-GUIDE.md`.
Logg inn med PIN-koden. Alle innstillinger gjelder alle skjermer og telefoner innen ca. 20 sekunder.

## Stasjoner og QR-koder

Øverst står ett kort per stasjon (standard A, B og C), i stasjonens farge og i den rekkefølgen storskjermen bruker.

| Knapp | Virkning |
| --- | --- |
| Skriv ut | Én side per stasjon med stor QR-kode. Heng opp ved inngangen. |
| Kopier lenke | Lenken bak QR-koden. Inneholder hemmelig nøkkel – del den ikke på nett. |
| Blyant ved beskrivelsen | Hvem gjestene møter. Vises på kølappen og (valgfritt) storskjermen. |
| Nullstill kø | Sletter køen og starter på nummer 1. Lapper som er delt ut slutter å virke. |
| Deaktiver / Aktiver | Stenger eller åpner stasjonen. Se under. |
| Bytt nøkkel | Gamle QR-koder (og skjermlenker med QR) slutter å virke. Skriv ut nye. |
| Fjern ventende lapper … | Fjerner ventende lapper i et nummerområde, f.eks. falske lapper fra en QR-kode delt på nett. |
| Nullstill alle køer … (øverst, v1.8) | Tømmer alle køer på én gang og starter alle på nummer 1. Bekreftelsen viser hvor mange som mister lappen. Sammendrag lagres i «Rapport» først. |

### Flere stasjoner, navn og farger (v1.6)

- **Ny stasjon:** trykk den stiplede ruten **Ny stasjon** sist i rutenettet. Den får neste ledige bokstav (D, E …) og en ledig farge. Maks 12 aktive stasjoner.
- **Navn og farge:** **Navn, farge, sluttid og rekkefølge …** på kortet. Navnet (f.eks. «Hovedscenen») vises på storskjerm, kølapp og hos operatøren. Tomt navn gir «Stasjon D». Velg en av 12 farger eller **Egen farge**. Trykk **Lagre**.
- **Rekkefølge:** pilene flytter stasjonen til venstre/høyre. Storskjermen og operatørens velger følger samme rekkefølge.
- **Koden endres aldri.** Bokstaven står på QR-koden og lappene (D1, D2 …). Den gjenbrukes heller ikke etter arkivering.
- **Arkivere:** **Arkiver stasjon …** (bare når ingen står i kø – nullstill først). Stasjonen forsvinner overalt, og QR-koden slutter å virke.
- **Gjenopprette:** **Arkiverte stasjoner** nederst → **Gjenopprett**. Stasjonen får tom kø og **ny QR-kode** – skriv ut på nytt.
- **Skjermer:** nye stasjoner kommer automatisk med på `/display`. Skjermlenker med QR for «alle stasjoner» må lages på nytt etter at en stasjon er lagt til eller fjernet.
- **Lyd:** `/audio` spiller for alle stasjoner; `/audio?station=D` bare for D.

### Sluttid og kapasitet (v1.8)

Under **Navn, farge, sluttid og rekkefølge …** → «Sluttid og kapasitet». Begge er tomme som standard (ingen grense, som før).

- **Siste betjening kl.** (f.eks. 16:00): nye gjester får «Køen er full» når de ikke rekker fram før sluttiden (antall ventende × minutter per person fra «Kø og ventetid»). Etter sluttiden tas ingen nye lapper. Klokkeslettet gjelder dagens dato i norsk tid – et arrangement som går over midnatt støttes ikke.
- **Maks i kø:** nye gjester får «Køen er full» når så mange venter.
- **Bruk på alle stasjoner:** kryss av før du lagrer for å sette samme verdier på alle aktive stasjoner.
- De som allerede står i kø beholder plassen. Ligger deres beregnede tur etter sluttiden, viser kølappen «Det kan bli for sent – siste betjening er kl. 16:00. Snakk med en funksjonær.»
- Stasjonskortet og operatøren viser «Plass til ca. 18 til før kl. 16:00» eller «Full – siste betjening kl. 16:00». Det er tallet for hvor mange dere må legge opp til.
- Stengt vinner over full: en stengt stasjon viser stengt-meldingen.

### Stenge en stasjon (pause)

1. Trykk **Deaktiver**.
2. Skriv gjerne en melding til publikum, maks 80 tegn, f.eks. «Tilbake kl. 14.00».
3. Trykk **Steng stasjonen**.

Da skjer dette:
- Storskjermen viser kolonnen i grått med stort **STENGT** og meldingen.
- Nye skann får «Stasjon A er stengt» med meldingen.
- De som står i kø beholder plassen, og ser «Stasjonen er midlertidig stengt» med meldingen på kølappen.
- Operatøren ser «Stasjonen er satt til stengt – «melding»».

Meldingen kan endres mens stasjonen er stengt («Melding mens stengt» → **Lagre melding**). Trykk **Aktiver** for å åpne igjen.

## Skjermer

Kortet **Skjermer** lager lenker til storskjermer. Vanlig `/display` (uten valg) ser ut som før.

### Overskrift

«Overskrift på storskjerm» er teksten øverst (standard «Meet & Greet · Køstatus»). Skriv arrangementets navn, eller tøm feltet for å fjerne overskriften. Trykk **Lagre overskrift**.

### Lag en skjermlenke

1. Velg stasjoner. Én stasjon gir en skjerm der nummeret fyller hele skjermen.
2. Velg størrelse på nummeret, antall i «Neste» og hva som skal vises (stasjonsnavn, beskrivelse, overskrift, klokke, lydsignal, QR-kode, køinfo). **Køinfo** (v1.8) viser «12 i kø · ca. 25 min» under hver åpen stasjon (format etter «Vis ventetiden som»), eller «Køen er full».
3. Velg mørk eller lys bakgrunn.
4. Sjekk forhåndsvisningen (viser ekte køtall).
5. Trykk **Kopier lenke** og åpne lenken på PC-en til skjermen, eller **Åpne i nytt vindu**. Trykk fullskjerm-ikonet øverst til høyre.

### Stativ med én skjerm per stasjon

Velg utseende som over, åpne **Én skjerm per stasjon** og kopier lenken for hver stasjon til hver sin PC eller nettleservindu.

### QR-kode på storskjermen

Kryss av **QR-kode for kølapp**. Lenken får da et signert tillegg (`&t=…`), og skjermen viser QR-koden under hver åpen stasjon.

> ⚠️ QR-koden på storskjermen kan fotograferes og deles. Alle som har bildet kan ta kølapp uten å være på stedet, og også skjermlenken gir tilgang til QR-koden. Vern som er aktivt: maks 100 ventende per nettverk, «Bytt nøkkel» (gjør både QR og skjermlenke ugyldig) og «Fjern ventende lapper». Vurdert som akseptabelt nå. Slå av hvis misbruk oppstår.

- **Bytt nøkkel** gjør skjermlenken ugyldig. Skjermen viser da «QR-lenken er utdatert – lag en ny under «Skjermer» i admin.» Kopier ny lenke (den lages automatisk) og åpne den på skjermen.
- Lag derfor skjermlenkene **etter** at du har byttet nøkler før arrangementet.

### Utseende og logo

Knappen **Utseende** øverst i admin åpner `/admin/utseende`. Bytt utseende før hvert arrangement.

1. **Arrangementsnavn**: vises på forsiden, i fanetittelen og på utskriften. La krysset «Bruk også som overskrift på storskjermen» stå, så sier storskjermen «<navn> · Køstatus».
2. **Logo**: «Last opp logo …». PNG, JPEG, WebP eller SVG, maks 512 kB. Liggende format med gjennomsiktig bakgrunn ser best ut. Logoen vises på forsiden, kølappen, skann, storskjermen og utskriften av QR-kodene.
3. **Hovedfarge**: fargen på knappene. Tekstfargen velges automatisk. Får du varselet «Lav kontrast», velg en mørkere eller lysere farge.
4. **Storskjermbakgrunn**: mørk eller lys. Gjelder alle storskjermer som ikke har eget valg i lenken.
5. **Fonter**: én for overskrifter og nummer, én for brødtekst. «Atkinson Hyperlegible» er laget for å være lettlest.
6. Sjekk forhåndsvisningen og trykk **Lagre**. Alle sider bruker det nye utseendet med en gang; storskjermer innen 20 sekunder.

**Tilbakestill til standard** gir dagens utseende tilbake og fjerner logoen.

SVG-filer med skript, lenker til andre filer o.l. avvises. Få feilmeldingen? Lagre logoen på nytt som «enkel SVG», eller bruk PNG.

## Lydsignal på storskjermen

Kryss av **Lydsignal**. Etter at lenken er åpnet må noen klikke «Klikk for å slå på lyd» én gang. Se `docs/LYD-OPPSETT.md`.

## Lydsignal

Kortet **Lydsignal**: velg standardlyd, egen lyd (last opp MP3/WAV, maks 2 MB og 15 sekunder) eller av, og still volumet. Lyden spilles på lydsiden `/audio` og på storskjermer med lydsignal. Fullt oppsett: `docs/LYD-OPPSETT.md`.

## Kø og ventetid (v1.7)

Kortet **Kø og ventetid**:
- **Gjester kan gi fra seg plassen** (standard **På**). Kølappen viser da «Gi fra meg plassen». Gjesten må bekrefte og kan angre i 60 sekunder. Den som er kalt kan også si fra – operatøren ser «A12 ga fra seg plassen. Trykk NESTE for å kalle neste.» Antallet vises hos operatøren og på stasjonskortene («· 4 ga fra seg plassen»), så dere ser hvor mange som faktisk venter.
- **Ventetid på kølappen:** antall foran × minutter per person.
  - **Fast** (standard 2 minutter, som før): skriv inn et annet tall (hele eller halve minutter) og trykk **Lagre**.
  - **Faktisk tempo ved hver stasjon:** regnes ut fra tiden mellom de siste oppropene ved hver stasjon. Til det er minst 4 opprop (og etter en pause over 30 minutter) brukes det faste tallet. Linjen «Nå: …» viser tempoet akkurat nå.
- **Vis køen før gjesten tar lapp** (v1.8, standard **Av**): etter skann ser gjesten stasjonen, «12 personer foran deg» og ventetiden, og trykker **Ta kølapp** eller **Ikke nå**. Av = lappen lages med en gang (som før). Har mobilen allerede en lapp, går den rett til lappen.
- **Vis ventetiden som** (v1.8): **Tid** («Ca. 25 minutter», standard), **Klokkeslett** («Din tur ca. kl. 14:35») eller **Begge** («Ca. 25 minutter – ca. kl. 14:35»). Klokkeslettet rundes opp til nærmeste 5 minutter og vises ikke når ventetiden er under 5 minutter. Gjelder kølappen, «se køen før lapp», storskjermens køinfo og «Gi fra meg plassen».

## Rapport (v1.8)

Kortet **Rapport** viser per stasjon siden siste nullstilling: delt ut, betjent, hoppet over, ga fra seg plassen, venter nå, snitt og lengste ventetid (fra lapp til kalt), tempo (minutter per person) og travleste time.

- Hver gang en kø nullstilles (også «Nullstill alle køer»), lagres et sammendrag under **Tidligere runder** med tidspunkt. Bare tall – ingen persondata.
- **Last ned CSV** gir en fil (`kolapp-rapport-ÅÅÅÅ-MM-DD.csv`) med «Nå» og tidligere runder, som åpnes riktig i norsk Excel.
- Tips: last ned CSV før «Nullstill alle køer» etter arrangementet – eller etterpå, sammendraget ligger under «Tidligere runder».

## Push-varsler

Kortet **Push-varsler** har én bryter (standard **Av**). Er den på, kan gjestene trykke «Varsle meg» på kølappen og få varsel når de er nest og når det er deres tur – også med låst skjerm. På iPhone må gjesten først legge kølappen til på Hjem-skjermen; kølappen viser en veiviser.

Slå det på bare etter at dere har testet på en Android og en iPhone (sjekkliste i `docs/PUSH.md`). Er det av, ser gjestene ingenting om varsler.

## PIN-kode

Felles for operatører og admin. Ny PIN må ha 6–12 sifre, og alle andre enheter logges ut. Glemt PIN: se `docs/SIKKERHET.md`.
