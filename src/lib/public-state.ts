// Typer og ren logikk for den offentlige køstatusen. Brukes både av server og nettleser.
// Ingen hemmeligheter (nøkler/PIN) skal noensinne inn i disse typene.

import type { StationId } from "./config";

export type TicketStatus = "waiting" | "called" | "done" | "skipped";

/** Svar fra GET /api/state – delt og kort mellomlagret på Vercel CDN. */
export interface PublicStation {
  id: StationId;
  /** Valgfritt navn (v1.6). Tomt = «Stasjon A» (se stationLabel). */
  name: string;
  /** Palett-navn eller #rrggbb (v1.6). */
  color: string;
  description: string;
  active: boolean;
  /** Valgfri melding når stasjonen er stengt («Tilbake kl. 14.00»). Tom streng = ingen. */
  closedMessage: string;
  /** Økes ved nullstilling. */
  generation: number;
  /** Neste nummer som vil bli delt ut. */
  nextNumber: number;
  /** Nummeret som betjenes nå, eller null. */
  current: number | null;
  /** Ventende nummer, stigende. */
  waiting: number[];
  /** Nummer som er hoppet over (og ikke satt tilbake i kø). */
  skipped: number[];
}

export interface PublicState {
  stations: PublicStation[];
  /** ISO-tidspunkt for når svaret ble laget. */
  generatedAt: string;
}

/** Svar fra GET /api/tickets/:id – én lapp, aldri mellomlagret. */
export interface PublicTicket {
  id: string;
  station: StationId;
  number: number;
  generation: number;
  status: TicketStatus;
  ahead: number;
  description: string;
  /** Stasjonens navn og farge (v1.6), så lappen får riktig farge med en gang. */
  stationName: string;
  color: string;
}

export type DerivedTicket =
  | { kind: "not_found" }
  | { kind: "waiting"; ahead: number }
  | { kind: "called" }
  | { kind: "skipped" }
  | { kind: "done" };

/**
 * Utleder lappens status fra den delte køstatusen, slik at hver telefon slipper et eget databasekall.
 * Tåler at køstatusen er noen sekunder gammel (CDN-mellomlagring).
 */
export function deriveTicket(
  ticket: Pick<PublicTicket, "number" | "generation">,
  station: PublicStation | undefined,
): DerivedTicket {
  if (!station) return { kind: "not_found" };
  // Stasjonen er nullstilt etter at lappen ble laget.
  if (station.generation > ticket.generation) return { kind: "not_found" };
  // Køstatusen er eldre enn lappen (laget før nullstilling, eller før lappen fantes): regn som ventende.
  if (station.generation < ticket.generation || ticket.number >= station.nextNumber) {
    return { kind: "waiting", ahead: station.waiting.length };
  }
  if (station.current === ticket.number) return { kind: "called" };
  if (station.waiting.includes(ticket.number)) {
    return { kind: "waiting", ahead: station.waiting.filter((n) => n < ticket.number).length };
  }
  if (station.skipped.includes(ticket.number)) return { kind: "skipped" };
  return { kind: "done" };
}

export function ticketLabel(station: string, number: number | null | undefined): string {
  return number == null ? "–" : `${station}${number}`;
}
