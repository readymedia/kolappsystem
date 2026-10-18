# Implementasjonsplan – utvidelser (v1.2–v1.6 og 2.0)

**Status:** **Godkjent 2026-10-15** og levert: v1.2–v1.4, v1.5 (push, av som standard og usynlig når av) og v1.6 (stasjoner). 2.0 ligger på roadmap og krever ny godkjenning før start.
**Sist oppdatert:** 2026-10-15
**Bestiller:** Andreas Aarlott
**Kilder:** tilbakemelding 14.10 og 15.10 (Teams-notat «Need-to-have / Nice-to-have / Roadmap»)

**Mål:** Gjøre appen gjenbrukbar for alle arrangementer, med lyd ved opprop, fleksible skjermer, egen logo og eget utseende, push-varsler og fritt antall stasjoner. Alt som virker i dag skal virke likt etter hver versjon.

## 0. Allerede levert

| Ønske | Versjon | Status |
| --- | --- | --- |
| Antall i kø oppdateres ikke på operatørsiden uten ny innlasting | 1.1.2 | Rettet og i produksjon (bekreftet av Andreas 15.10) |

### Godkjent omfang

| Versjon | Innhold | Status |
| --- | --- | --- |
| 1.2 | Lydsignal | **Levert i v1.2.0** |
| 1.3 | Skjermer | **Levert i v1.3.0** |
| 1.4 | Utseende og logo | **Levert i v1.4.0** |
| 1.5 | Push-varsel | **Levert i v1.5.0** (godkjent 15.10, av som standard) |
| 1.6 | Fritt antall stasjoner | **Levert i v1.6.0** |
| 1.7 | Gi fra seg plassen + ventetid | **Levert i v1.7.0** (bestilt og godkjent 15.10) |
| 1.8.1 / 1.9 | Hotfix (HF-1, HF-2) + «Fjern stasjon» og «Ny sesjon …» | **Plan – venter på godkjenning** (§8d) |
| 1.8 | Kø-innsikt: se køen før lapp, køinfo på storskjerm, ventetid som klokkeslett, sluttid/kapasitet, rapport, nullstill alle | **Levert i v1.8.0** (§8c) |
| 2.0 | Flere instanser og brukere | Roadmap – Later |

## 1. Rammer – gjelder alle versjoner

1. **Utvidelser, ikke endringer.** Standardoppførsel er identisk med i dag. Eksisterende QR-koder, lenker (`/display`, `/operator?station=A`) og lapper fortsetter å virke. Unntak: stengt stasjon vises tydeligere (ønsket av bestiller).
2. **Generisk.** Ingen arrangementsnavn eller logoer i koden. Alt slikt settes i `/admin` og lagres i databasen.
3. **Samme drift.** Alt kjører fortsatt på Vercel Hobby og Neon Free, uten nye betalte tjenester. Lyd, logo og push bruker bare det vi har.
4. **Migreringer er bare tillegg.** Eldre kode skal kunne kjøre mot nytt skjema, slik at tilbakerulling er trygg.
5. **Én versjon om gangen.** Hver versjon er ferdig testet, dokumentert og deployet før neste starter. Ingen deploy under et arrangement.
6. **Dokumentasjon er en del av leveransen.** Hver versjon oppdaterer dokumentene i §10, i samme commit som koden.

## 2. Prioritet og rekkefølge

| Bestillers prioritet | Ønske | Versjon | Hvorfor her |
| --- | --- | --- | --- |
| **Need-to-have** | Lydsignal når neste kalles (standardlyd, egen opplastet lyd, volum, `/audio`-side) | **1.2** | Viktigst for bestiller. Bygger felles grunnmur (innstillinger og mediefiler) som 1.3–1.5 gjenbruker. |
| Nice-to-have | Én stasjon per vindu, tilpasse storskjerm (QR, tittel, størrelse), tydelig stengt stasjon, endre eller fjerne «Meet & Greet» | **1.3** | Rask nytte for treskjermsstativet, lav risiko |
| Nice-to-have | Farger, fonter, logo per arrangement | **1.4** | Bruker grunnmuren fra 1.2 (logo som mediefil) |
| Roadmap – Now | Push-varsel til mobilen uten egen app | **1.5** | Må forklares for iPhone-brukere (§7.1), og er derfor størst å kvalitetssikre |
| Roadmap – Next | Fritt antall stasjoner | **1.6** | Største ombygging. Kommer sist, så alt annet er stabilt først. |
| Roadmap – Later | Flere instanser, brukere og parallelle køsystemer | **2.0** | Egen planrunde. Datamodellen forberedes underveis. |

Rekkefølgen kan justeres: hver versjon står på egne ben, unntatt at 1.3–1.5 bruker grunnmuren fra 1.2.

## 3. Felles grunnmur (bygges i 1.2)

### 3.1 Innstillinger: `site_config`

En tabell med én rad (`id = 1`). Nye innstillinger legges til som kolonner med standardverdier, i senere migreringer.

| Kolonne (første versjon) | Standard | Bruk |
| --- | --- | --- |
| `audio_mode` | `'default'` | `'default'` (innebygd lyd), `'custom'` (opplastet) eller `'off'` |
| `audio_volume` | `80` | 0–100 % |
| `audio_media_id` | `null` | Peker til opplastet lyd i `media` |
| `updated_at` | `now()` | Versjon for mellomlagring |

### 3.2 Mediefiler: `media`

Felles lager for opplastede filer: lyd i 1.2, logo i 1.4.

| Kolonne | Innhold |
| --- | --- |
| `id` | uuid |
| `kind` | `'audio'` eller `'logo'` |
| `mime` | sjekket filtype |
| `bytes` | `bytea` (selve filen) |
| `size` | byte |
| `sha256` | innholds-hash, brukes som versjon i adressen |
| `created_at` | tid |

- **Lagring:** I samme Postgres. Grenser: lyd ≤ 2 MB, logo ≤ 512 kB. Neon Free har 1 GB.
- **Servering:** `GET /api/media/<sha256>` med `Cache-Control: public, max-age=31536000, immutable` og `Content-Security-Policy: sandbox`. Filen hentes fra CDN etter første gang, så hver enhet koster bare ett kall.
- **Filtype:** Sjekkes på innholdet (magiske bytes), aldri på filnavnet.
- **Rydding:** Gamle filer slettes når de erstattes.

