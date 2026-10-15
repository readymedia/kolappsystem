# Ønskeliste (feature requests)

Forslag som er vurdert, men ikke planlagt ennå. Når noe velges, flyttes det til `docs/PLAN-UTVIDELSER.md` med egen plan og godkjenning.
Omfang: **S** = timer, **M** = en dag, **L** = flere dager.

| # | Forslag | Hvorfor | Omfang | Status |
| --- | --- | --- | --- | --- |
| FR-1 | **Lapp uten mobil.** Operatør/admin trykker «Ny lapp til gjest uten mobil» og får et nummer å skrive på en lapp. | Gjester uten smarttelefon kan stå i samme kø. | S | Vurdert 15.10 – ikke nå |
| FR-2 | **«Kalt for 2:10 siden»** hos operatøren, med forslag om «Hopp over» etter valgfri tid. | Operatøren slipper å gjette når noen ikke kommer. | S | Ønskeliste |
| FR-3 | **«Flytt først»** for en ventende (rullestol, barn, avtaler). | I dag kan bare de som er hoppet over settes først. | S | Ønskeliste |
| FR-4 | **Varsle tidligere:** admin velger «varsle når N er foran» (push og lyd/vibrering på lappen). | Den som har gått fra trenger mer enn ett nummer i forvarsel. | S | Ønskeliste |
| FR-5 | **Egen PIN for operatør og admin.** | I dag kan en operatør nullstille køer. Største gjenstående sikkerhetsrisiko. | M | Ønskeliste – anbefalt snart |
| FR-6 | **Feillogg i admin:** de siste 50 serverfeilene lagres i databasen. | Vercel Hobby beholder logger bare i én time. | S | Ønskeliste |
| FR-7 | **Oppvarming før dørene åpner** (åpne `/api/health` 5 min før). | Neon Free sover; første skann kan ta 1–3 s. | S (bare kjøreplan) | Ønskeliste |
| FR-8 | **Ekstern oppetidsovervåking** (f.eks. gratis UptimeRobot mot `/api/health`). | Varsel på SMS/e-post hvis appen går ned. | S (bare dokumentasjon) | Ønskeliste |
| FR-9 | **Engelsk** for publikum (språkvalg på lappen). | Internasjonale gjester. Tekstene ligger allerede samlet. | M | Ønskeliste |
| FR-10 | **2.0 – flere arrangementer og brukere.** | Se `docs/PLAN-UTVIDELSER.md` §9. | L | Roadmap – Later |

## Gjøremål (ikke kode)

- [ ] Manuell test av push på ekte iPhone og Android før push slås på (`docs/PUSH.md`).
- [ ] Vurder Vercel Pro hvis arrangementet er kommersielt (Hobby er for ikke-kommersiell bruk).
- [ ] Lag versjonsmerker (v1.3.0–v1.8.0) i GitHub under **Releases**.
