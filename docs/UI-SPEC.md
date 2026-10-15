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

## Utseende per arrangement (v1.4)

Alle sider følger innstillingene fra `/admin/utseende`. Uten innstillinger: dagens utseende (navn «Meet & Greet», ingen logo, hovedfarge `#0f172a`, Space Grotesk/Inter, mørk storskjerm).
- **Logo** (når lastet opp, alltid som `<img>`): forsiden over arrangementsnavnet, kølappen øverst, `/join` og «Fant ikke kølappen» over kortet, storskjermen til venstre i topplinjen, utskrift av QR øverst.
- **Arrangementsnavn**: overtekst på forsiden, fanetittel («Storskjerm – <navn>», «Kølapp – <navn>»), utskrift. Tomt navn skjules.
- **Hovedfarge**: alle primærknapper. Tekstfarge hvit eller mørk etter kontrast.
- **Fonter**: overskrifter/nummer og brødtekst overalt.

## `/` Forside

Logo (om satt), overtekst med arrangementsnavnet (standard «MEET & GREET»), tittel «Kølappsystem», ingress «Tre stasjoner, én digital kø. Publikum skanner QR-koden ved inngangen og følger med på sin egen kølapp.» (antallet følger stasjonene: «Én stasjon …», «Sju stasjoner …»). Ett kort per stasjon i stasjonens farge («STASJON A» eller navnet, beskrivelse, «ÅPEN»/«STENGT»). Knapper: «Storskjerm», «Operator», «Admin».

## `/join`

| Tilstand | Tittel | Tekst |
| --- | --- | --- |
| Henter | Henter kølappen din … | Du får et nummer og kan følge køen videre. (Nøytral bakgrunn fra v1.6, siden fargen ikke er kjent før lappen er hentet.) |
| Ukjent eller arkivert stasjon | Ugyldig lenke | Denne lenken peker ikke på en gyldig stasjon. |
| Feil nøkkel | Ugyldig lenke | Lenken er ikke gyldig. Spør en funksjonær om hjelp. |
| Se køen før lapp (v1.8, når admin har slått det på og mobilen ikke har lapp) | Kort i stasjonsfarge: «KØ · STASJON A» (eller navnet), beskrivelse, felt med «Ingen i kø – du blir neste» / «N personer foran deg» og ventetid (etter «Vis ventetiden som»), knapp «Ta kølapp» («Henter kølapp …»), lenke «Ikke nå». | Stengt, full eller ukjent stasjon: rett til vanlig melding. |
| Ikke nå (v1.8) | Greit! | Du har ikke tatt kølapp. Skann QR-koden igjen når du vil stille deg i kø. |
| Full (v1.8) | Køen er full | Stasjon A tar ikke imot flere i kø i dag (siste betjening kl. 16:00). Snakk med en funksjonær. (Uten sluttid: uten parentes.) |
| Stengt | Stasjon X er stengt (fra v1.8 med stasjonens navn) | Eventuell melding fra admin («Tilbake kl. 14.00») på egen linje, deretter: Det deles ikke ut kølapper her akkurat nå. Ta kontakt med en funksjonær, så hjelper vi deg videre. |
| For mange | Ugyldig lenke | Det kom mange forespørsler på kort tid. Vent litt og prøv igjen. |
| Flom fra nettverk | Ugyldig lenke | Det står allerede svært mange i kø fra dette nettverket. Ta kontakt med en funksjonær. |
| Travelt | Ugyldig lenke | Systemet er travelt akkurat nå. Prøv igjen om et øyeblikk. |
| Annen feil | Ugyldig lenke | Noe gikk galt. Prøv å skanne koden på nytt. |

## `/ticket/:id`