### 3.3 Offentlig konfig: `GET /api/config`

- **Innhold:** De delene av innstillingene som er trygge å vise publikum: lydmodus, volum, lydens adresse, og fra 1.4 utseende og logo.
- **Mellomlagring:** På CDN i 5 sekunder (`s-maxage=5`), samme mønster som `/api/state`. Endringer i admin vises innen 5–10 sekunder.
- **Hemmeligheter:** Aldri med. En test sjekker at nøkler og PIN ikke finnes i svaret.

### 3.4 Oppdatering som tåler bakgrunn

- **I dag:** `usePolling` pauser når fanen er skjult. Det er riktig for kølapper, fordi det sparer kvote.
- **Behov:** Lydsiden må fortsette å lytte selv om den ligger i bakgrunnen, for eksempel på PC-en som spiller Spotify.
- **Løsning:**
  - Ny innstilling `usePolling(fn, ms, { whenHidden: true })`.
  - På `/audio` kjøres hentingen i en **Web Worker**. Chrome demper tidtakere i bakgrunnsfaner (Efficiency Mode og intensiv demping), men faner som spiller lyd er unntatt, og workere rammes mindre.
- **Driftsråd:** Lydsiden bør stå i eget vindu. Legg nettstedet under «Alltid hold disse nettstedene aktive» i Chrome (Innstillinger → Ytelse), slik at fanen ikke blir lagt i dvale. Dette blir en sjekkliste i `docs/LYD-OPPSETT.md`.

### 3.5 Sikkerhetshoder

| Direktiv | Endring | Hvorfor |
| --- | --- | --- |
| `media-src` | `'self'` | Lyd fra egen app |
| `worker-src` | `'self'` | Web Worker for `/audio` og service worker for push (1.5) |
| `manifest-src` | `'self'` | Eget manifest per kølapp for push på iPhone (1.5) |

Alle andre direktiver er uendret. Ingen eksterne kilder.

## 4. v1.2 – Lydsignal (need-to-have)

### 4.1 Hva bestiller får

- **Lyd når et nytt nummer kalles** («NESTE», «Hopp over» som kaller neste, og «Angre» som kaller tilbake).
- **Standardlyd** innebygd i appen: et rolig todelt klokkeslag laget med Web Audio, så det ikke er noen fil eller lisens å tenke på.
- **Egen lyd** i admin: last opp, prøv med «Spill av», bytt eller fjern.
- **Volum** med glidebryter (0–100 %) i admin. Gjelder alle enheter som spiller lyd, innen 10 sekunder.
- **Lyden kan spilles på to steder:**
  - **`/audio`** – egen lydside for PC, iPad eller lignende koblet til lydanlegget. `/audio?station=A` (eller `A,C`) spiller bare for valgte stasjoner. `/audiosignal` sender videre til `/audio`.
  - **`/display?sound=1`** – storskjermen spiller lyd selv.

### 4.2 Lydsiden `/audio`

Nettlesere tillater ikke lyd før noen har trykket på siden. Derfor:

1. Siden åpner med en stor knapp: **«Start lydsignal»**.
2. Etter trykk vises:
   - «Lyd aktiv ✓»
   - hvilke stasjoner som følges
   - «Sist sjekket hh:mm:ss» (bevis på at den lytter)
   - logg over siste opprop (f.eks. «A12 14:31»)
   - knappen «Test lyd»
3. Mister siden kontakten eller blir lyden blokkert, vises et tydelig rødt varsel med «Trykk for å slå på lyd igjen».
4. Skjermen holdes våken (Wake Lock), slik at en iPad ikke går i dvale.

### 4.3 Regler for når lyden spilles

| Situasjon | Lyd? |
| --- | --- |
| Nytt nummer kalles på en stasjon som følges | Ja |
| Flere stasjoner kaller samtidig (samme oppdatering) | Én lyd, ikke flere oppå hverandre |
| Siden lastes eller kobles til på nytt | Nei (ingen lyd for gamle opprop) |
| Stasjonen nullstilles eller stenges | Nei |
| `audio_mode = 'off'` | Nei, og siden viser «Lyd er slått av i admin» |

Lyden utløses av den samme delte køstatusen som storskjermen bruker (`/api/state`), så det koster ingen ekstra kvote. Forsinkelsen er 0–4 sekunder, det samme som storskjermen.

### 4.4 Opplasting av egen lyd

| Krav | Valg |
| --- | --- |
| Formater | MP3, WAV, M4A/AAC, OGG/Opus, FLAC, AIFF |
| Anbefalt | **MP3 eller WAV**, fordi de spilles i alle nettlesere |
| Advarsel i admin | AIFF spilles bare i Safari. OGG spilles ikke i eldre Safari. «Spill av»-knappen viser om din nettleser støtter filen. |
| Størrelse | Maks 2 MB |
| Lengde | Maks 15 sekunder (sjekkes i nettleseren før opplasting) |
| Kontroll på serveren | Magiske bytes per format (ID3/MPEG-ramme, `RIFF…WAVE`, `ftyp`, `OggS`, `fLaC`, `FORM…AIFF`) |
| Tilgang | Kun med admin-økt og riktig Origin |

### 4.5 Data og API

| Del | Innhold |
| --- | --- |
| Migrering `003_site_config_media.sql` | Tabellene `site_config` og `media` (§3) |
| `POST /api/admin/audio` | Last opp lyd (multipart, maks 2 MB) |
| `DELETE /api/admin/audio` | Fjern egen lyd (går tilbake til standard) |
| `PUT /api/admin/config` | Lydmodus og volum |
| `GET /api/config` | Offentlig konfig (§3.3) |
| `GET /api/media/<sha256>` | Lydfilen |

### 4.6 Tester

