# Implementasjonsplan – utvidelser (v1.2–v1.4)

**Status:** Godkjent retning, ikke implementert. Skrevet 2026-10-14 på bakgrunn av tilbakemeldinger fra brukerne.

**Mål:** Gjøre appen gjenbrukbar for alle arrangementer (egen logo, farger og stasjoner), med fleksible storskjermer. Alt som virker i dag skal virke likt etter hver versjon.

## 1. Rammer

1. **Utvidelser, ikke endringer.** Standardoppførsel er identisk med v1.1. Eksisterende QR-koder, lenker (`/display`, `/operator?station=A`) og lapper fortsetter å virke. Unntaket er stengt stasjon på storskjermen, som brukerne ba om å få tydeligere.
2. **Generisk.** Ingen arrangementsnavn i koden. Navn, logo og farger settes i `/admin` og lagres i databasen.
3. **Samme drift.** Ingen nye tjenester: alt ligger fortsatt i Vercel Hobby og Neon Free. Ingen eksterne skript eller fonter, så CSP er uendret.
4. **Migreringer er bare tillegg.** Eldre kode skal kunne kjøre mot nytt skjema, slik at tilbakerulling er trygg.
5. **Én versjon om gangen.** Hver versjon har egne tester, egen dokumentasjon og egen deploy. Ingen deploy under et arrangement.

## 2. Oversikt

| Versjon | Innhold | Omfang | Risiko | Migrering |
| --- | --- | --- | --- | --- |
| **1.2.0 Skjermer** | Én stasjon per vindu, skjermvalg via lenke, lenkebygger i admin, QR på storskjerm (med risikovarsel), tydelig stengt stasjon med valgfri melding | Liten–middels | Lav | `003_closed_message.sql` |
| **1.3.0 Fleksible stasjoner** | 1–12 aktive stasjoner, navn og farge per stasjon, opprett/rediger/sorter/arkiver | Stor | Middels | `004_flexible_stations.sql` |
| **1.4.0 Utseende** | Arrangementsnavn, opplastet logo, hovedfarge, bakgrunn og font fra kuratert liste. Gjelder storskjerm, kølapp, skann, forside og utskrift. | Middels | Lav–middels | `005_branding.sql` |
| 2.0 (senere) | Flere arrangementer parallelt, flere brukere og roller | Stor | – | Egen plan |

Rekkefølgen er valgt slik: 1.2 gir rask nytte for treskjermsstativet. 1.3 bytter fargesystemet, og 1.4 bygger på det.

## 3. v1.2.0 – Skjermer

### 3.1 Skjermvalg via lenke

`/display` leser valg fra adressen. Uten valg ser alt ut som i dag.

| Parameter | Verdier | Standard | Virkning |
| --- | --- | --- | --- |
| `station` | `A` eller `A,B` | alle | Hvilke stasjoner som vises. Én stasjon gir fullskjermvisning med ekstra stort nummer (skalerer med skjermbredden). |
| `title` | `0`/`1` | `1` | Stasjonsnavn («Stasjon A») |
| `desc` | `0`/`1` | `0` | Beskrivelse («Møt hovedgjesten …») |
| `next` | `0`–`5` | `3` | Antall i «Neste»-listen (0 skjuler den) |
| `header` | `0`/`1` | `1` | Topplinjen («MEET & GREET · KØSTATUS», senere navn/logo) |
| `clock` | `0`/`1` | `0` | Klokke i hjørnet |
| `theme` | `dark`/`light` | `dark` | Bakgrunn |
| `qr` + `t` | `1` + token | av | QR-kode for å ta kølapp (se 3.3) |

Ugyldige verdier ignoreres stille og gir standard, aldri feilside. Parameterne tolkes i én ren funksjon, `parseDisplayOptions()` i `src/lib/display-options.ts`, som enhetstestes.

**Teknisk:**
- Storskjermen deles i komponenten `DisplayBoard`, som tar status og valg som input.
- Den brukes både av `/display` og av forhåndsvisningen i admin.
- Datakilden er fortsatt den delte, CDN-mellomlagrede `/api/state`, så flere vinduer koster nesten ingenting.

### 3.2 Lenkebygger i admin («Skjermer»)

En ny seksjon i `/admin`:
- Avkrysning for stasjoner og alle valgene over.
- Live forhåndsvisning, nedskalert `DisplayBoard` med ekte data.
- Knappene «Kopier lenke» og «Åpne i nytt vindu».
- Hurtigvalget **«Én skjerm per stasjon»** lager én lenke per stasjon (for treskjermsstativet).

Forhåndsvisningen rendres som komponent, ikke iframe. `frame-ancestors 'none'` beholdes.

