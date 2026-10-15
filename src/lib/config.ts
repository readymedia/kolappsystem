// Felles konstanter for hele appen. Ingen hemmeligheter her – filen brukes både på server og i nettleser.

// Stasjoner er data i databasen fra v1.6 (se src/lib/stations.ts). Kode, farge og navn ligger der.
export { parseStationId, type StationId } from "./stations";

/** Oppdateringsintervall for alle sider som følger køen (krav: hvert 3. sekund). */
export const POLL_INTERVAL_MS = 3000;

/** Fast estimat brukt i ventetid-teksten (beholdt fra piloten). */
export const MINUTES_PER_PERSON = 2;

/** Antall neste i køen som vises på operatorsiden og storskjermen. */
export const OPERATOR_NEXT_COUNT = 5;
export const DISPLAY_NEXT_COUNT = 3;

/** Innloggingsøkt for operator/admin. Fornyes automatisk ved bruk, så den ikke går ut midt i et arrangement. */
export const SESSION_COOKIE = "kolapp_session";
export const SESSION_HOURS = 24;
export const SESSION_RENEW_AFTER_MINUTES = 60;

/** PIN ved innlogging: kun sifre, 4–12 tegn (standard-PIN 1234 må kunne brukes første gang). */
export const PIN_PATTERN = /^\d{4,12}$/;
/** Ny PIN som settes i /admin: minst 6 sifre, så den ikke kan gjettes i løpet av en dag. */
export const NEW_PIN_PATTERN = /^\d{6,12}$/;
export const DEFAULT_PIN = "1234";

/** Maks ventende lapper per nettverk (IP / IPv6-/64) per stasjon. Stopper flom fra en delt QR-kode. */
export const MAX_WAITING_PER_NETWORK = 100;

/** Tidsgrense for alle kall fra nettleseren, så en hengende forbindelse aldri fryser skjermen. */
export const REQUEST_TIMEOUT_MS = 8000;

/** Forsøksgrenser. */
export const RATE_LIMITS = {
  /** Nye kølapper per IP. Raust fordi mange gjester deler én IP på konferanse-Wi-Fi; nøkkelen stopper misbruk. */
  join: { limit: 300, windowSeconds: 60 },
  /** Slå varsel av/på per IP (v1.5). */
  push: { limit: 120, windowSeconds: 60 },
  /** Skann med feil nøkkel per IP (gamle eller falske QR-koder). */
  joinInvalid: { limit: 20, windowSeconds: 60 },
  /** PIN-forsøk per IP. */
  login: { limit: 5, windowSeconds: 15 * 60 },
  /** Feil PIN-forsøk totalt (alle IP-er), mot gjetting fra mange adresser. */
  loginGlobal: { limit: 100, windowSeconds: 15 * 60 },
} as const;