| Type | Innhold |
| --- | --- |
| Enhet | Sjekk av magiske bytes for alle formater (gyldige, feil og forfalskede), regelen for når lyd spilles (§4.3), valg av stasjoner |
| Integrasjon | Lagre og erstatte lyd, gammel fil slettes, for stor fil avvises, konfig uten hemmeligheter |
| E2E | Last opp lyd og se at den spilles av på `/audio`. Testen fanger avspilling i nettleseren, så den ikke trenger høyttaler. Lyden spilles ved NESTE, ikke ved innlasting. `?station=A` ignorerer B. Volum følger admin. Lydsiden fortsetter i en skjult fane. |
| Manuell | PC med Spotify via lydanlegg, iPad, Safari og Chrome, 30 minutter i bakgrunnen |

## 5. v1.3 – Skjermer (nice-to-have)

Innholdet fra forrige plan, utvidet med Andreas sine ønsker 15.10.

### 5.1 Skjermvalg via lenke

`/display` leser valg fra adressen. Uten valg ser alt ut som i dag.

| Parameter | Verdier | Standard | Virkning |
| --- | --- | --- | --- |
| `station` | `A` eller `A,B` | alle | Hvilke stasjoner som vises. Én stasjon gir fullskjerm med ekstra stort nummer. |
| `size` | `s`, `m`, `l`, `xl` | `m` (= i dag) | Størrelse på «Nå betjenes»-nummeret |
| `title` | `0`/`1` | `1` | Stasjonsnavn («Stasjon A») |
| `desc` | `0`/`1` | `0` | Beskrivelse |
| `next` | `0`–`5` | `3` | Antall i «Neste»-listen (0 skjuler den) |
| `header` | `0`/`1` | `1` | Topplinjen |
| `clock` | `0`/`1` | `0` | Klokke |
| `theme` | `dark`/`light` | `dark` | Bakgrunn |
| `sound` | `0`/`1` | `0` | Spill lydsignal (fra 1.2) |
| `qr` + `t` | `1` + signert token | av | QR-kode for å ta kølapp (§5.4) |

- Ugyldige verdier gir standard, aldri feilside.
- Valgene tolkes i én ren, testet funksjon: `parseDisplayOptions()`.

### 5.2 Overskrift på storskjermen

Teksten «Meet & Greet · Køstatus» blir en innstilling i admin («Overskrift på storskjerm»):
- Står feltet tomt, skjules topplinjen.
- Standardverdien er dagens tekst.
- Lagres i `site_config.display_title` (migrering `004_display.sql`). I 1.4 blir det arrangementsnavnet.

### 5.3 Lenkebygger i admin («Skjermer»)

- Avkrysning og valg for alt i §5.1.
- Live forhåndsvisning med ekte data. Den rendres som komponent, ikke iframe, så `frame-ancestors 'none'` beholdes.
- Knappene «Kopier lenke» og «Åpne i nytt vindu».
- Hurtigvalget **«Én skjerm per stasjon»** lager én lenke per stasjon for treskjermsstativet.

### 5.4 QR-kode på storskjermen (valgfritt, med risikovarsel)

- **Signert skjermlenke:** Når «Vis QR» krysses av, legger lenkebyggeren til `&t=<token>`. `token` = HMAC(serverhemmelighet, `qr:<stasjon>:<gjeldende nøkkel>`).
- **Henting:** Ny rute `GET /api/display/qr?station=A&t=…` sjekker tokenet i konstant tid og svarer med QR-SVG. *(Levert: tokenet dekker hele stasjonsutvalget i lenken – `qr:<A,C>:<nøkkel A,nøkkel C>` – så en skjerm med flere stasjoner trenger ett token, og svaret er `{qr: {A, C}}`.)* Selve nøkkelen sendes aldri som tekst. QR hentes på nytt hvert 60. sekund.
- **Bytt nøkkel** gjør tokenet ugyldig. Skjermen viser da en diskret melding om at lenken må oppdateres i admin.

**Risikovarsel i admin** (vises når «Vis QR» krysses av):

> ⚠️ QR-koden på storskjermen kan fotograferes og deles. Alle som har bildet kan ta kølapp uten å være på stedet, og også skjermlenken gir tilgang til QR-koden. Vern som er aktivt: maks 100 ventende per nettverk, «Bytt nøkkel» (gjør både QR og skjermlenke ugyldig) og «Fjern ventende lapper». Vurdert som akseptabelt nå. Slå av hvis misbruk oppstår.

### 5.5 Tydelig stengt stasjon

**Storskjermen:**
- Kolonnen dempes med gråtone og diskret skråstripet bakgrunn.
- Nummeret erstattes av et stort **«STENGT»**-merke.
- Valgfri melding vises under, for eksempel «Tilbake kl. 14.00».
- «Neste»-listen skjules.

**Admin:** «Deaktiver» åpner feltet «Melding til publikum (valgfri, maks 80 tegn)».

**Publikum:** Meldingen vises ved skann og på kølappen. En gjest med lapp får beskjed om at stasjonen er stengt, men at plassen beholdes.

**Data:** `stations.closed_message` (i `004_display.sql`). Feltet er offentlig og tas med i `/api/state`.

### 5.6 Tester

| Type | Innhold |
| --- | --- |
| Enhet | `parseDisplayOptions`, QR-token (riktig, feil, etter nøkkelbytte) |
| E2E | Én stasjon per vindu, `size=xl`, stengt med melding, QR bare med gyldig token, lenkebyggeren kopierer riktig, tom overskrift skjuler topplinjen, standard-`/display` er uendret bortsett fra stengt-visningen |
| Røyktest | `/api/display/qr` uten token gir 403 |

## 6. v1.4 – Utseende og logo per arrangement (nice-to-have)

### 6.1 Hva kan tilpasses

| Innstilling | Standard (= i dag) | Brukes på |
| --- | --- | --- |
| Arrangementsnavn | «Meet & Greet» | Storskjerm (erstatter overskriften fra 1.3), forside, kølapp, skann, utskrift |
| Logo | ingen | Storskjerm, forside, kølapp, skann, utskrift av QR |
| Hovedfarge | `#0f172a` | Knapper og aksenter |
| Storskjermbakgrunn | mørk | Standard for `/display` (kan overstyres med `theme=`) |
| Font, overskrifter og tall | Space Grotesk | Overalt |
| Font, brødtekst | Inter | Overalt |