### 3.3 QR-kode på storskjermen (valgfritt, med risikovarsel)

**Problemet:** `/display` er åpen uten innlogging, men QR-koden inneholder stasjonens hemmelige nøkkel. Nøkkelen kan derfor ikke legges i `/api/state`.

**Løsningen – signert skjermlenke:**
- Når admin krysser av «Vis QR», legger lenkebyggeren til `&t=<token>`.
- `token` = HMAC(serverhemmelighet, `qr:` + stasjon + `:` + gjeldende nøkkel), forkortet.
- Ny rute `GET /api/display/qr?station=A&t=…` regner tokenet ut på nytt, sammenligner i konstant tid og returnerer QR-SVG. Den returnerer aldri selve nøkkelen som tekst.
- «Bytt nøkkel» gjør tokenet ugyldig automatisk. Skjermen viser da en diskret melding om at lenken må oppdateres i admin.
- Skjermen henter QR én gang og deretter hvert 60. sekund (`no-store`). Belastningen er neglisjerbar.
- Uten gyldig token vises aldri QR, uansett `qr=1`.

**Risikovarsel i admin** (vises når «Vis QR» krysses av):

> ⚠️ QR-koden på storskjermen kan fotograferes og deles. Alle som har bildet kan ta kølapp uten å være på stedet, og også skjermlenken gir tilgang til QR-koden. Vern som er aktivt: maks 100 ventende per nettverk, «Bytt nøkkel» (gjør både QR og skjermlenke ugyldig) og «Fjern ventende lapper». Vurdert som akseptabelt nå. Slå av hvis misbruk oppstår.

Samme tekst står i `docs/SIKKERHET.md` (ny rad i trusselbildet).

### 3.4 Tydelig stengt stasjon

**Storskjermen** (gjelder også standardvisningen, fordi brukerne ba om det):
- Kolonnen dempes med gråtone og diskret skråstripet bakgrunn.
- Nummeret erstattes av et stort **«STENGT»**-merke.
- Den valgfrie meldingen vises under, for eksempel «Tilbake kl. 14.00».
- «Neste»-listen skjules.

**Admin:** Når du trykker «Deaktiver», åpnes et felt «Melding til publikum (valgfri, maks 80 tegn)». Meldingen kan også endres mens stasjonen er stengt.

**Publikum:**
- `/join` på en stengt stasjon viser meldingen under dagens tekst.
- Har gjesten allerede en lapp, vises den fortsatt med et varsel om at stasjonen er stengt («Du beholder plassen din»).

**Data:** `003_closed_message.sql` legger til `stations.closed_message text NOT NULL DEFAULT ''`. Feltet tas med i `/api/state` som `closedMessage`. Det er offentlig og ufarlig.

### 3.5 Tester for v1.2

| Type | Innhold |
| --- | --- |
| Enhet | `parseDisplayOptions` (gyldige, ugyldige og manglende verdier), QR-token: riktig, feil og etter nøkkelbytte |
| Integrasjon | `closed_message` lagres, nullstilles ikke ved aktivering, tas med i offentlig status |
| E2E | `/display?station=B` viser bare B, stengt stasjon viser «STENGT» og meldingen, QR vises bare med gyldig token og forsvinner etter «Bytt nøkkel», lenkebyggeren kopierer riktig lenke, standard-`/display` er uendret bortsett fra stengt-visningen |
| Røyktest | `/api/display/qr` uten token gir 403 |

## 4. v1.3.0 – Fleksible stasjoner

### 4.1 Valg

| Spørsmål | Valg | Begrunnelse |
| --- | --- | --- |
| Antall | 1–12 aktive | Storskjerm og operatørmeny holder seg oversiktlige. Grensen ligger i `config.ts` (`MAX_ACTIVE_STATIONS`). |
| Kode | Én bokstav A–Z, tildeles automatisk (første ledige) | Koden står i QR-koder og lapper (`A12`) og kan **aldri** endres. |
| Navn | Fritt (maks 40 tegn), valgfritt | Tomt navn gir «Stasjon A» som i dag |
| Farge | Palett med 12 kontrastsjekkede farger, eller egen hex | Lyse og mørke varianter regnes ut på serveren |
| Fjerne stasjon | **Arkivere**, aldri slette | Bare mulig med tom kø. Gamle lenker gir en vennlig melding. Kan gjenopprettes. |
| Rekkefølge | Opp/ned-knapper i admin | Enkelt og tilgjengelig, uten dra-og-slipp |

### 4.2 Data (`004_flexible_stations.sql`)

