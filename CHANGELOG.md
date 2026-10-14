# Endringslogg

Formatet følger [Keep a Changelog](https://keepachangelog.com/no/1.1.0/) og [semantisk versjonering](https://semver.org/lang/no/). Nyeste øverst.

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
