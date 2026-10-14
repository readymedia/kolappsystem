"use client";

import { CheckCircle2, Clock, Hourglass, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling, useWakeLock } from "@/components/hooks";
import { CenteredMessage, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { POLL_INTERVAL_MS, STATION_THEME } from "@/lib/config";
import { deriveTicket, type DerivedTicket, type PublicState, type PublicTicket } from "@/lib/public-state";
import { aheadText, ERROR_TEXT, waitText } from "@/lib/texts";

// Kølappen på publikums mobil.
// 1) Henter lappen én gang (/api/tickets/:id) for å få stasjon, nummer og sann status (første polling-runde).
// 2) Følger deretter den delte, CDN-mellomlagrede køstatusen (/api/state) hvert 3. sekund.
//    Slik koster hundrevis av telefoner nesten ingen databasekall (viktig på Vercel Hobby).

const VIBRATE_PATTERN = [300, 150, 300, 150, 500];
const DONE_POLL_INTERVAL_MS = 15_000;

function fromTicket(t: PublicTicket): DerivedTicket {
  if (t.status === "waiting") return { kind: "waiting", ahead: t.ahead };
  return { kind: t.status };
}

export function TicketClient({ id }: { id: string }) {
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [view, setView] = useState<DerivedTicket | { kind: "loading" }>({ kind: "loading" });
  const [description, setDescription] = useState("");
  const previous = useRef<string>("");
  const [vibrationOn, setVibrationOn] = useState(false);
  const [failures, setFailures] = useState(0);
  const lastGeneratedAt = useRef("");

  const refresh = useCallback(async () => {
    if (!ticket) {
      // Første runde (og ny runde ved nettfeil): hent selve lappen.
      const res = await api<PublicTicket>(`/api/tickets/${encodeURIComponent(id)}`);
      if (res.ok) {
        setTicket(res.data);
        setDescription(res.data.description);
        setView(fromTicket(res.data));
      } else if (res.error === "not_found") setView({ kind: "not_found" });
      return;
    }
    const res = await api<PublicState>("/api/state", { cache: "default" });
    if (!res.ok) {
      setFailures((f) => f + 1); // Behold forrige visning, men vis varsel etter noen feil på rad.
      return;
    }
    setFailures(0);
    // Ignorer svar som er eldre enn det vi allerede har vist (kan komme i feil rekkefølge fra CDN).
    if (res.data.generatedAt < lastGeneratedAt.current) return;
    lastGeneratedAt.current = res.data.generatedAt;
    const station = res.data.stations.find((s) => s.id === ticket.station);
    if (station) setDescription(station.description);
    setView(deriveTicket(ticket, station));
  }, [ticket, id]);

  // «Ferdig» følges sjeldnere (en operatør kan angre), «ikke funnet» er endelig.
  usePolling(refresh, view.kind === "done" ? DONE_POLL_INTERVAL_MS : POLL_INTERVAL_MS, view.kind !== "not_found");
  useWakeLock(view.kind === "waiting" || view.kind === "called");

  // Vibrer og vis i fanetittelen når det blir din tur.
  useEffect(() => {
    if (view.kind === "called" && previous.current !== "called") {
      try {
        navigator.vibrate?.(VIBRATE_PATTERN);
      } catch {
        // Ikke støttet (f.eks. iPhone).
      }
    }
    previous.current = view.kind;
    if (ticket) {
      document.title = view.kind === "called" ? `Din tur! ${ticket.station}${ticket.number}` : `Kølapp ${ticket.station}${ticket.number}`;
    }
  }, [view.kind, ticket]);

  if (view.kind === "loading" || (!ticket && view.kind !== "not_found")) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-paper">
        <Spinner />
      </main>
    );
  }
  if (view.kind === "not_found" || !ticket) {
    return <CenteredMessage title="Fant ikke kølappen" text={ERROR_TEXT.not_found} />;
  }

  const label = `${ticket.station}${ticket.number}`;
  const theme = STATION_THEME[ticket.station];

  if (view.kind === "called") {
    return (
      <main
        className="flex min-h-[100dvh] flex-col items-center justify-center bg-emerald-500 px-6 text-center text-white"
        aria-live="assertive"
      >
        <p className="pulser font-display text-[min(11rem,38vw)] leading-none">{label}</p>
        <p className="mt-8 font-display text-4xl">Det er din tur!</p>
        <p className="mt-4 text-xl font-medium">Gå til stasjon {ticket.station}</p>
        {description && <p className="mt-8 max-w-sm rounded-3xl bg-white/15 px-6 py-4 text-lg">{description}</p>}
      </main>
    );
  }

  if (view.kind === "skipped") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-amber-400 px-6 text-center text-amber-950" aria-live="polite">
        <Hourglass className="h-12 w-12" aria-hidden />
        <p className="mt-6 font-display text-4xl">Du ble hoppet over</p>
        <p className="mt-4 max-w-sm text-lg">
          Vi ropte opp nummeret ditt, men så deg ikke. Snakk med en funksjonær, så setter vi deg inn igjen i køen.
        </p>
        <p className="mt-10 font-display text-7xl">{label}</p>
      </main>
    );
  }

  if (view.kind === "done") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-900 px-6 text-center text-white">
        <CheckCircle2 className="h-12 w-12 text-emerald-400" aria-hidden />
        <p className="mt-6 font-display text-4xl">Ferdig – takk for besøket!</p>
        <p className="mt-4 max-w-sm text-lg text-white/70">Kølappen er avsluttet. Velkommen tilbake senere.</p>
        <p className="mt-10 font-display text-7xl text-white/30">{label}</p>
      </main>
    );
  }

  return (
    <main className={`min-h-[100dvh] ${theme.soft}`}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-6 pb-12 pt-10">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Kølapp · Stasjon {ticket.station}</p>
        <div className="mt-8 rounded-[2rem] bg-white px-6 py-10 text-center shadow-[0_25px_60px_-45px_rgba(15,23,42,0.5)]">
          <p className="text-sm font-medium text-slate-500">Din plass i køen</p>
          <p className="mt-3 font-display text-[6.5rem] leading-none tracking-tight text-slate-900">{label}</p>
          <p className={`mt-4 inline-flex items-center gap-2 rounded-full ${theme.soft} px-4 py-1.5 text-sm font-medium ${theme.text}`}>
            <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
            Venter
          </p>
        </div>
        <div className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-6" aria-live="polite">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-slate-400" aria-hidden />
            <p className="font-medium text-slate-800">{aheadText(view.ahead)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-slate-400" aria-hidden />
            <p className="font-medium text-slate-800">{waitText(view.ahead)}</p>
          </div>
        </div>
        <VibrationHint on={vibrationOn} onEnable={() => setVibrationOn(true)} />
        {description && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Du skal møte</p>
            <p className="mt-3 leading-relaxed text-slate-700">{description}</p>
          </div>
        )}
        {failures >= 3 && (
          <p role="status" className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-center text-sm font-medium text-amber-900">
            Mistet kontakten – prøver igjen. Sjekk at du har nett.
          </p>
        )}
        <p className="mt-auto pt-10 text-center text-xs text-slate-500">
          Siden oppdaterer seg selv. Ha den åpen – vi gir beskjed her når det er din tur.
        </p>
      </div>
    </main>
  );
}

/**
 * Android/Chrome tillater bare vibrering etter at brukeren har trykket på siden minst én gang.
 * Knappen gir et slikt trykk (og en kort testvibrering). Vises ikke der vibrering ikke finnes (iPhone).
 * Rendres bare i nettleseren (ventevisningen vises aldri ved server-rendering).
 */
function VibrationHint({ on, onEnable }: { on: boolean; onEnable: () => void }) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return null;
  const activated = on || (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
  if (activated) {
    return on ? <p className="mt-4 text-center text-sm text-slate-500">Vibrering er slått på.</p> : null;
  }
  return (
    <button
      type="button"
      onClick={() => {
        try {
          navigator.vibrate(120);
        } catch {
          // Ignorer.
        }
        onEnable();
      }}
      className="mt-4 w-full rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-3 text-sm font-medium text-slate-700"
    >
      Trykk her for å få vibrering når det er din tur
    </button>
  );
}
