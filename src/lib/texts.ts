// Rene hjelpefunksjoner for tekster som vises til publikum. Testes i tests/unit/texts.test.ts.

import { MINUTES_PER_PERSON } from "./config";

/** «Du er nest i køen» / «1 person foran deg» / «X personer foran deg». */
export function aheadText(ahead: number): string {
  if (ahead <= 0) return "Du er nest i køen";
  if (ahead === 1) return "1 person foran deg";
  return `${ahead} personer foran deg`;
}

/** Omtrentlig ventetid. Beholdt fra piloten: fast 2 minutter per person foran. */
export function waitText(ahead: number): string {
  if (ahead <= 0) return "Under 2 minutter";
  return `Ca. ${ahead * MINUTES_PER_PERSON} minutter`;
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
  forbidden_origin: "Forespørselen ble avvist.",
  display_link_expired: "Skjermlenken er utdatert. Lag en ny under «Skjermer» i admin.",
  db_missing: "Databasen er ikke koblet til ennå. Se docs/VERCEL-OPPSETT.md.",
  server_error: "Noe gikk galt. Prøv igjen.",
} as const;

export type ErrorCode = keyof typeof ERROR_TEXT;
