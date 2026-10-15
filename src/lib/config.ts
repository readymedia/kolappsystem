// Felles konstanter for hele appen. Ingen hemmeligheter her – filen brukes både på server og i nettleser.

export const STATION_IDS = ["A", "B", "C"] as const;
export type StationId = (typeof STATION_IDS)[number];

export function isStationId(value: unknown): value is StationId {
  return typeof value === "string" && (STATION_IDS as readonly string[]).includes(value);
}

/** Parser fritt input (f.eks. «a» fra URL) til en gyldig stasjon, eller null. */
export function parseStationId(value: unknown): StationId | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return isStationId(upper) ? upper : null;
}

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

/** Tailwind-klasser per stasjon. Må være hele strenger slik at Tailwind finner dem. */
export const STATION_THEME: Record<
  StationId,
  { solid: string; soft: string; border: string; text: string; display: string; dot: string }
> = {
  A: {
    solid: "bg-sky-500",
    soft: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-600",
    display: "text-sky-400",
    dot: "bg-sky-500",
  },
  B: {
    solid: "bg-violet-500",
    soft: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-600",
    display: "text-violet-400",
    dot: "bg-violet-500",
  },
  C: {
    solid: "bg-emerald-500",
    soft: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
    display: "text-emerald-400",
    dot: "bg-emerald-500",
  },
};
