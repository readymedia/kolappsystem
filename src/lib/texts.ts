// Rene hjelpefunksjoner for tekster som vises til publikum. Testes i tests/unit/texts.test.ts.

import { MINUTES_PER_PERSON } from "./config";

/** «Du er nest i køen» / «1 person foran deg» / «X personer foran deg». */
export function aheadText(ahead: number): string {
  if (ahead <= 0) return "Du er nest i køen";
  if (ahead === 1) return "1 person foran deg";
  return `${ahead} personer foran deg`;
}

/** Minutter som tekst: «2 minutter», «1 minutt», «1 t 15 min». */
function minutesText(min: number): string {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return m === 1 ? "1 minutt" : `${m} minutter`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} t ${rest} min` : `${h} t`;
}

/**
 * Omtrentlig ventetid. Standard (som piloten): 2 minutter per person foran.
 * Fra v1.7 kan admin velge annet antall minutter eller faktisk tempo (minutesPerPerson fra /api/state).
 */
export function waitText(ahead: number, minutesPerPerson: number = MINUTES_PER_PERSON): string {
  if (ahead <= 0) return `Under ${minutesText(Math.max(1, Math.ceil(minutesPerPerson)))}`;
  return `Ca. ${minutesText(ahead * minutesPerPerson)}`;
}

/** Feilkoder fra API-et og den vennlige teksten publikum ser. */
export const ERROR_TEXT = {
  invalid_station: "Denne lenken peker ikke på en gyldig stasjon.",
  invalid_link: "Lenken er ikke gyldig. Spør en funksjonær om hjelp.",
  closed: "Det deles ikke ut kølapper her akkurat nå. Ta kontakt med en funksjonær, så hjelper vi deg videre.",
  rate_limited: "Det kom mange forespørsler på kort tid. Vent litt og prøv igjen.",
  too_many_waiting: "Det står allerede svært mange i kø fra dette nettverket. Ta kontakt med en funksjonær.",
  busy: "Systemet er travelt akkurat nå. Prøv igjen om et øyeblikk.",
  not_found: "Lenken kan være utdatert. Skann QR-koden på nytt for å få en ny lapp.",
  wrong_pin: "Feil PIN-kode. Prøv igjen.",
  locked: "For mange feil forsøk. Vent 15 minutter og prøv igjen.",
  unauthorized: "Økten har gått ut. Logg inn på nytt.",
  bad_request: "Ugyldig forespørsel.",
  file_too_large: "Filen er for stor.",
  unsupported_file: "Filtypen støttes ikke.",
  unsafe_svg: "SVG-filen inneholder skript, lenker eller annet som ikke er tillatt. Lagre den på nytt som enkel SVG, eller bruk PNG.",
  forbidden_origin: "Forespørselen ble avvist.",
  station_limit: "Maks 12 aktive stasjoner. Arkiver en stasjon først.",
  station_not_empty: "Stasjonen har gjester i kø eller til betjening. Tøm køen (eller nullstill) før du arkiverer.",
  no_free_station: "Alle bokstavene A–Z er brukt. Gjenopprett en arkivert stasjon i stedet.",
  leave_disabled: "Det er ikke mulig å gi fra seg plassen her. Snakk med en funksjonær.",
  too_late: "Plassen kan ikke tas tilbake lenger. Skann QR-koden igjen for å få en ny kølapp.",
  push_disabled: "Varsler er ikke slått på for dette arrangementet.",
  display_link_expired: "Skjermlenken er utdatert. Lag en ny under «Skjermer» i admin.",
  db_missing: "Databasen er ikke koblet til ennå. Se docs/VERCEL-OPPSETT.md.",
  server_error: "Noe gikk galt. Prøv igjen.",
} as const;

export type ErrorCode = keyof typeof ERROR_TEXT;
