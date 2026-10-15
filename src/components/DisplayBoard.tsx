"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { StationId } from "@/lib/config";
import { displayColumns, ST, stationLabel, stationVars } from "@/lib/stations";
import { formatQueueShort, type WaitDisplay } from "@/lib/wait";
import type { DisplayOptions, DisplaySize } from "@/lib/display-options";
import type { PublicState, PublicStation } from "@/lib/public-state";

// Selve storskjermen, uten henting av data. Brukes av /display og av forhåndsvisningen i admin («Skjermer»).
// Standardvalgene gir nøyaktig dagens storskjerm (bortsett fra den tydeligere stengt-visningen fra v1.3).
//
// `wide`: forhåndsvisningen rendres i et 1600×900-felt som skaleres ned, så skjermbredde-klasser (md:, sm:)
// kan ikke brukes der. wide=true velger «stor skjerm»-utgaven direkte.

export interface DisplayBoardProps {
  state: PublicState | null;
  options: DisplayOptions;
  /** Overskrift fra admin. null = ikke lastet ennå (plassen holdes, ingen blinking av standardtekst). */
  title: string | null;
  blink?: Partial<Record<StationId, boolean>>;
  /** QR-SVG per stasjon (bare med gyldig signert lenke). */
  qr?: Partial<Record<StationId, string>> | null;
  /** Ventetid som varighet, klokkeslett eller begge i køinfo (v1.8). */
  waitDisplay?: WaitDisplay;
  /** Arrangementets logo (v1.4), vises til venstre i topplinjen. */
  logoUrl?: string | null;
  /** Hjørneknapper (fullskjerm) – vises i topplinjen. */
  corner?: ReactNode;
  wide?: boolean;
  /** Høyde på feltet. Standard: hele vinduet. Én stasjon krever fast høyde. */
  className?: string;
}

/** «Nå betjenes»-nummeret i kolonne-visningen. m = dagens størrelse. */
const COLUMN_SIZE: Record<DisplaySize, { narrow: string; wide: string }> = {
  s: { narrow: "text-[5rem] sm:text-[6rem]", wide: "text-[6rem]" },
  m: { narrow: "text-[7rem] sm:text-[9rem]", wide: "text-[9rem]" },
  l: { narrow: "text-[8rem] sm:text-[12rem]", wide: "text-[12rem]" },
  xl: { narrow: "text-[9rem] sm:text-[15rem]", wide: "text-[15rem]" },
};

/**
 * Mange stasjoner (v1.6): mindre nummer så alt får plass. Nøkkel = antall kolonner (4 eller 6).
 * «narrow» brukes på smale skjermer (stablet), «wide» på storskjerm og i forhåndsvisningen.
 */
const COMPACT_SIZE: Record<4 | 6, Record<DisplaySize, { narrow: string; wide: string }>> = {
  4: {
    s: { narrow: "text-[4rem]", wide: "text-[4.5rem]" },
    m: { narrow: "text-[5rem]", wide: "text-[6.5rem]" },
    l: { narrow: "text-[6rem]", wide: "text-[8rem]" },
    xl: { narrow: "text-[7rem]", wide: "text-[10rem]" },
  },
  6: {
    s: { narrow: "text-[3.5rem]", wide: "text-[3rem]" },
    m: { narrow: "text-[4rem]", wide: "text-[4.25rem]" },
    l: { narrow: "text-[5rem]", wide: "text-[5.25rem]" },
    xl: { narrow: "text-[6rem]", wide: "text-[6.5rem]" },
  },
};

/** Én stasjon fyller hele skjermen. Container-enheter, så forhåndsvisningen skalerer riktig. */
const SINGLE_SIZE: Record<DisplaySize, string> = {
  s: "text-[min(20cqw,34cqh)]",
  m: "text-[min(28cqw,44cqh)]",
  l: "text-[min(34cqw,54cqh)]",
  xl: "text-[min(42cqw,64cqh)]",
};