| Status | Visning |
| --- | --- |
| Venter | Bakgrunn i stasjonsfarge. «KØLAPP · STASJON A» (eller stasjonens navn), kort «Din plass i køen» + «A12» (6,5rem) + merke «Venter». Kort med antall foran og ventetid. Knapp «Trykk her for å få vibrering når det er din tur» (bare Android). Kort «DU SKAL MØTE». Bunntekst «Siden oppdaterer seg selv. Ha den åpen – vi gir beskjed her når det er din tur.» |
| Kalt | Grønn (`emerald-500`), pulserende «A12», «Det er din tur!», «Gå til stasjon A» (med navn: «Gå til Hovedscenen (stasjon D)»), beskrivelse. Vibrerer 300-150-300-150-500 ms. Fanetittel «Din tur! A12». |
| Hoppet over | Gul (`amber-400`), timeglass, «Du ble hoppet over», «Vi ropte opp nummeret ditt, men så deg ikke. Snakk med en funksjonær, så setter vi deg inn igjen i køen.», nummer. |
| Ferdig | Mørk (`slate-900`), grønn hake, «Ferdig – takk for besøket!», «Kølappen er avsluttet. Velkommen tilbake senere.» |
| Gitt fra seg plassen (v1.7) | Lys grå, dør-ikon, «Du har gitt fra deg plassen», «Takk! Da kommer de bak deg raskere fram. Vil du likevel stille deg i kø, skanner du QR-koden igjen.», overstreket nummer. I 60 s: «Angre – ta plassen tilbake (N s)» (feil: «Plassen kan ikke tas tilbake lenger. Skann QR-koden igjen for å få en ny kølapp.»). |
| Ikke funnet | «Fant ikke kølappen», «Lenken kan være utdatert. Skann QR-koden på nytt for å få en ny lapp.» |

**Push-varsel (v1.5, bare når admin har slått det på; ellers vises ingenting):** under køinfo.
- Android/PC: stor knapp «Varsle meg når det er min tur» (hovedfarge), under: «Da kan du låse skjermen. Du får beskjed når du er nest og når det er din tur.» Mens den jobber: «Slår på …». Feil: «Klarte ikke å slå på varsel. Ha siden åpen, så ser du når det er din tur.»
- På: grønt felt «**Varsel er på.** Du får beskjed når du er nest og når det er din tur – også med låst skjerm.» med bjelle-knapp «Slå av varsel».
- Blokkert: grått felt «Varsler er blokkert for denne siden i nettleseren. Ha siden åpen, så ser du når det er din tur.»
- iPhone/iPad i Safari (iOS 16.4+): sammenleggbart kort «Vil du få varsel på iPhone når det er din tur?» («Vis»/«Skjul») med stegene «Trykk på Del nederst (eller øverst) i Safari.», «Velg Legg til på Hjem-skjerm, og trykk Legg til.», «Åpne Kølapp fra Hjem-skjermen og trykk Varsle meg. Du beholder samme plass i køen.» og «Vil du ikke det, holder det å ha denne siden åpen.»
- Varslene: «Varsel er på – A12» / «Vi sier ifra når du er nest i køen og når det er din tur.», «Du er nest i køen – A12» / «Gjør deg klar ved stasjon A.», «Det er din tur! A12» / «Gå til stasjon A nå.» (blir stående), «Du ble hoppet over – A12» / «Snakk med en funksjonær, så setter vi deg inn igjen i køen.»

**Gi fra meg plassen (v1.7, når admin tillater det – standard på):**
- Venter: diskret lenke med dør-ikon nederst, «Gi fra meg plassen». Kalt (grønn): «Jeg kommer ikke – gi fra meg plassen» (hvit). Hoppet over (gul): «Jeg kommer ikke tilbake – gi fra meg plassen».
- Bekreftelse: «Vil du gi fra deg plassen A12?», for ventende også «7 personer foran deg – ca. 14 minutter ventetid.», for kalt «Funksjonæren får beskjed og kaller neste.», alltid «Vil du komme tilbake senere, skanner du QR-koden igjen og får en ny kølapp.» Knapper: rød «Ja, gi fra meg plassen» («Gir fra meg plassen …») og «Behold plassen».

Antall foran: 0 → «Du er nest i køen», 1 → «1 person foran deg», ellers «X personer foran deg».
Ventetid: 0 → «Under 2 minutter», ellers «Ca. X×2 minutter» (standard). Fra v1.7 med minutter per person fra admin (fast, eller faktisk tempo): «Under 4 minutter», «Ca. 15 minutter», «Ca. 1 minutt», «Ca. 1 t 15 min».
Ventetid som klokkeslett (v1.8, valg i admin): «Din tur ca. kl. 14:35» eller «Ca. 25 minutter – ca. kl. 14:35», rundet opp til 5 minutter, norsk tid; under 5 minutter alltid som tid.
Sen sluttid (v1.8): gult felt under køinfo «Det kan bli for sent – siste betjening er kl. 16:00. Snakk med en funksjonær.» når beregnet tur er etter sluttiden.
Skjermen holdes våken (Wake Lock) mens lappen venter eller er kalt.
Stengt stasjon mens gjesten venter: grått felt over køinfo «Stasjonen er midlertidig stengt», «Du beholder plassen din i køen.» og eventuell melding fra admin.
Etter 3 mislykkede oppdateringer på rad vises et gult felt: «Mistet kontakten – prøver igjen. Sjekk at du har nett.»