- Fjern `CHECK (id IN ('A','B','C'))`, erstatt med `CHECK (id ~ '^[A-Z]$')`.
- Legg til `name text NOT NULL DEFAULT ''`, `color text NOT NULL DEFAULT '#0ea5e9'`, `sort_order integer NOT NULL DEFAULT 0`, `archived_at timestamptz` og `created_at timestamptz NOT NULL DEFAULT now()`.
- Fyll inn A/B/C med dagens farger: A `#0ea5e9` (sky-500), B `#8b5cf6` (violet-500), C `#10b981` (emerald-500). Sett `sort_order` 1/2/3.

Eldre kode (v1.2) virker fortsatt mot dette skjemaet, fordi kolonnene har standardverdier og A/B/C finnes.

### 4.3 Kodeendringer

| Område | Endring |
| --- | --- |
| `config.ts` | `STATION_IDS` og `STATION_THEME` fases ut. `parseStationId()` sjekker bare format. Om stasjonen finnes avgjøres av databasen. |
| `queue.ts` | `lockStation()` gir `station_not_found` (404 med vennlig tekst) i stedet for unntak. Nye funksjoner: `createStation`, `updateStation`, `moveStation`, `archiveStation` (krever tom kø), `restoreStation`. Opprettelse låser med `pg_advisory_xact_lock`, slik at to samtidige opprettelser ikke får samme bokstav. |
| `lib/color.ts` (ny, ren) | Fra én hex regnes `solid`, `soft`, `border`, `text`, `display` og tekstfarge på knapp (hvit eller mørk etter WCAG-kontrast ≥ 4,5) ut. Enhetstestes. |
| `/api/state` | Gir aktive (ikke-arkiverte) stasjoner i `sort_order`, med `name` og utregnede farger. Formen er bakoverkompatibel: felter legges bare til. |
| Fargebruk i UI | Tailwind-klasser per stasjon erstattes av CSS-variabler på elementet (`style={{ "--st": … }}`) og klasser som `bg-[var(--st)]`. |
| Storskjerm | Rutenettet tilpasser seg antallet: 1 → 1 kolonne, 2–4 → én rad, 5–8 → to rader, 9–12 → tre rader. Tallstørrelsen skalerer. |
| Operatør | Stasjonsvelgeren viser alle aktive. Er det flere enn 6, brukes en rullbar rad. |
| Admin | Seksjonen «Stasjoner» får «Ny stasjon», redigering av navn/beskrivelse/farge, opp/ned og «Arkiver». En liste viser arkiverte stasjoner med «Gjenopprett». |
| Forside, kølapp, skann | Bruker navn og farge fra databasen |

### 4.4 Tester for v1.3

| Type | Innhold |
| --- | --- |
| Enhet | `lib/color.ts`: kontrast og varianter for alle palettfarger og ekstremfarger (hvit, svart, gul) |
| Integrasjon | Opprett til grensen 12 (den 13. avvises), samtidig opprettelse gir unike koder, arkivering avvises med ventende eller kalt lapp, arkivert stasjon gir `station_not_found` ved skann, gjenoppretting, ingen nøkler i offentlig status med 12 stasjoner |
| E2E | Opprett stasjon D og ta lapp D1, storskjerm med 7 stasjoner, operatør bytter mellom 7, arkiver og gjenopprett. Eksisterende scenarier med A/B/C skal passere uendret. |
| Last | `npm run load` utvidet til 7 stasjoner: 0 feil og 0 duplikater |

## 5. v1.4.0 – Utseende (generisk branding)

### 5.1 Hva som kan tilpasses

| Innstilling | Standard (= dagens utseende) | Brukes på |
| --- | --- | --- |
| Arrangementsnavn | tomt («Meet & Greet» vises som i dag) | Storskjermens topplinje, forside, kølapp, skann, utskrift |
| Logo | ingen | Storskjerm, forside, kølapp, skann, utskrift av QR |
| Hovedfarge | `#0f172a` (slate-900) | Knapper og aksenter som ikke er stasjonsfarge |
| Storskjermbakgrunn | mørk (`#000`) | Standard for `/display` (kan overstyres med `theme=` i lenken) |
| Font for overskrifter og tall | Space Grotesk | Overalt |
| Font for brødtekst | Inter | Overalt |

**Fontlisten** er kuratert og ligger i appen (`@fontsource`): Space Grotesk, Inter, Manrope, DM Sans, Source Sans 3, Work Sans, Atkinson Hyperlegible og systemfont. Nettleseren laster bare fontene som faktisk brukes. Det blir ingen fri Google Fonts-lenke, av hensyn til personvern og CSP.

### 5.2 Logo