export function DisplayBoard({
  state,
  options,
  title,
  blink = {},
  qr,
  waitDisplay = "duration",
  logoUrl = null,
  corner,
  wide = false,
  className,
}: DisplayBoardProps) {
  // Alle aktive stasjoner i admin-rekkefølge, eller utvalget i lenken (ukjente/arkiverte hoppes over).
  const all = state?.stations.map((s) => s.id) ?? options.stations ?? [];
  const picked = options.stations ? options.stations.filter((id) => !state || all.includes(id)) : all;
  // Ingen gyldige stasjoner i lenken (f.eks. arkivert): vis alle i stedet for en tom skjerm.
  const ids = picked.length ? picked : all;
  const light = options.theme === "light";
  const only = ids.length === 1 ? ids[0] : undefined;
  const single = only !== undefined;
  // Én stasjon: fast høyde (container-enheter krever det). Flere: kan vokse (stablede kolonner på mobil).
  className ??= single ? "h-[100dvh]" : "min-h-[100dvh]";
  const showHeader = options.header && title !== "";
  const find = (id: StationId) => state?.stations.find((s) => s.id === id);

  const n = displayColumns(ids.length);
  const compact: 4 | 6 | null = n === 4 ? 4 : n === 6 ? 6 : null;
  // Hele klassenavn (Tailwind må finne dem). 1–3 stasjoner: som før.
  const cols = wide
    ? ({ 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 6: "grid-cols-6" } as Record<number, string>)[n]
    : ({
        1: "grid-cols-1",
        2: "grid-cols-1 md:grid-cols-2",
        3: "grid-cols-1 md:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
      } as Record<number, string>)[n];

  return (
    <main
      className={`flex flex-col px-6 py-8 ${single ? "[container-type:size]" : ""} ${light ? "bg-white" : "bg-black"} ${className}`}
      data-theme={options.theme}
    >
      <div className={`mx-auto flex w-full flex-1 flex-col ${single ? "" : "max-w-[1600px]"}`}>
        {(showHeader || options.clock || corner || (options.header && logoUrl)) && (
          <div className={`relative ${options.header && logoUrl ? "min-h-12" : "min-h-5"}`}>
            {options.header && logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- egen fil fra /api/media
              <img
                src={logoUrl}
                alt=""
                className="absolute left-0 top-1/2 h-12 w-auto max-w-[14rem] -translate-y-1/2 object-contain"
                data-testid="brand-logo"
              />
            )}
            {showHeader && (
              <p
                className={`text-center text-xs uppercase tracking-[0.6em] ${light ? "text-slate-400" : "text-white/35"}`}
                data-testid="display-title"
              >
                {title ?? " "}
              </p>
            )}
            <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-3">
              {options.clock && <Clock light={light} />}
              {corner}
            </div>
          </div>
        )}

        {only ? (
          <SingleStation
            id={only}
            station={find(only)}
            options={options}
            blink={Boolean(blink[only])}
            qr={qr?.[only]}
            light={light}
            waitDisplay={waitDisplay}
          />
        ) : (
          <div className={`mt-8 grid ${compact ? "gap-4" : "gap-6"} ${cols}`}>
            {ids.map((id) => (
              <Column
                key={id}
                id={id}
                station={find(id)}
                options={options}
                blink={Boolean(blink[id])}
                qr={qr?.[id]}
                light={light}
                waitDisplay={waitDisplay}
                wide={wide}
                compact={compact}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

interface StationProps {
  id: StationId;
  station?: PublicStation;
  options: DisplayOptions;
  blink: boolean;
  qr?: string;
  light: boolean;
  waitDisplay: WaitDisplay;
}

/** Køinfo (v1.8): «12 i kø · ca. 25 min», eller «Køen er full». */
function QueueInfo({ station, waitDisplay, className }: { station?: PublicStation; waitDisplay: WaitDisplay; className: string }) {
  if (!station || !station.active) return null;
  return (
    <p className={className} data-testid="queue-info">
      {station.full ? "Køen er full" : formatQueueShort(station.waiting.length, station.minutesPerPerson, waitDisplay)}
    </p>
  );
}

/** Skråstriper for stengt stasjon. */
const STRIPES_DARK = "bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.045)_0_14px,transparent_14px_28px)]";
const STRIPES_LIGHT = "bg-[repeating-linear-gradient(135deg,rgba(15,23,42,0.045)_0_14px,transparent_14px_28px)]";

function Column({ id, station, options, blink, qr, light, wide, compact, waitDisplay }: StationProps & { wide: boolean; compact: 4 | 6 | null }) {
  const active = station?.active !== false;
  const current = station?.current ?? null;
  const next = station?.waiting.slice(0, options.next) ?? [];
  const numberColor = light ? ST.text : ST.display;
  const sizes = compact ? COMPACT_SIZE[compact][options.size] : COLUMN_SIZE[options.size];
  const muted = light ? "text-slate-500" : "text-white/50";
  const box = light ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.04]";

  return (
    <section
      style={stationVars(station?.color ?? "slate")}
      className={`relative rounded-[2rem] border ${compact ? "p-5" : "p-7"} ${box} ${!active ? `${light ? STRIPES_LIGHT : STRIPES_DARK} grayscale` : ""} ${blink ? "kallblink" : ""}`}
      data-station={id}
      data-closed={!active || undefined}
    >
      <div className="flex items-center justify-between gap-4">
        {options.title ? (
          <h2 className={`font-display ${compact === 6 ? "text-xl" : compact ? "text-2xl" : "text-3xl"} ${light ? "text-slate-900" : "text-white"}`}>
            {stationLabel({ id, name: station?.name ?? "" })}
          </h2>
        ) : (
          <span />
        )}
        <span className={`text-xs uppercase tracking-[0.25em] ${active ? (light ? ST.text : ST.display) : light ? "text-slate-400" : "text-white/30"}`}>
          {!active ? "Stengt" : station?.full ? "Full" : "Åpen"}
        </span>
      </div>
      {options.desc && station?.description && <p className={`mt-2 text-lg ${muted}`}>{station.description}</p>}

      {active ? (
        <>
          <p className={`${compact ? "mt-6" : "mt-10"} text-xs uppercase tracking-[0.4em] ${light ? "text-slate-400" : "text-white/40"}`}>Nå betjenes</p>
          <p
            className={`mt-2 font-display leading-[0.85] tabular-nums ${wide ? sizes.wide : sizes.narrow} ${current !== null ? numberColor : light ? "text-slate-200" : "text-white/15"}`}
            aria-live="polite"
          >
            {current !== null ? `${id}${current}` : "–"}
          </p>
          {options.next > 0 && (
            <p className={`${compact ? "mt-6 text-base" : "mt-10 text-lg"} ${muted}`}>
              Neste:{" "}
              <span className={light ? "text-slate-900" : "text-white/90"}>
                {next.length ? next.map((n) => `${id}${n}`).join(", ") : "–"}
              </span>
            </p>
          )}
          {options.info && (
            <QueueInfo
              station={station}
              waitDisplay={waitDisplay}
              className={`${compact ? "mt-2 text-base" : "mt-3 text-xl"} font-medium ${light ? "text-slate-700" : "text-white/80"}`}
            />
          )}
          {qr && <QrBox svg={qr} className="mt-8 w-40" light={light} />}
        </>
      ) : (
        <Closed message={station?.closedMessage ?? ""} light={light} className="mt-10" big={false} />
      )}
    </section>
  );
}

function SingleStation({ id, station, options, blink, qr, light, waitDisplay }: StationProps) {
  const active = station?.active !== false;
  const current = station?.current ?? null;
  const next = station?.waiting.slice(0, options.next) ?? [];
  const muted = light ? "text-slate-500" : "text-white/50";

  return (
    <section
      style={stationVars(station?.color ?? "slate")}
      className={`relative mt-6 flex flex-1 flex-col items-center justify-center rounded-[2.5rem] px-6 py-8 text-center ${!active ? `${light ? STRIPES_LIGHT : STRIPES_DARK} grayscale` : ""} ${blink ? "kallblink" : ""}`}
      data-station={id}
      data-closed={!active || undefined}
    >
      {options.title && (
        <h2 className={`font-display text-[min(6cqw,9cqh)] leading-none ${light ? "text-slate-900" : "text-white"}`}>
          {stationLabel({ id, name: station?.name ?? "" })}
        </h2>
      )}
      {options.desc && station?.description && <p className={`mt-3 text-[min(2.6cqw,4cqh)] ${muted}`}>{station.description}</p>}
      {active ? (
        <>
          <p className={`mt-[3cqh] text-[min(1.6cqw,2.6cqh)] uppercase tracking-[0.4em] ${light ? "text-slate-400" : "text-white/40"}`}>
            Nå betjenes
          </p>
          <p
            className={`font-display leading-[0.9] tabular-nums ${SINGLE_SIZE[options.size]} ${current !== null ? (light ? ST.text : ST.display) : light ? "text-slate-200" : "text-white/15"}`}
            aria-live="polite"
          >
            {current !== null ? `${id}${current}` : "–"}
          </p>
          {options.next > 0 && (
            <p className={`mt-[2cqh] text-[min(2.8cqw,4.5cqh)] ${muted}`}>
              Neste:{" "}
              <span className={light ? "text-slate-900" : "text-white/90"}>
                {next.length ? next.map((n) => `${id}${n}`).join(", ") : "–"}
              </span>
            </p>
          )}
          {options.info && (
            <QueueInfo
              station={station}
              waitDisplay={waitDisplay}
              className={`mt-[1.5cqh] text-[min(2.4cqw,3.8cqh)] font-medium ${light ? "text-slate-700" : "text-white/80"}`}
            />
          )}
        </>
      ) : (
        <Closed message={station?.closedMessage ?? ""} light={light} className="mt-[4cqh]" big />
      )}
      {qr && active && (
        <QrBox svg={qr} className="absolute bottom-4 right-4 w-[min(16cqw,26cqh)]" light={light} />
      )}
    </section>
  );
}

function Closed({ message, light, className, big }: { message: string; light: boolean; className: string; big: boolean }) {
  return (
    <div className={className} data-testid="closed">
      <p
        className={`inline-block rounded-2xl border-4 px-6 py-2 font-display uppercase tracking-[0.15em] ${big ? "text-[min(12cqw,20cqh)]" : "text-6xl"} ${light ? "border-slate-400 text-slate-500" : "border-white/40 text-white/60"}`}
      >
        Stengt
      </p>
      {message && (
        <p className={`mt-6 ${big ? "text-[min(3.2cqw,5cqh)]" : "text-2xl"} ${light ? "text-slate-700" : "text-white/80"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

function QrBox({ svg, className, light }: { svg: string; className: string; light: boolean }) {
  return (
    <div className={`rounded-2xl bg-white p-3 text-center ${light ? "border border-slate-200" : ""} ${className}`} data-testid="display-qr">
      {/* SVG lages av qrcode-biblioteket på serveren (ingen brukerdata i markeringen). */}
      <div className="[&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mt-1 text-xs font-medium text-slate-700">Skann for kølapp</p>
    </div>
  );
}

function Clock({ light }: { light: boolean }) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const fmt = () =>
      setNow(new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" }));
    fmt();
    const t = setInterval(fmt, 10_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={`font-display text-2xl tabular-nums ${light ? "text-slate-500" : "text-white/60"}`} data-testid="display-clock">
      {now ?? ""}
    </span>
  );
}