## `/operator?station=X`

- PIN-skjerm: lås-ikon, «Operator», «Skriv inn PIN-koden for å fortsette», felt «PIN», knapp «Lås opp», feil «Feil PIN-kode. Prøv igjen.» / «For mange feil forsøk. Vent 15 minutter og prøv igjen.»
- Topp: stasjonsvelger med alle aktive stasjoner (bokstav i stasjonsfarge, navn som verktøytips; rullbar ved mange, valgt stasjon rulles fram) og «Logg ut». Ukjent eller arkivert stasjon i adressen: første aktive. Ingen stasjoner: «Ingen stasjoner» / «Opprett en stasjon i admin først.»
- Under «N venter»: «Oppdatert hh:mm:ss» og knapp «Oppdater». Etter to mislykkede oppdateringer: gult felt «Mistet kontakten – prøver igjen. Tallene kan være utdaterte.»
- «OPERATOR», «Stasjon A» (eller navnet), merke «N venter». Under: «N har gitt fra seg plassen» (når minst én), og ved sluttid/maks (v1.8): «Plass til ca. N til før kl. 16:00» / «Full – siste betjening kl. 16:00» / «Full – maks antall i kø er nådd».
- Kort «BETJENES NÅ» med nummer eller «–», gult felt når den kalte ga fra seg plassen: «A12 ga fra seg plassen. Trykk NESTE for å kalle neste.» (eller «Ingen venter.»), undertekst «Åpen for kø» eller «Stasjonen er satt til stengt» (rød), med eventuell melding: «Stasjonen er satt til stengt – «Tilbake kl. 14.00»».
- Kort «NESTE I KØEN» med 5 neste («Neste», «2. i kø» …) eller «Ingen venter akkurat nå.»
- Kort «HOPPET OVER» (bare når det finnes) med «Sett tilbake i kø» per lapp.
- Fast bunnpanel: «NESTE» (96 px, stasjonsfarge), «Hopp over» (av når ingen betjenes), «Angre siste» (av når det ikke er noe å angre).

## `/display`

**Standard (uten valg i adressen):** Svart bakgrunn. Overskriften fra admin (standard «MEET & GREET · KØSTATUS»; tom = ingen overskrift) og en diskret fullskjerm-knapp. Tre kolonner: «Stasjon A», «ÅPEN»/«STENGT», «NÅ BETJENES», gigantisk «A12» i stasjonsfarge (eller svak «–»), «Neste: A13, A14, A15». Blinker ved nytt nummer. Viser «Mistet kontakten med serveren – prøver igjen …» ved nettfeil.

**Mange stasjoner (v1.6):** 1 stasjon fyller skjermen, 2–3 som før, 4 stasjoner på én rad, 5–8 i fire kolonner, 9–12 i seks kolonner, med mindre nummer så alt får plass på én skjerm. Kolonnene står i admin-rekkefølge, med stasjonens navn (eller «Stasjon A») og farge. En lenke med bare ukjente/arkiverte stasjoner viser alle.

**Stengt stasjon:** Kolonnen får gråtone og skråstriper. Nummer og «Neste» byttes med et stort innrammet «STENGT» og eventuell melding fra admin under («Tilbake kl. 14.00»).

**Skjermvalg** (lages med lenkebyggeren i admin, tolkes av `parseDisplayOptions()`; ugyldige verdier gir standard):

| Parameter | Verdier | Standard | Virkning |
| --- | --- | --- | --- |
| `station` | `A` eller `A,C` | alle | Hvilke stasjoner. Én stasjon fyller hele skjermen, sentrert. |
| `size` | `s`, `m`, `l`, `xl` | `m` | Størrelse på «Nå betjenes»-nummeret |
| `title` | `0`/`1` | `1` | «Stasjon A» |
| `desc` | `0`/`1` | `0` | Beskrivelsen under stasjonsnavnet |
| `next` | `0`–`5` | `3` | Antall i «Neste» (0 skjuler linjen) |
| `header` | `0`/`1` | `1` | Overskriften |
| `clock` | `0`/`1` | `0` | Klokke «14:05» øverst til høyre |
| `theme` | `dark`/`light` | `dark` | Svart eller hvit bakgrunn |
| `sound` | `0`/`1` | `0` | Grønn knapp nederst «Klikk for å slå på lyd», deretter lydsignal ved nytt nummer. Setter nettleseren lyden på pause, kommer knappen tilbake. |
| `info` | `0`/`1` | `0` | Køinfo (v1.8) under «Neste»: «12 i kø · ca. 25 min» (eller «· ca. kl. 14:35» / «· ca. 25 min (kl. 14:35)»), «Ingen kø», «Køen er full». Skjult for stengte stasjoner. |
| `qr` + `t` | `1` + signert token | av | Hvit boks med QR og «Skann for kølapp» under hver åpen stasjon (ved én stasjon: nede til høyre). Ugyldig/utdatert token: diskret tekst nederst «QR-lenken er utdatert – lag en ny under «Skjermer» i admin.» |