- **Fontliste:** Space Grotesk, Inter, Manrope, DM Sans, Source Sans 3, Work Sans, Atkinson Hyperlegible og systemfont. Alle ligger i appen. Det blir ingen Google Fonts-lenke, av hensyn til personvern og CSP.
- *(Levert: arrangementsnavnet erstatter ikke storskjermens overskrift automatisk. Feltene er adskilt, men admin foreslår «<navn> · Køstatus» når overskriften ikke er egendefinert. Begrunnelse: en egendefinert overskrift fra v1.3 skal ikke overskrives uten at admin ser det.)*
- **Logo «basert på hvilket arrangement det er»:** Last opp ny logo før hvert arrangement, eller trykk «Fjern logo». Med 2.0 får hvert arrangement sin egen.

### 6.2 Logo

| Krav | Valg |
| --- | --- |
| Format | PNG, JPEG, WebP eller SVG |
| Størrelse | Maks 512 kB |
| SVG-vern | Avvises hvis den inneholder `<script`, `on…=`, `foreignObject` eller eksterne lenker. Vises bare som `<img>`, med `sandbox`-CSP. |
| Lagring | `media` (§3.2) |

### 6.3 Data, levering og admin

- **Data:** Migrering `005_branding.sql` legger kolonner for utseende til i `site_config`.
- **Levering:** Rotlayouten leser utseendet via Next.js datacache (tag `branding`) og setter CSS-variabler og fonter. Lagring i admin kaller `revalidateTag('branding')`, så det koster ingen databasekall per besøkende.
- **Kontrast:** Admin varsler hvis kontrasten er for lav (WCAG 4,5:1), og tekstfargen velges automatisk.
- **Egen side `/admin/utseende`:** Skjema, live forhåndsvisning (storskjerm og kølapp), «Lagre» og «Tilbakestill til standard».

### 6.4 Tester

| Type | Innhold |
| --- | --- |
| Enhet | SVG-vern, magiske bytes, kontrastvarsel |
| Integrasjon | Lagre og lese utseende, logo erstattes, for stor fil avvises, «Tilbakestill» |
| E2E | Logo vises på storskjerm og kølapp. Navn og font endres. «Om appen» er fortsatt bare i admin. Uten innstillinger er utseendet pikselnært dagens (skjermbildesammenligning). |
| Sikkerhet | Opplasting uten økt gir 401, feil Origin gir 403, `sandbox`-CSP på media |

## 7. v1.5 – Push-varsel (Roadmap – Now)

### 7.1 Hva er mulig uten egen app

| Plattform | Push uten egen app? | Hva gjesten må gjøre |
| --- | --- | --- |
| Android (Chrome, Edge, Firefox, Samsung) | **Ja** | Trykke «Varsle meg» og godta |
| PC/Mac (Chrome, Edge, Firefox, Safari) | **Ja** | Trykke «Varsle meg» og godta |
| **iPhone/iPad (iOS/iPadOS 16.4+)** | **Bare fra Hjem-skjerm** | Del → «Legg til på Hjem-skjerm» → åpne derfra → «Varsle meg» → godta |
| iPhone eldre enn 16.4 | Nei | Ha siden åpen som i dag |

**Konsekvens:** Push er et **tillegg**, ikke en erstatning. Den åpne kølappen (grønn skjerm, vibrering og lyd fra 1.2) er fortsatt hovedløsningen. Push gjør at Android- og PC-brukere kan lukke nettleseren eller låse telefonen. iPhone-brukere får en kort veiviser.

### 7.2 Løsning

| Del | Valg |
| --- | --- |
| Teknologi | Standard Web Push (VAPID) med service worker `/sw.js`. Ingen ekstern varslingstjeneste: meldingene går via nettleserens egen push-tjeneste (Google, Mozilla, Apple, Microsoft), gratis. |
| Nøkler | VAPID-nøkler lages automatisk ved første migrering og lagres i databasen (som øktnøkkelen). Kan overstyres med miljøvariabler. |
| Bibliotek | `web-push` (npm), utbredt og stabilt |
| Varsler | **«Du er nest i køen»** (når det er 0 foran) og **«Det er din tur! Gå til stasjon A»** (når nummeret kalles). Valgfritt «Du ble hoppet over – snakk med en funksjonær». |
| Utsending | I samme API-kall som NESTE/Hopp over/Angre, men etter at svaret er sendt (`after()` i Next.js). Operatøren merker ingen forsinkelse. |
| Klikk på varsel | Åpner kølappen |
| iPhone | Kølappen får eget manifest (`/ticket/<id>/manifest.webmanifest`) med `start_url` = kølappen. «Legg til på Hjem-skjerm» åpner da riktig lapp, selv om Hjem-skjerm-appen har egen lagring. |
| Av/på | Admin-bryter «Push-varsler», **av som standard** (bestiller 15.10). Er den av, skjules knappen og veiviseren, og ingenting sendes. |
| Bekreftelse | *(Levert i tillegg)* «Varsel er på – A12» sendes straks gjesten slår på, så hun ser at det virker. |

### 7.3 Data og sikkerhet

