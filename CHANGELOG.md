# Endringslogg

Formatet følger [Keep a Changelog](https://keepachangelog.com/no/1.1.0/) og [semantisk versjonering](https://semver.org/lang/no/). Nyeste øverst.

## [1.8.0] – 2026-10-15

Kø-innsikt. Alt nytt er av som standard – uten endringer i admin virker alt som før. Se `docs/ADMIN-GUIDE.md`.

### Lagt til
- **Se køen før du tar lapp** (bryter i «Kø og ventetid»): etter skann vises stasjonen, antall foran og ventetid med «Ta kølapp» / «Ikke nå». Mobil som allerede har lapp går rett til lappen.
- **Ventetid som tid, klokkeslett eller begge** («Ca. 25 minutter», «Din tur ca. kl. 14:35», «Ca. 25 minutter – ca. kl. 14:35»), rundet opp til 5 minutter i norsk tid. Gjelder kølapp, forhåndsvisning, storskjerm og «Gi fra meg plassen».
- **Køinfo på storskjermen** (skjermvalg «Køinfo», `info=1`): «12 i kø · ca. 25 min» eller «Køen er full» under hver åpen stasjon.
- **Sluttid og maks i kø per stasjon** (med «Bruk på alle stasjoner»): nye gjester får «Køen er full» når de ikke rekker fram eller køen er full; de som står beholder plassen og får varsel «Det kan bli for sent …». Operatør og stasjonskort viser «Plass til ca. N til før kl. 16:00» / «Full». Avgjøres i stasjonens lås – samtidige skann går aldri over grensen.
- **Rapport** i admin: delt ut, betjent, hoppet over, ga fra seg plassen, venter, snitt/lengste ventetid, tempo og travleste time per stasjon, med «Tidligere runder» (sammendrag lagres automatisk ved hver nullstilling) og «Last ned CSV» (norsk Excel). Bare tall, ingen persondata.
- **Nullstill alle køer …** øverst i admin, med bekreftelse som viser hvor mange som mister lappen.
- API: `full`, `capacityLeft`, `serviceEnd`, `endAt` i `/api/state`; `queue.confirmJoin`/`queue.waitDisplay` i `/api/config`; feilkode `queue_full`; `limits` på stasjonsruten; `POST /api/admin/reset-all`; `GET /api/admin/report` (`?format=csv`).
- Tester: klokkeslett, visninger og kapasitet (enhet); sluttid/maks, samtidige skann ved grensen, sammendrag ved nullstilling, nullstill alle (integrasjon); 6 nye E2E-scenarier; ny røyktest.
- `docs/FEATURE-REQUESTS.md` med vurderte forslag til senere.

### Endret
- Stengt-meldingen ved skann bruker stasjonens navn («Hovedscenen er stengt»), ikke bare «Stasjon X».
- Knappen på stasjonskortet heter «Navn, farge, sluttid og rekkefølge …».

### Database
- Migrering `009_queue_insight.sql`: `site_config.confirm_join` (av), `site_config.wait_display` (`duration`), `stations.service_end`, `stations.max_waiting`, tabell `station_stats`. Bare tillegg.

## [1.7.0] – 2026-10-15

Gi fra seg plassen i køen, og bedre ventetid. Se `docs/ADMIN-GUIDE.md` → «Kø og ventetid».

### Lagt til
- «Gi fra meg plassen» på kølappen (standard på): bekreftelse med antall foran og ventetid, og «Angre – ta plassen tilbake» i 60 sekunder hvis nummeret ikke er passert. Også for den som er kalt («Jeg kommer ikke») og den som er hoppet over.
- Operatør: «N har gitt fra seg plassen», og «A12 ga fra seg plassen. Trykk NESTE for å kalle neste.» når den kalte går. Stasjonskortene i admin viser antallet.
- Kortet «Kø og ventetid» i `/admin`: bryter for «Gjester kan gi fra seg plassen», og ventetid som fast antall minutter per person (standard 2, som før) eller faktisk tempo ved hver stasjon.
- Ventetid over en time vises som «Ca. 1 t 15 min».
- `POST`/`DELETE /api/tickets/:id/leave`, `minutesPerPerson` i `/api/state`, `queue.allowLeave` i `/api/config`.
- Tester: ventetidstekster og målt tempo (enhet); gi fra seg/angre, samtidig med NESTE, operatørens Angre, av-bryter og målt tempo (integrasjon); 4 nye E2E-scenarier; ny røyktest.

### Rettet
- NESTE gjorde ingenting hvis den kalte hadde gått i mellomtiden (vernet mot dobbelt trykk sammenlignet med en lapp som ikke lenger var kalt).
- Admin: valg i «Kø og ventetid» vises straks (og rettes hvis lagringen feiler), og feltene har entydige navn for skjermlesere.

### Database
- Migrering `008_leave_and_wait.sql`: lappstatus `left`, `tickets.left_at`, `site_config.allow_leave` (på), `wait_mode` (fixed), `wait_minutes` (2). Bare tillegg.

## [1.6.0] – 2026-10-15

Fritt antall stasjoner (1–12). A, B og C ser ut og virker som før. Se `docs/ADMIN-GUIDE.md`.

### Lagt til
- «Ny stasjon» i `/admin`: neste ledige bokstav (D, E …) og ledig farge, maks 12 aktive.
- «Navn, farge og rekkefølge …» per stasjon: valgfritt navn (vises på storskjerm, kølapp, operatør og i push-varsler), 12 farger eller egen farge med automatisk kontrastsjekk, og flytting til venstre/høyre.
- Arkivering (bare med tom kø) og gjenoppretting (tom kø, ny QR). Stasjoner slettes aldri, og bokstaver gjenbrukes aldri.
- Storskjermen fordeler seg etter antall (4 på én rad, 5–8 i fire kolonner, 9–12 i seks) med mindre nummer så alt får plass.
- Operatørens stasjonsvelger viser alle stasjoner og kan rulles; ukjent stasjon i adressen gir første aktive.
- Lasttest med valgfritt antall stasjoner (`STATIONS=7 npm run load`).
- Tester: stasjonskoder, farger, kontrast og storskjermoppsett (enhet), grense på 12 ved samtidige opprettelser, arkivering med kø, gjenoppretting og rekkefølge (integrasjon), 4 nye E2E-scenarier med opptil 12 stasjoner.

### Endret
- Forsideteksten følger antallet stasjoner («Tre stasjoner, én digital kø.» som før med tre).
- Skann mot ukjent eller arkivert stasjon gir «Denne lenken peker ikke på en gyldig stasjon» og teller som feil forsøk.
- `/join` viser nøytral bakgrunn mens lappen hentes.
- Operator: «Logg ut» brytes ikke over to linjer.

### Database
- Migrering `007_flexible_stations.sql`: `stations.id` kan være A–Z, nye kolonner `name`, `color`, `sort_order`, `archived_at`, `created_at`. A, B og C får dagens farger og rekkefølge. Bare tillegg.

## [1.5.0] – 2026-10-15

Push-varsel på kølappen. **Av som standard** – er det av, ser gjestene ingenting om det. Se `docs/PUSH.md`.

### Lagt til
- Bryteren «Push-varsler» i `/admin`, med antall gjester som har varsel på.
- «Varsle meg når det er min tur» på kølappen (Android, PC/Mac). Varsler: bekreftelse straks, «Du er nest i køen», «Det er din tur!» (blir stående, vibrerer) og «Du ble hoppet over». Trykk åpner kølappen. Kan slås av på lappen.
- iPhone/iPad (iOS 16.4+): veiviser for «Legg til på Hjem-skjerm», eget manifest per kølapp så Hjem-skjerm-appen åpner riktig lapp, og ikon for Hjem-skjerm.
- Service worker `/sw.js`. VAPID-nøkler lages automatisk ved migrering.
- `POST`/`DELETE /api/tickets/:id/push`, `GET /ticket/:id/manifest.webmanifest`, `push` i `/api/config`.
- Tester: endpoint-vern, varselregler og plattformgjenkjenning (enhet), utsending med ekte kryptering mot lokal push-mottaker, dobbel utsending, 410, midlertidig feil (integrasjon), og 6 E2E-scenarier inkl. service worker som viser varsel og iPhone-veiviser.
- `docs/PUSH.md` med manuell testliste for iPhone og Android.

### Sikkerhet
- Push sendes bare til kjente push-tjenester over https (SSRF-vern). Innholdet er kryptert til gjestens nettleser.

### Database
- Migrering `006_push.sql`: `site_config.push_enabled`, `settings.vapid_public/vapid_private` og tabellen `push_subscriptions`. Bare tillegg.

## [1.4.1] – 2026-10-15

Rettelser etter uavhengig gjennomgang av v1.2–v1.4.

### Rettet
- **Sikkerhet:** SVG-filteret for logo kunne omgås (skript med navnerom-prefiks, tegnkoder, `<set>`/`<animate>` på lenker, `@import`, CSS-escape). Strammet inn og testet. Var ikke utnyttbart (logo vises bare som `<img>` med sandbox-CSP, og opplasting krever admin).
- Opplastede filer (logo, lyd) ble ikke mellomlagret på Vercel-CDN-et, så hver ny enhet kostet et funksjonskall og en databaselesing. Nå `CDN-Cache-Control`.
- Samtidige opplastinger (eller opplasting og «Tilbakestill») kunne gi feilmelding. Filendringer skjer nå i én låst transaksjon.
- Utseende: opplasting eller fjerning av logo forkastet ulagrede endringer i skjemaet.
- Utseende: «Skjermer» i admin brukte gammel storskjermbakgrunn til siden ble lastet på nytt.
- Skjermer: etter «Bytt nøkkel» kunne den gamle, ugyldige skjermlenken vises og kopieres et øyeblikk. Feil ved henting av signert lenke gir nå melding og «Prøv igjen». «Åpne»-knappene er ekte deaktiverte knapper mens lenken lages.
- Storskjerm med lyd: setter nettleseren lyden på pause, kommer «Klikk for å slå på lyd» tilbake. QR med utdatert lenke slutter å spørre serveren.
- SVG-filteret avviste `url( #id )` med mellomrom.

## [1.4.0] – 2026-10-15

Utseende og logo per arrangement. Uten innstillinger ser alt ut som før. Se `docs/ADMIN-GUIDE.md`.

### Lagt til
- Ny side `/admin/utseende` (knappen «Utseende» i admin): arrangementsnavn, logo (PNG, JPEG, WebP eller SVG, maks 512 kB), hovedfarge med kontrastvarsel og automatisk tekstfarge, storskjermbakgrunn (mørk/lys) og fonter for overskrifter og brødtekst. Live forhåndsvisning av storskjerm, forside og kølapp. «Tilbakestill til standard».
- Åtte kuraterte fonter som ligger i appen: Space Grotesk, Inter, Manrope, DM Sans, Source Sans 3, Work Sans, Atkinson Hyperlegible og systemfont.
- Logo og navn på forsiden, kølappen, skann, storskjermen, fanetittelen og utskriften av QR-kodene.
- Storskjermen får nytt navn, logo, farge og font uten å lastes på nytt.
- «Bruk også som overskrift på storskjermen» ved nytt arrangementsnavn, og «Bruk arrangementsnavnet» under «Skjermer».
- `PUT`/`DELETE /api/admin/branding`, `POST`/`DELETE /api/admin/logo`, `brand` i `/api/config`.
- Tester: farger og kontrast, bildetyper og SVG-vern (enhet), utseende, logo og opprydding (integrasjon), 5 nye E2E-scenarier, 2 nye røyktester.

### Rettet
- **Sikkerhet:** `sandbox`-CSP på opplastede filer (`/api/media`) ble overstyrt av sidenes felles CSP. Settes nå i `next.config.ts`. Se `docs/SIKKERHET.md`.
- Opprydding av gamle filer så bare på lyd, og ville ha slettet en logo ved neste lydopplasting.

### Database
- Migrering `005_branding.sql`: `event_name`, `logo_media_id`, `primary_color`, `display_background`, `font_display`, `font_body` i `site_config`. Bare tillegg.

### Drift
- Forside, storskjerm, skann og lydside er nå statiske sider som fornyes når utseendet lagres (eller senest hvert 5. minutt). Ubetydelig ekstra kvote.

## [1.3.0] – 2026-10-15

Skjermer. Standard `/display` ser ut som før, bortsett fra tydeligere stengt stasjon. Se `docs/ADMIN-GUIDE.md`.

### Lagt til
- Skjermvalg i adressen til `/display`: `station` (én stasjon fyller hele skjermen), `size`, `title`, `desc`, `next`, `header`, `clock`, `theme` (lys/mørk), `sound` og `qr`. Ugyldige verdier gir standard.
- Kortet «Skjermer» i `/admin`: overskrift på storskjermen (tom = ingen), lenkebygger med forhåndsvisning med ekte køtall, «Kopier lenke», «Åpne i nytt vindu» og «Én skjerm per stasjon».
- Valgfri QR-kode for kølapp på storskjermen via signert skjermlenke, med risikovarsel i admin. «Bytt nøkkel» gjør lenken ugyldig, og skjermen sier ifra.
- Melding til publikum når en stasjon stenges («Tilbake kl. 14.00»), maks 80 tegn. Vises på storskjerm, ved skann, på kølappen og hos operatøren. Kan endres mens stasjonen er stengt.
- Kølappen sier ifra når stasjonen er stengt, og at plassen beholdes.
- `GET /api/display/qr`, `GET /api/admin/display-token`, `display.title` i `/api/config` og `closedMessage` i `/api/state`.
- `docs/ADMIN-GUIDE.md`.
- Tester: skjermvalg og QR-token (enhet), stengt-melding og overskrift (integrasjon), 7 nye E2E-scenarier for skjermer, 3 nye røyktester.

### Endret
- Stengt stasjon på storskjermen vises i gråtone med skråstriper, stort «STENGT» og eventuell melding, uten «Neste».

### Rettet
- Admin: innstillinger i kortene (lydsignal, overskrift) ble hentet på nytt ved hver oppdatering av siden og kunne overskrive det man holdt på å skrive.

### Database
- Migrering `004_display.sql`: `site_config.display_title` og `stations.closed_message`. Bare tillegg.

## [1.2.0] – 2026-10-15

Lydsignal (need-to-have fra bestiller). Se `docs/LYD-OPPSETT.md`.

### Lagt til
- Lydsignal når et nytt nummer kalles: innebygd standardlyd (klokkeslag), egen opplastet lyd (MP3, WAV, M4A, OGG, FLAC, AIFF, maks 2 MB / 15 s) eller av, og volum. Alt styres fra kortet «Lydsignal» i `/admin`.
- Lydside `/audio` for PC/iPad mot lydanlegg: «Start lydsignal», «Sist sjekket», logg over siste opprop, «Test lyd» og varsler. `?station=A` (eller `A,C`) spiller bare for valgte stasjoner. Lytter også når siden ligger i bakgrunnen (Web Worker). `/audiosignal` sender videre til `/audio`.
- Storskjermen spiller lydsignal med `/display?sound=1` etter ett klikk.
- `GET /api/config` (offentlige innstillinger, CDN 5 s) og `GET /api/media/<sha256>` (opplastede filer).
- Tester: lydregler og filtyper (enhet), innstillinger og filer (integrasjon), lydside, filter, opplasting, volum, «av» og storskjerm med lyd (E2E).

### Database
- Migrering `003_site_config_media.sql`: tabellene `site_config` og `media`. Bare tillegg.

### Sikkerhet
- CSP: `media-src 'self' blob:` og `worker-src 'self'`. Opplastede filer sjekkes på innhold og serveres med `sandbox`-CSP.

## [Ikke utgitt – plan]

### Dokumentasjon
- `docs/PLAN-UTVIDELSER.md` samkjørt med bestillers prioriteringer 15.10: lydsignal (need-to-have) som v1.2, deretter skjermer, utseende/logo, push-varsel og fleksible stasjoner. Felles grunnmur, sikkerhet, tester og dokumentasjonskrav per versjon.

## [1.1.2] – 2026-10-15

### Rettet
- Operatørsiden kunne slutte å oppdatere antall i kø til siden ble lastet på nytt. Oppdateringen planlegger nå alltid en ny runde, også etter feil, og våkner når vinduet får fokus, siden vises igjen (tilbake-knapp) eller nettet kommer tilbake. Gjelder også kølapp og storskjerm.
- Ved bytte av stasjon (A/B/C) på operatørsiden vises ikke lenger forrige stasjons tall i opptil 3 sekunder.

### Lagt til
- Operatørsiden viser «Oppdatert hh:mm:ss», har en «Oppdater»-knapp og varsler «Mistet kontakten – prøver igjen» etter to mislykkede oppdateringer.
- E2E-tester: operatør ser nye i køen uten ny innlasting, riktig tall ved stasjonsbytte, og gjenoppretting etter nettbrudd. Røyktest sjekker at operatørdata aldri mellomlagres.

### Dokumentasjon
- `docs/PLAN-UTVIDELSER.md`: implementasjonsplan for v1.2 (skjermer), v1.3 (fleksible stasjoner) og v1.4 (utseende/logo), basert på tilbakemeldinger fra brukerne.

## [1.1.1] – 2026-10-14

### Endret
- ESLint 10 (fjerner varsel om utdatert ESLint 9). Kun utviklingsverktøy.
- GitHub Actions v7 (`checkout`, `setup-node`, `upload-artifact`). Kun CI.
- Dependabot foreslår ikke lenger hovedversjoner av npm-pakker automatisk.

### Avvist
- TypeScript 7 (CI feilet – lint-verktøyene støtter bare TypeScript under 6.1) og `@types/node` 26 (passer ikke Node 22).

### Dokumentasjon
- `docs/DRIFT.md`: «Deploy og versjoner» (hvordan se hva som kjører, aldri redeploy av eldre rad, preview-bygg) og «Avhengigheter (Dependabot)».
- Feilsøking i `docs/VERCEL-OPPSETT.md` for preview-bygg, versjon og Node-varsel.

## [1.1.0] – 2026-10-14

Runde med sikkerhetsrevisjon, stabilitet og flere tester for drift i produksjon. Se `docs/PRODKLARHET.md`.

### Lagt til
- «Om appen» i `/admin` (kun der): utvikler Andreas Aarlott (andreas.aarlott@ntnu.no), AI-støttet utvikling, versjon og commit.
- Varsel i `/admin` så lenge standard-PIN 1234 brukes.
- «Fjern ventende lapper …» i `/admin` for å rydde falske lapper i et nummerområde.
- `GET /api/health` med versjon, commit, database- og migreringsstatus.
- Norske feilsider ved krasj (`error.tsx`, `global-error.tsx`).
- Varsel «Mistet kontakten – prøver igjen» på kølappen etter tre mislykkede oppdateringer.
- Tester: Playwright E2E i ekte nettleser (5 scenarier), røyktest (`npm run smoke`, kan kjøres mot produksjon), lasttest (`npm run load`), 7 nye integrasjonstester og enhetstester for nettverk.
- CI: egen E2E- og røyktestjobb. Dependabot for npm og GitHub Actions.
- Dokumentasjon: `docs/DRIFT.md` og `docs/PRODKLARHET.md`.

### Endret
- Ny PIN må ha 6–12 sifre (innlogging godtar fortsatt 4–12, så standard-PIN virker første gang).
- Økt varer 24 timer og fornyes automatisk ved bruk.
- Forsøksgrenser regnes per nettverk (IPv6 grupperes på /64). Egen grense for skann med feil nøkkel (20/min).
- Maks 100 ventende lapper per nettverk per stasjon.

### Rettet
- Skann som gjentas etter at svaret forsvant (dårlig nett) gir ikke lenger dobbeltlapp (`requestId`).
- En gjest med aktiv lapp ser den igjen ved nytt skann, også når stasjonen er stengt.
- Skann med feil nøkkel låser ikke lenger stasjonen.
- Dobbelt trykk på «Angre siste» angrer bare ett steg.
- Alle kall fra nettleseren har 8 s tidsgrense, så en hengende forbindelse ikke fryser kølapp eller operatørknapper.
- Kølappen ignorerer køstatus som kommer i feil rekkefølge.
- Databasetransaksjoner har lås- og spørretidsgrense. Døde tilkoblinger fornyes, og lesing prøves én gang til.
- Gamle forsøksgrense-rader ryddes automatisk.
- Storskjermen rydder tidtakere når den lukkes.

### Fjernet
- Ubrukt avhengighet `zod` og duplisert `public/icon.svg`.

### Database
- Migrering `002_robust_join.sql`: kolonnene `tickets.request_id` og `tickets.ip_hash` med indekser. Kjøres automatisk ved deploy, uten datatap.

## [1.0.1] – 2026-10-14

### Endret
- Node låst til 22.x på Vercel (`engines`), så en ny Node-versjon ikke tas i bruk uten testing.
- GitHub Actions oppdatert til v5 (Node 24).

### Dokumentasjon
- Oppsettsguiden viser nøyaktig hvordan Neon kobles til: bare Production og **uten** «Create Database Branch For Deployment» (ellers nullstilles databasen ved hver deploy).
- Produksjonsmiljø (URL, Vercel-prosjekt, database) beskrevet i `AGENTS.md` og `README.md`.
- Feilsøking for tapte data etter deploy og feil variabelnavn.

## [1.0.0] – 2026-10-14

Første produksjonsversjon. Erstatter piloten i Base44 (mtsko.base44.app) med samme funksjoner, tekster og utseende, bygd på nytt for sikkerhet og drift på Vercel Hobby.

### Lagt til
- Publikum: `/join` (QR med hemmelig nøkkel), `/ticket/:id` med venter / din tur / hoppet over / ferdig / ikke funnet, vibrering og skjerm-våkenhold.
- Operatør: `/operator` med NESTE, Hopp over, Angre siste (flere steg), Sett tilbake i kø, stasjonsvelger og de fem neste.
- Storskjerm: `/display` med tre kolonner, blink ved nytt nummer og fullskjerm.
- Admin: `/admin` med QR-koder laget på serveren, utskrift én stasjon per side, nullstill, aktiver/deaktiver, bytt nøkkel, rediger beskrivelse og bytt PIN.
- Postgres-skjema med migreringer som kjøres ved hver bygging.
- Enhetstester og integrasjonstester (bl.a. 200 samtidige skann og samtidige NESTE).
- CI i GitHub Actions, dokumentasjon for mennesker og AI (`AGENTS.md`, `docs/`).

### Sikkerhet (rettet fra piloten)
- Nøkler og PIN sendes aldri til nettleseren. PIN sjekkes på serveren og lagres som scrypt-hash.
- Ingen direkte databasetilgang fra nettleseren. Alle endringer krever økt og riktig `Origin`.
- QR-koder lages i appen, ikke hos tredjepart.
- Forsøksgrenser for PIN og nye kølapper, sterke nøkler (128 bit), sikkerhetshoder (CSP m.fl.).
- Nummertildeling og køhandlinger er atomiske (låst transaksjon), så duplikater og dobbel kalling er umulig.