Uten overskrift og klokke ligger fullskjermknappen fast øverst til høyre.

## `/audio` (lydside)

Mørk bakgrunn. «LYDSIGNAL», overskrift «Alle stasjoner» eller «Stasjon A, C», runde merker per stasjon i stasjonsfarge.
- Før start: stor grønn knapp med bjelle «Start lydsignal».
- Etter start: grønt kort «Lyd aktiv ✓», «La siden stå åpen. Den spiller når et nytt nummer kalles.»
- Kort «Sist sjekket hh:mm:ss» og «Lyd: Standard/Egen lyd/Av · 80 %», knapp «Test lyd».
- «SISTE OPPROP»: de siste 8 opprop med klokkeslett, eller «Ingen ennå.»
- Varsler: «Lyd er slått av i admin.», rød «Nettleseren har satt lyden på pause. Trykk her for å slå den på igjen.», gul «Mistet kontakten – prøver igjen. Sjekk nettet.», «Denne nettleseren kan ikke spille den opplastede lyden. Standardlyden brukes i stedet. Last opp MP3 eller WAV i admin.»
- Bunntekst med tips om `?station=A`.

## `/admin`

- Samme PIN-skjerm med tittel «Admin».
- Gult varsel øverst så lenge standard-PIN brukes: «Du bruker fortsatt standard-PIN 1234. Bytt den nederst på siden før arrangementet (minst 6 sifre).»
- «ADMIN», «Stasjoner og QR-koder», forklaring, knappene «Logg ut», «Utseende» (til `/admin/utseende`) og «Skriv ut».
- Øverst over rutenettet (v1.8): «Nullstill alle køer …» → rødt felt «N venter totalt – de mister lappene sine. Alle køer starter på 1 igjen.» (ingen: «Ingen venter. …»), «Bekreft – tøm alle køer» («Nullstiller …»), «Avbryt».
- Kort per stasjon (i stasjonens farge og rekkefølge): fargeprikk, navn (eller «Stasjon A»; med navn vises koden som lite merke), «Aktiv»/«Stengt», QR-kode, lenke, «Kopier lenke», «N venter · M lapper delt ut» (+ «· K ga fra seg plassen»), ved sluttid/maks linjen «Plass til ca. N til før kl. 16:00» / «Full – …» (v1.8), beskrivelse med redigering, «Nullstill kø» (bekreft: «Bekreft nullstilling»), «Deaktiver» (åpner felt «Melding til publikum (valgfri, maks 80 tegn)» med plassholder «F.eks. «Tilbake kl. 14.00»», hjelpetekst «Vises på storskjermen, ved skann og på kølappene. De som står i kø beholder plassen.», knappene «Steng stasjonen» og «Avbryt») / «Aktiver». Mens stengt: felt «Melding mens stengt» med «Lagre melding» («Lagret»). «Bytt nøkkel» (bekreft: «Bekreft – gamle QR slutter å virke»), lenker «Operator» og «Storskjerm».
- «Navn, farge, sluttid og rekkefølge …» per stasjon (fra v1.8: «Sluttid og kapasitet» med «Siste betjening kl.» (klokkeslett), «Maks i kø» (plassholder «Ingen»), «Bruk på alle stasjoner», hjelpetekst «Tomt = ingen grense. …», knapp «Lagre sluttid og kapasitet» / «Lagre for alle stasjoner» / «Lagret»): felt «Navn» (maks 40, plassholder «Stasjon A», hjelpetekst «Tomt = «Stasjon A». Koden A står på lappene (A1, A2 …) og endres aldri.»), «Farge» med 12 runde fargeknapper (Blå, Lilla, Grønn, Gul, Rød, Turkis, Indigo, Oransje, Rosa, Lime, Cyan, Grå) og «Egen farge», «Lagre» («Lagret»), «Lukk», «Rekkefølge» med pilknapper «Flytt til venstre»/«Flytt til høyre», og «Arkiver stasjon …» (bekreft: «Bekreft – arkiver stasjon A»; «Skjules overalt, og QR-koden slutter å virke. Kan hentes tilbake under «Arkiverte stasjoner».»). Med kø: «Arkivering krever tom kø (N venter). Nullstill køen først.»
- Siste rute i rutenettet: stiplet «Ny stasjon» med «N av 12 i bruk» (ved 12: deaktivert, «Maks 12 stasjoner. Arkiver en for å lage ny.»).
- «Arkiverte stasjoner (N)» (utvidbar, bare når det finnes): fargeprikk, navn, «Gjenopprett». «Gjenopprettet stasjon får tom kø og ny QR-kode (skriv ut på nytt).»
- «Fjern ventende lapper …» per stasjon: felt «Fra A…» og «til A…», knapp «Fjern», svar «Fjernet N ventende lapper.»
- Kort «Skjermer»: «Lag lenker til storskjermer …». Felt «Overskrift på storskjerm» (plassholder «Tom = ingen overskrift») med «Lagre overskrift» → «Lagret. Storskjermene oppdateres innen 20 sekunder.» og «Bruk arrangementsnavnet» (når navnet er satt og overskriften er en annen). Valg: «Stasjoner» (én avkrysning per aktiv stasjon), «Størrelse på nummeret» (Liten/Normal/Stor/Ekstra stor), «Antall i «Neste»» (Skjul, 1–5), «Vis» (Stasjonsnavn, Beskrivelse, Overskrift, Klokke, Lydsignal, Køinfo (antall og ventetid), QR-kode for kølapp), «Bakgrunn» Mørk/Lys, «Tilbakestill valg». Forhåndsvisning 16:9 med ekte køtall («Forhåndsvisning med ekte køtall (QR-koden er et eksempel).»). Med QR: gult risikovarsel «QR-koden på storskjermen kan fotograferes og deles. Alle som har bildet kan ta kølapp uten å være på stedet, og også skjermlenken gir tilgang til QR-koden. Vern som er aktivt: maks 100 ventende per nettverk, «Bytt nøkkel» (gjør både QR og skjermlenke ugyldig) og «Fjern ventende lapper». Vurdert som akseptabelt nå. Slå av hvis misbruk oppstår.» «SKJERMLENKE» med lenken («Lager signert lenke …» mens token hentes; ved feil «Kunne ikke lage signert lenke.» og «Prøv igjen»; åpne-knappene er deaktivert så lenge), «Kopier lenke» («Kopiert»), «Åpne i nytt vindu». Utvidbar «Én skjerm per stasjon» med én lenke per stasjon, «Kopier» og åpne-ikon.
- Kort «Lydsignal»: valg «Standardlyd» / «Egen lyd» (bare når fil finnes) / «Av», glidebryter «Volum: 80 %», «Spill av», «Last opp lyd …»/«Bytt lyd …», filinfo («WAV · 12 kB») med «Fjern», hjelpetekst om formater, gult varsel for AIFF/OGG, «Åpne lydsiden» og tips om `/audio?station=A` og `/display?sound=1`.
- Kort «Kø og ventetid» (v1.7): bryter «Gjester kan gi fra seg plassen» (standard På) med forklaring. Bryter «Vis køen før gjesten tar lapp» (v1.8, standard Av). «Ventetid på kølappen»: «Antall foran × minutter per person.», valg «Fast: [2] minutter per person» med «Lagre» (feil: «0,5–60, i hele eller halve minutter.») eller «Faktisk tempo ved hver stasjon» («Midtverdien av tiden mellom de siste oppropene. Til det er nok opprop (minst 4), og etter pauser over 30 minutter, brukes det faste tallet over.»). «Vis ventetiden som» (v1.8): «Tid («Ca. 25 minutter») (standard)», «Klokkeslett («Din tur ca. kl. 14:35»)», «Begge («Ca. 25 minutter – ca. kl. 14:35»)», hjelpetekst «Klokkeslett rundes opp til nærmeste 5 minutter og vises ikke når ventetiden er under 5 minutter.» Linje «Nå: Stasjon A 2 min · … – f.eks. 10 foran gir «Ca. 20 minutter».» (i valgt format).
- Kort «Rapport» (v1.8): «Oppdater», «Last ned CSV», forklaring «Siden siste nullstilling per stasjon. …», tabell (Stasjon, Delt ut, Betjent, Hoppet over, Ga fra seg, Venter, Snitt ventetid, Lengste, Tempo, Travleste time; tomme verdier «–»), utvidbar «Tidligere runder (N)» med kolonnen «Nullstilt».
- Kort «Push-varsler»: bryter «Av»/«På» (standard av), forklaring om Android/PC, iPhone (Hjem-skjerm, iOS 16.4+) og at den åpne kølappen virker som før. Når på: «N gjester i kø har varsel på nå.» Svar: «Push-varsler er slått på. Nye kølapper viser «Varsle meg» innen 5 sekunder.» / «Push-varsler er slått av. Knappen er borte og ingenting sendes.»
- Kort «PIN-kode»: «Felles for operator og admin. Ny PIN logger ut alle andre enheter.», felt «Ny PIN», «Lagre», feil «PIN må være 6–12 sifre.», bekreftelse «PIN-koden er lagret. Alle andre er logget ut.»
- Kort «Om appen» (kun i admin, aldri for publikum): App «KøKlar – kølappsystem for meet-and-greet», Versjon «1.1.0 · <commit>», Utvikler «Andreas Aarlott · andreas.aarlott@ntnu.no» (mailto-lenke), Utvikling «AI-støttet utvikling».
- Utskrift: én stasjon per side med logo og arrangementsnavn (om satt), stort navn, beskrivelse, QR (12 cm) og «Skann for å få kølapp».