- **Migrering `006_push.sql`:** Tabellen `push_subscriptions` (`ticket_id` → `tickets` med `ON DELETE CASCADE`, `endpoint`, `p256dh`, `auth`, `created_at`). Abonnementer forsvinner automatisk når lappen slettes eller køen nullstilles, og ryddes når lappen er ferdig.
- **SSRF-vern:** `endpoint` godtas bare for kjente push-tjenester: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`, `*.notify.windows.com`. Serveren kan dermed ikke brukes til å kalle vilkårlige adresser.
- **Tilgang:** `POST /api/tickets/<id>/push` krever gyldig lapp-id (som kølappen selv). Forsøksgrensen gjelder.
- **Personvern:** Ingen persondata. Abonnementet knyttes bare til lappen, og slettes med den.
- **Kvote:** Ett utgående kall per varsel. Med 300 gjester og 2 varsler hver blir det ca. 600 kall per dag, godt innenfor Hobby.

### 7.4 Tester

| Type | Innhold |
| --- | --- |
| Enhet | SSRF-sjekk av endpoint, hvem som skal varsles ved NESTE, Hopp over, Angre og «nest i køen» |
| Integrasjon | Abonnement lagres og slettes med lappen, ugyldig endpoint avvises |
| E2E | Abonner i Chromium, trykk NESTE og se at service workeren mottar push og viser varsel. Operatørens svartid er uendret. |
| Manuell | Android, PC og iPhone via Hjem-skjerm med låst skjerm |

## 8. v1.6 – Fritt antall stasjoner (Roadmap – Next)

Uendret fra forrige plan. Lyd, push og storskjerm fra 1.2–1.5 er laget generisk og virker med mange stasjoner.

| Spørsmål | Valg |
| --- | --- |
| Antall | 1–12 aktive (`MAX_ACTIVE_STATIONS`) |
| Kode | Én bokstav A–Z, tildeles automatisk og kan **aldri** endres (står i QR og lapper) |
| Navn | Fritt (maks 40 tegn). Tomt navn gir «Stasjon A». |
| Farge | Palett med 12 kontrastsjekkede farger, eller egen hex. Lyse og mørke varianter regnes ut automatisk. |
| Fjerne stasjon | Arkivere (bare med tom kø), aldri slette. Kan gjenopprettes. |
| Rekkefølge | Opp/ned-knapper |

- *(Levert: «Navn, farge og rekkefølge …» er skjult bak én knapp på hvert stasjonskort, og «Ny stasjon» er siste rute i rutenettet, så admin holder seg ryddig. Arkivering er deaktivert med forklaring når det står folk i kø. Gjenoppretting gir ny QR-kode.)*
- **Data:** Migrering `007_flexible_stations.sql`: `CHECK (id ~ '^[A-Z]$')`, `name`, `color`, `sort_order`, `archived_at` og `created_at`. A, B og C får dagens farger.
- **Kode:**
  - `STATION_IDS` og `STATION_THEME` fases ut, og farger regnes ut av `lib/color.ts`.
  - Storskjermen fordeler seg automatisk (1 / 2–4 / 5–8 / 9–12).
  - Operatørens stasjonsvelger blir rullbar ved mer enn 6 stasjoner.
  - Opprettelse låses med `pg_advisory_xact_lock`.
- **Tester:**
  - Enhet: fargeutregning og kontrast.
  - Integrasjon: grensen på 12, samtidig opprettelse, arkivering med kø avvises.
  - E2E: 7 stasjoner med lyd og storskjerm. Eksisterende A/B/C-tester passerer uendret.
  - Lasttest med 7 stasjoner.

## 8b. v1.7 – Gi fra seg plassen og ventetid (levert)

Bestilt 15.10: «Får jeg vite at det er 45 minutter ventetid, vil jeg kanskje melde meg av – og det hjelper funksjonærene å vite hvor mange de må legge opp til.»

| Spørsmål | Valg (godkjent) |
| --- | --- |
| Standard | **På**, med admin-bryter «Gjester kan gi fra seg plassen» |
| Hvem | Venter, er kalt (operatøren får «A12 ga fra seg plassen – trykk NESTE») eller er hoppet over |
| Feiltrykk | Diskret lenke + bekreftelse med antall foran og ventetid, og «Angre» i 60 s hvis nummeret ikke er passert |
| Funksjonærer | «N har gitt fra seg plassen» hos operatør og på stasjonskortene; ventetallet er alltid ekte |
| Ventetid | Admin velger fast antall minutter per person (standard 2 = som før) eller faktisk tempo (midtverdi av tiden mellom de siste oppropene, pauser over 30 min ignoreres, fast verdi til det er nok data) |
| Data | Ny lappstatus `left` + `left_at`; `site_config.allow_leave`, `wait_mode`, `wait_minutes` (migrering `008_leave_and_wait.sql`) |
| Sikkerhet | Lapp-id er adgangsbeviset, Origin-sjekk, forsøksgrense. Endringen skjer i stasjonens lås; operatørens «Angre siste» vekker aldri en lapp som er gitt fra seg |

## 8c. v1.8 – Kø-innsikt (godkjent 15.10, levert i v1.8.0)

Bestilt 15.10 (punkt 1, 2, 3, 4, 8 og 9 fra gjennomgangen). Øvrige forslag ligger i `docs/FEATURE-REQUESTS.md`.
**Regel som før: alt nytt er av som standard, så dagens oppførsel er uendret til admin slår det på.**

### 8c.1 Se køen før du tar lapp

| Spørsmål | Valg |
| --- | --- |
| Admin | «Kø og ventetid» → bryter **«Vis køen før gjesten tar lapp»**. Standard **av** (i dag: lapp med en gang). |
| Gjesten ser | Stasjonens navn og beskrivelse, «12 foran deg · ca. 25 minutter» (format etter §8c.3), knapp **«Ta kølapp»** og en lenke «Ikke nå». |
| Har allerede lapp | Samme mobil med aktiv lapp går rett til lappen (som i dag). |
| Stengt / full | Viser stengt-meldingen eller «Køen er full for i dag» (§8c.4) – ingen knapp. |
| Data | Tallene hentes fra den delte `/api/state` (CDN). Ingen ekstra databasekall. Nøkkelen sjekkes fortsatt først når lappen tas (`POST /api/join`). |
| Bonus | Forhåndsvisning i meldingsapper lager fortsatt aldri lapper. |

### 8c.2 Køinfo på storskjermen

| Spørsmål | Valg |
| --- | --- |
| Valg | Nytt skjermvalg **«Køinfo»** i «Skjermer» (`info=1` i lenken). Standard **av**. |
| Viser | Under hver stasjon: «12 i kø · ca. 25 min» (format etter §8c.3). Skjules for stengte stasjoner; «Køen er full» når §8c.4 slår inn. |
| Én stasjon per skjerm | Vises under «Neste», skalert med skjermen. |
| Data | Fra `/api/state` (har allerede antall og minutter per person). |

### 8c.3 Ventetid som tid, klokkeslett eller begge

| Innstilling (admin, «Kø og ventetid») | Eksempel | Standard |
| --- | --- | --- |
| **Varighet** | «Ca. 25 minutter» | **Ja (som i dag)** |
| **Klokkeslett** | «Din tur ca. kl. 14:35» | |
| **Begge** | «Ca. 25 minutter – ca. kl. 14:35» | |

- Klokkeslettet = nå + antall foran × minutter per person (fast eller målt tempo fra v1.7), **rundet opp til nærmeste 5 minutter**, alltid i norsk tid (Europe/Oslo), regnet ut i nettleseren og oppdatert hvert minutt.
- Nest i køen: «Under 2 minutter» / «Snart» (klokkeslett vises ikke for under 5 min).
- Gjelder kølapp, «se køen før lapp», storskjermens køinfo og bekreftelsen i «Gi fra meg plassen».
- Én ren, testet funksjon `formatWait(ahead, minutesPerPerson, mode, now)`.

### 8c.4 Sluttid og kapasitet per stasjon

| Spørsmål | Valg |
| --- | --- |
| Admin | Per stasjon under «Navn, farge og rekkefølge …» (og «Bruk på alle stasjoner»): **«Siste betjening kl.»** (f.eks. 16:00) og valgfritt **«Maks antall i kø»**. Begge tomme som standard = som i dag. |
| Regel for nye lapper | Avvises med «Køen er full for i dag» når **(a)** antall ventende ≥ maks, eller **(b)** beregnet tur for en ny gjest (nå + ventende × minutter per person) er etter sluttiden. Etter sluttiden tas ingen nye lapper. |
| De som står i kø | Beholder plassen. Ligger beregnet tur etter sluttiden, viser lappen: «Det kan bli for sent – siste betjening er kl. 16:00. Snakk med en funksjonær.» |
| Funksjonærer | Operatør og stasjonskort i admin: «Plass til ca. 18 til før kl. 16:00» eller **«Full»**. Dette er tallet for «hvor mange vi må legge opp til». |
| Storskjerm / forside | «Køen er full» på stasjonen (og i køinfo). |
| Sikkerhet | Avgjøres på serveren i samme låste transaksjon som tildeler nummer (`joinQueue`), med samme ventetid-utregning som `/api/state`. Ny feilkode `queue_full` med vennlig tekst. |
| Klokke | Sluttid lagres som klokkeslett og tolkes i norsk tid for dagens dato (enkelt å forstå; arrangementer går over én dag). |

### 8c.5 Rapport («Rapport» i admin)

| Spørsmål | Valg |
| --- | --- |
| Hvor | Nytt kort **«Rapport»** i `/admin`, med **«Last ned CSV»**. |
| Per stasjon | Delt ut · betjent · hoppet over · ga fra seg plassen · venter nå · snitt og lengste ventetid (fra lapp til kalt) · tempo (minutter per person) · travleste time (flest nye lapper). |
| Viktig detalj | «Nullstill kø» sletter lappene i dag. Derfor lagres **et sammendrag (bare tall, ingen persondata)** i ny tabell `station_stats` rett før hver nullstilling. Rapporten viser «Nå» og «Tidligere runder» med dato og klokkeslett. |
| CSV | UTF-8 med semikolon (åpnes riktig i norsk Excel), én rad per stasjon og runde. |
| Personvern | Bare tellinger og tider. Ingen lapp-id, IP-hash eller annet som kan knyttes til en person. |

### 8c.6 Nullstill alle stasjoner

- Knapp **«Nullstill alle køer …»** øverst i admin, med bekreftelse som viser «34 venter totalt – de mister lappene sine» → **«Bekreft – tøm alle køer»**.
- Serveren nullstiller hver stasjon i sin egen låste transaksjon (fast rekkefølge, så ingen vranglås), og lagrer rapport-sammendrag (§8c.5) først.
- Ny rute `POST /api/admin/reset-all` (økt + Origin-sjekk).

### 8c.7 Data, API og tester

- **Migrering `009_queue_insight.sql`** (bare tillegg): `site_config.confirm_join` (av), `site_config.wait_display` (`duration` | `clock` | `both`, standard `duration`), `stations.service_end` (klokkeslett, tom), `stations.max_waiting` (tom), tabell `station_stats`.
- **API:** `/api/state` får `full` og `capacityLeft` per stasjon (ingen hemmeligheter); `/api/config` får `queue.confirmJoin` og `queue.waitDisplay`; `GET /api/admin/report` (+ `?format=csv`); `POST /api/admin/reset-all`; stasjonsinnstillinger får `serviceEnd` og `maxWaiting`.
- **Budsjett:** ingen ny polling. Én liten ekstra beregning i `/api/state` (som allerede er CDN-mellomlagret).
- **Tester:**
  - **Enhet:** `formatWait` (alle tre visninger, avrunding, midnatt, nest i køen), kapasitetsregelen.
  - **Integrasjon:** sluttid og maks avviser nye men ikke eksisterende, samtidige skann ved grensen, sammendrag lagres ved nullstilling, nullstill alle.
  - **E2E:** forhåndsvisning med «Ta kølapp», køinfo på storskjerm, klokkeslett på lappen, «Køen er full», rapport og CSV, nullstill alle.
  - **Røyktest:** nye felt i `/api/state` og `/api/config`.
- **Dokumentasjon:** UI-SPEC, ARKITEKTUR, ADMIN-GUIDE, OPERATOR-GUIDE, KJOREPLAN (sluttid og nullstill alle), SIKKERHET (rapport uten persondata), CHANGELOG, BESLUTNINGER.

### 8c.8 Spørsmål til bestiller (besvart: forslagene godkjent 15.10)

1. Alle nye valg er av som standard. Skal «Vis køen før gjesten tar lapp» likevel være **på**? (Forslag: av, som regelen sier.)
2. Klokkeslett rundet opp til **5 minutter**? (Forslag: ja – unngår falsk presisjon.)
3. Sluttid som ett klokkeslett per stasjon (med «Bruk på alle»), og ikke dato? (Forslag: ja.)

## 8d. v1.8.1 hotfix + v1.9 – Sesjoner og «Fjern stasjon» (plan, venter på godkjenning)

Bestilt 18.10 etter test i produksjon. **Ingen kode før godkjenning. Ingenting deployes før testen er ferdig (tidligst tirsdag kveld).**
v1.8.0 er referanseversjonen («kjent god») – se `DRIFT.md`.

### 8d.1 Tilbakemeldingen

> «Det er lett å opprette en ekstra stasjon (har fem nå), men hvordan sletter man en stasjon igjen? Mellom hver
> meet the speaker setter jeg opp stasjonene med hvor mange speakere som har meldt seg på og hva de heter – med
> sesjonsnummer, sesjonsnavn og navn på hver enkelt.»

**Hva som finnes i dag (uten kode):** «Arkiver stasjon …» ligger nederst bak «Navn, farge, sluttid og rekkefølge …»
på stasjonskortet, og krever tom kø (Nullstill kø først). Det er for godt gjemt, og ordet «arkiver» er ikke det
brukeren leter etter.

**Viktig fallgruve i dag:** Arkiveres en stasjon og hentes tilbake («Gjenopprett»), får den **ny QR-nøkkel**. Da slutter
utskrevne QR-koder og skjermlenker med QR å virke. Lages i stedet en ny stasjon, får den en ny bokstav (F, G …) og ny QR.
Ved bytte av sesjon er det derfor best å **beholde stasjonene og gi dem nye navn** – det virker allerede i dag.

**Slik kan det gjøres i morgen uten ny kode:** per stasjon «Navn, farge …» → Navn = speakerens navn, blyanten ved
beskrivelsen = organisasjon. «Skjermer» → «Overskrift på storskjerm» = «Sesjon 3 · Digital forvaltning». Mellom sesjonene:
«Nullstill alle køer …» (rapporten tar vare på tallene). Stasjoner som ikke trengs: «Deaktiver» (vises som STENGT) eller arkiver.

### 8d.2 v1.8.1 – hotfix (bare utseende, lav risiko)

| Sak | Retting | Test |
| --- | --- | --- |
| HF-1 Logo over overskriften i smalt vindu | Logo og overskrift i samme rad med fast avstand; overskriften trekkes inn og brytes i stedet for å gå under logoen | E2E: smalt vindu (500 px) – overskrift og logo overlapper ikke (bounding box) |
| HF-2 «STENGT»-boksen går utenfor kortet med 4+ kolonner | Skriftstørrelse og sporing i boksen skaleres med kolonnebredden (`cqw`), `max-w-full` | E2E: 4 og 6 stasjoner stengt – boksen er innenfor kortet |
| V-1 «Angre» etter «gi fra seg plassen» | Ingen kode. Verifiseres manuelt på iPhone (skjermbilde rett etter trykk). Mangler knappen, blir det en sak | Manuelt |

### 8d.3 v1.9 – «Fjern stasjon» som er lett å finne

| Spørsmål | Forslag |
| --- | --- |
| Navn | **«Fjern stasjon …»** i stedet for «Arkiver stasjon …». Fortsatt arkivering i databasen (koden gjenbrukes aldri, invariant 16). |
| Hvor | Synlig ved siden av «Nullstill kø» / «Deaktiver» på kortet, ikke bare inne i innstillingene. |
| Kø ikke tom | I stedet for en melding: bekreftelse «3 venter – de mister lappene sine. Køen nullstilles og stasjonen fjernes.» → «Bekreft – fjern stasjon E». Sammendrag lagres i rapporten først (som ved nullstilling). Én låst transaksjon. |
| Hente tilbake | «Fjernede stasjoner (N)» nederst → **«Hent tilbake»**. **Endring:** stasjonen beholder QR-nøkkelen (utskrifter og skjermlenker virker igjen). Vil man ha ny QR, trykker man «Bytt nøkkel» etterpå. *(Spørsmål 1.)* |

### 8d.4 v1.9 – «Ny sesjon …» (oppsett mellom hver meet the speaker)

Én knapp øverst i admin ved «Nullstill alle køer …» åpner et skjema:

| Felt | Virkning |
| --- | --- |
| **Sesjon** (f.eks. «Sesjon 3 · Digital forvaltning») | Blir overskriften på storskjermen, og vises øverst på skann og kølapp («Kølapp · Sesjon 3 · …»). Tomt = som i dag. |
| **Antall stasjoner** (1–12) | Én rad per stasjon med **Navn** (speaker) og **Beskrivelse** (organisasjon). Forhåndsutfylt med dagens stasjoner. |
| **Nullstill alle køer** (avkrysset) | Tømmer køene og lagrer rapport-sammendrag, som «Nullstill alle køer». |

Når det lagres:
- Eksisterende aktive stasjoner får nye navn/beskrivelser **i rekkefølge** – samme bokstav, samme QR, samme skjermlenker.
- Trengs **færre**: de siste fjernes (arkiveres) – krever avkrysset «Nullstill» eller tom kø.
- Trengs **flere**: fjernede stasjoner hentes tilbake først (beholder QR, jf. 8d.3), deretter lages nye bokstaver.
- Alt i én operasjon på serveren (låst, fast rekkefølge). Feiler noe, endres ingenting.
- Forhåndsvisning før lagring: «A Kari Sma · B Per Misjon · C Finn Ansman – D og E fjernes – 7 venter mister lappen».

Utenfor omfang (kan komme senere): lagrede sesjoner/program for hele dagen og automatisk bytte på klokkeslett (se `FEATURE-REQUESTS.md`).

### 8d.5 Data, API og risiko

- **Migrering `010_session.sql`** (bare tillegg): `site_config.session_title text default ''`. Ingen endring av eksisterende data.
- **API:** `POST /api/admin/session` `{title, stations: [{name, description}], reset}` (økt + Origin). `archive` tar `{reset: true}`. `restore` beholder nøkkelen.
- **Standard = dagens oppførsel:** uten sesjon er alt som før. «Ny sesjon» er bare et raskere skjema for ting som allerede finnes.
- **Risiko og vern:** arbeidet gjøres på egen gren. Full testkjøring (check, integrasjon, E2E, røyktest, lasttest). **Deploy først etter testen** (tirsdag kveld eller senere, avtales), aldri under et arrangement. v1.8.0 er referanse for tilbakerulling; migreringen er bare tillegg, så tilbakerulling virker.
- **Tester:**
  - Integrasjon: fjern med kø (sammendrag lagres, lapper borte), hent tilbake beholder nøkkel, ny sesjon færre/flere/samme antall, samtidig skann under sesjonsbytte, feil midt i gir ingen endring.
  - E2E: «Fjern stasjon» med og uten kø, «Hent tilbake» – gammel QR virker; «Ny sesjon» fra 5 til 3 og fra 3 til 5 – navn på storskjerm, kølapp og operatør; HF-1/HF-2.
- **Dokumentasjon:** ADMIN-GUIDE (ny seksjon «Mellom sesjoner»), KJOREPLAN, UI-SPEC, ARKITEKTUR, SIKKERHET (nøkkel beholdes ved «Hent tilbake»), BESLUTNINGER (ADR-021, endrer ADR-018 om ny nøkkel), CHANGELOG, HOTFIX (flytt HF-1/HF-2 til «Rettet»).

### 8d.6 Spørsmål til bestiller (forslag i parentes)

1. «Hent tilbake» beholder QR-nøkkelen, så utskrifter og skjermlenker virker igjen? (Forslag: ja. Ny QR med «Bytt nøkkel» ved behov.)
2. Skal sesjonsnavnet også stå på kølappen og ved skann, eller bare på storskjermen? (Forslag: begge steder.)
3. Rekkefølge: hotfix 1.8.1 og v1.9 samlet i én deploy etter testen? (Forslag: ja, én deploy, én test.)
4. Nattmodus for storskjermen (sjeldnere henting når ingenting skjer) – med nå eller i ønskelisten? (Forslag: ønskelisten.)

## 9. 2.0 – Flere instanser og brukere (Roadmap – Later)

Ikke i denne runden. Datamodellen over er laget for at dette blir et tillegg:
- Ny tabell `events` (`slug`, navn).
- `event_id` på `stations`, `site_config`, `media` og `settings`.
- Adresser som `/e/<slug>/display`.
- Ekte brukerkontoer (e-postlenke) med roller per arrangement.

**Før 2.0:** Driften bør flyttes til Vercel Pro (vilkår for kommersiell bruk og høyere grenser). Det krever egen plan og godkjenning.

## 10. Dokumentasjon som oppdateres per versjon

| Fil | 1.2 Lyd | 1.3 Skjermer | 1.4 Utseende | 1.5 Push | 1.6 Stasjoner |
| --- | --- | --- | --- | --- | --- |
| `docs/LYD-OPPSETT.md` (ny) | Oppsett av PC/iPad mot lydanlegg, Chrome-innstillinger, test | `sound=1` på storskjerm | – | – | – |
| `docs/ADMIN-GUIDE.md` (ny) | Lyd og volum | Skjermlenker og treskjermsstativ | Logo, farger og fonter | Push av/på | Opprette og arkivere stasjoner |
| `docs/UI-SPEC.md` | `/audio` og lydkort i admin | Skjermvalg, stengt, QR-varsel | Utseende-siden | «Varsle meg» og iPhone-veiviser | Stasjonsadministrasjon |
| `docs/ARKITEKTUR.md` | `site_config`, `media`, `/api/config`, worker | `/api/display/qr` | Branding-cache | Push-flyt og `after()` | Datamodell og farger |
| `docs/SIKKERHET.md` | Opplasting og magiske bytes | QR på storskjerm | SVG-vern | SSRF-vern, VAPID | Arkivering |
| `docs/KJOREPLAN.md` | Test lyd før dørene åpner | Skjermlenker | Utseende-sjekk | Push-test | Stasjonsoppsett |
| `docs/OPERATOR-GUIDE.md` | – | – | – | Hva gjester ser | Mange stasjoner |
| `docs/DRIFT.md` | Lydsiden faller ut | – | – | Push-feil | – |
| `CHANGELOG.md`, `AGENTS.md`, `README.md` | Alltid | Alltid | Alltid | Alltid | Alltid |

## 11. Definisjon av ferdig (hver versjon)

- [ ] Alle eksisterende tester er grønne uten endret forventet oppførsel (unntak: stengt-visning i 1.3)
- [ ] Nye tester fra versjonens tabell er grønne i CI
- [ ] Lasttest uten feil eller duplikater
- [ ] Migreringen er testet begge veier: ny kode mot gammel database, og gammel kode mot ny database
- [ ] Røyktest mot produksjon etter deploy
- [ ] All dokumentasjon i §10 er oppdatert i samme commit, og versjonen er økt
- [ ] Bestiller har testet i produksjon og godkjent før neste versjon starter

## 12. Beslutninger

| Dato | Beslutning |
| --- | --- |
| 2026-10-15 | Bestiller godkjente 1.2 Lyd, 1.3 Skjermer og 1.4 Utseende, med valgene i §4–6 (standardlyd, maks 2 MB / 15 s, AIFF med Safari-varsel, QR på storskjerm med risikovarsel). |
| 2026-10-15 | 1.5 Push, 1.6 Stasjoner og 2.0 settes på roadmap og planlegges på nytt i neste runde. |
| 2026-10-15 | 1.5–1.7 godkjent og levert. 1.8 Kø-innsikt (§8c) godkjent med forslagene i §8c.8 og levert i v1.8.0. Avvik fra planen: «Snart» brukes ikke – nest i køen viser «Under N minutter» som før. |
| 2026-10-16 | v1.8.0 tas i bruk i første produksjonstest (stativ med tre skjermer, én per stasjon, QR på skjermene). Den er referanseversjonen ved tilbakerulling. Funn samles i `docs/HOTFIX.md`. |
| Åpen | Dato for neste arrangement, så vi kan sette kodefrys (minst én uke før). |