| Krav | Valg |
| --- | --- |
| Format | PNG, JPEG, WebP eller SVG |
| Størrelse | Maks 512 kB |
| Kontroll | Filtypen sjekkes på innholdet (magiske bytes), ikke filnavnet. SVG avvises hvis den inneholder `<script`, `on…=`-attributter, `foreignObject` eller eksterne lenker. |
| Lagring | I Postgres (`bytea`), i samme database. Ingen ny tjeneste. |
| Servering | `GET /api/branding/logo?v=<versjon>` med `Cache-Control: public, max-age=31536000, immutable` og `Content-Security-Policy: sandbox`. Vises bare som `<img>`, så SVG-skript kan aldri kjøre. Ny opplasting gir ny versjon. |
| Fjerning | Knappen «Fjern logo» gjør at standardutseendet vises igjen |

### 5.3 Data og levering

- `005_branding.sql` oppretter tabellen `branding` med én rad (`id = 1`): `event_name`, `logo` (`bytea`), `logo_mime`, `logo_version`, `primary_color`, `display_background`, `font_display`, `font_body` og `updated_at`. Standardverdiene gir dagens utseende.
- Rotlayouten leser utseendet på serveren via Next.js sin datacache med taggen `branding`, og setter CSS-variabler og fontklasser på `<html>`.
- Lagring i admin kaller `revalidateTag('branding')`, slik at endringen vises med en gang uten ekstra databasekall per besøkende.
- Mangler databasen (for eksempel CI-bygg), brukes standardverdiene.
- **Kontrast:** Admin regner ut kontrast mellom hovedfarge og tekst (`lib/color.ts`). Ved for lav kontrast vises et varsel, og tekstfargen velges automatisk.

### 5.4 Admin

- Egen side `/admin/utseende`, slik at hovedsiden holdes ryddig. Den har lenke fra admin og bruker samme PIN.
- Siden har skjema, live forhåndsvisning (`DisplayBoard` og en kølapp-miniatyr), «Lagre» og «Tilbakestill til standard».

### 5.5 Tester for v1.4

| Type | Innhold |
| --- | --- |
| Enhet | SVG-sjekk (avviser skript, `onload`, `foreignObject` og eksterne `href`), sjekk av magiske bytes, kontrastvarsel |
| Integrasjon | Lagre og lese utseende, logo-versjon øker, for stor fil avvises, «Tilbakestill» |
| E2E | Last opp logo og se den på storskjerm og kølapp, endre navn og font, «Om appen» er fortsatt bare i admin, standardutseendet uten innstillinger er pikselnært dagens (skjermbildesammenligning) |
| Sikkerhet | Opplasting uten økt gir 401, feil Origin gir 403, logo-endepunktet har `sandbox`-CSP |

## 6. Senere (2.0): flere arrangementer og brukere

Ikke i denne runden. Datamodellen over er laget slik at det blir et tillegg:
- Ny tabell `events` (`slug`, navn).
- `event_id` på `stations`, `branding` og `settings`.
- Adresser som `/e/<slug>/display`.
- Ekte brukerkontoer, for eksempel innlogging med e-postlenke, og roller (admin/operatør per arrangement).

Før dette starter, bør driften flyttes til Vercel Pro, fordi Hobby-vilkårene ikke tillater kommersiell bruk og grensene blir trangere.

## 7. Dokumentasjon som oppdateres per versjon

| Fil | 1.2 | 1.3 | 1.4 |
| --- | --- | --- | --- |
| `docs/UI-SPEC.md` | Skjermvalg, stengt-visning, QR-varsel | Stasjonsadministrasjon | Utseende-siden |
| `docs/ARKITEKTUR.md` | `/api/display/qr`, `closedMessage` | Datamodell, fargeutregning | `branding`, cache-tag |
| `docs/SIKKERHET.md` | QR på storskjerm og skjermtoken | Arkivering i stedet for sletting | Logo-opplasting, SVG-vern |
| `docs/ADMIN-GUIDE.md` (ny) | Skjermoppsett for treskjermsstativ | Opprette og arkivere stasjoner | Logo, farger og fonter |
| `docs/KJOREPLAN.md` | Skjermlenker før arrangementet | Stasjonsoppsett | Utseende-sjekk |
| `CHANGELOG.md`, `AGENTS.md` | Alltid | Alltid | Alltid |

## 8. Definisjon av ferdig (hver versjon)

- [ ] Alle eksisterende tester er grønne uten endring i forventet oppførsel (unntak: stengt-visning i 1.2)
- [ ] Nye tester fra tabellene over er grønne i CI
- [ ] Lasttest uten feil eller duplikater
- [ ] Migreringen er testet: ny kode mot gammel database, og gammel kode mot ny database
- [ ] Røyktest mot produksjon etter deploy
- [ ] Dokumentasjon og CHANGELOG oppdatert, versjon økt