## `/admin/utseende`

- Samme PIN-skjerm. «Til admin», «ADMIN», «Utseende», ingress «Tilpass navn, logo, farge og fonter for dette arrangementet. …».
- **Arrangementsnavn** (maks 60, plassholder «Tomt = ikke vist»), hjelpetekst «Vises på forsiden, i fanetittelen og på utskriften av QR-kodene.» Når navnet endres og storskjermens overskrift ikke er egendefinert: avkrysset «Bruk også som overskrift på storskjermen: «<navn> · Køstatus»». Ellers: «Storskjermen har egen overskrift («…»). Endre den under «Skjermer» i admin.»
- **Logo**: ramme med logo eller «Ingen logo», «Last opp logo …»/«Bytt logo …», «Fjern logo», filinfo («SVG · 1 kB»), «PNG, JPEG, WebP eller SVG, maks 512 kB. Gjerne liggende format med gjennomsiktig bakgrunn.» Svar: «Logoen er lastet opp og i bruk.», «Logoen er fjernet.», feil «Filen er for stor (maks 512 kB).», «Filtypen støttes ikke.», «SVG-filen inneholder skript, lenker eller annet som ikke er tillatt. Lagre den på nytt som enkel SVG, eller bruk PNG.»
- **Hovedfarge**: fargevelger + hex-felt + knapp «Eksempel», «Brukes på knapper. Tekstfargen (hvit eller mørk) velges automatisk.» Gult varsel under 4,5:1: «Lav kontrast (4,3:1). Tekst på knappene kan bli vanskelig å lese – velg en mørkere eller lysere farge.»
- **Storskjermbakgrunn**: «Mørk»/«Lys», «Standard for storskjermen. En skjermlenke med eget valg for bakgrunn overstyrer dette.»
- **Font for overskrifter og nummer** og **Font for brødtekst**: Space Grotesk, Inter, Manrope, DM Sans, Source Sans 3, Work Sans, Atkinson Hyperlegible (lettlest), Systemfont. Standard merket «(standard)». Hver vises i sin egen font.
- Knapper: «Lagre» (bare ved endringer) → «Lagret. Alle sider bruker nytt utseende nå (storskjermer innen 20 sekunder).», «Angre endringer», «Tilbakestill til standard» (bekreft: «Bekreft – fjerner også logo») → «Tilbakestilt til standard utseende.»
- Forhåndsvisning (til høyre / under på mobil): «FORHÅNDSVISNING · STORSKJERM» med ekte køtall, og «FORHÅNDSVISNING · FORSIDE OG KØLAPP».

## 404

«404», «Siden finnes ikke», «Har du en kølapp? Skann QR-koden ved stasjonen på nytt.», knapp «Til forsiden».

## Feilside

Ved krasj: «Noe gikk galt», «Prøv igjen. Hjelper ikke det, spør en funksjonær.», knapp «Prøv igjen».
