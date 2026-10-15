"use client";

import { Logo, useBranding } from "@/components/BrandingContext";
import { LeaveLink, LeftView } from "./LeaveControls";
import { PushPrompt } from "./PushPrompt";
import { CheckCircle2, Clock, Hourglass, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling, useWakeLock } from "@/components/hooks";
import { CenteredMessage, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { POLL_INTERVAL_MS } from "@/lib/config";
import { ST, stationLabel, stationPlace, stationVars } from "@/lib/stations";
import { deriveTicket, type DerivedTicket, type PublicState, type PublicTicket } from "@/lib/public-state";
import { aheadText, ERROR_TEXT } from "@/lib/texts";
import { formatWait, type WaitDisplay } from "@/lib/wait";

/** Samme som LEAVE_UNDO_SECONDS på serveren (queue.ts). Serveren avgjør uansett. */
const LEAVE_UNDO_MS = 60_000;

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
  const brand = useBranding();
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [view, setView] = useState<DerivedTicket | { kind: "loading" }>({ kind: "loading" });
  const [description, setDescription] = useState("");
  // Stasjonens navn og farge (v1.6) – fra lappen, og oppdatert fra køstatusen hvis admin endrer dem.
  const [meta, setMeta] = useState<{ name: string; color: string } | null>(null);
  // Stasjonen er stengt mens gjesten venter: plassen beholdes, men vi sier ifra.
  const [closed, setClosed] = useState<{ message: string } | null>(null);
  // Push-varsel (v1.5) og «Gi fra meg plassen» (v1.7) styres fra admin. Hentes én gang (CDN-mellomlagret).
  const [push, setPush] = useState<{ enabled: boolean; publicKey: string | null } | null>(null);
  const [allowLeave, setAllowLeave] = useState(false);
  // Ventetid som varighet (standard), klokkeslett eller begge (v1.8).
  const [waitDisplay, setWaitDisplay] = useState<WaitDisplay>("duration");
  useEffect(() => {
    void api<{
      push?: { enabled: boolean; publicKey: string | null };
      queue?: { allowLeave: boolean; waitDisplay?: WaitDisplay };
    }>("/api/config", {
      cache: "default",
    }).then((r) => {
      if (!r.ok) return;
      if (r.data.push) setPush(r.data.push);
      setAllowLeave(r.data.queue?.allowLeave ?? false);
      setWaitDisplay(r.data.queue?.waitDisplay ?? "duration");
    });
  }, []);
  // Sluttid for stasjonen (v1.8): varsle hvis beregnet tur er etter siste betjening.
  const [lateEnd, setLateEnd] = useState<string | null>(null);
  // Minutter per person for ventetiden (v1.7): fra køstatusen (fast eller målt tempo).
  const [minutes, setMinutes] = useState<number | undefined>(undefined);
  // Gitt fra seg plassen: angre er mulig til dette tidspunktet (ms).
  const [undoUntil, setUndoUntil] = useState<number | null>(null);
  const previous = useRef<string>("");
  const [vibrationOn, setVibrationOn] = useState(false);
  const [failures, setFailures] = useState(0);
  const lastGeneratedAt = useRef("");

  const refresh = useCallback(async () => {
    let t = ticket;
    if (!t) {
      // Første runde (og ny runde ved nettfeil): hent selve lappen.
      const res = await api<PublicTicket>(`/api/tickets/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (res.error === "not_found") setView({ kind: "not_found" });
        return;
      }
      t = res.data;
      setTicket(t);
      setDescription(t.description);
      setMeta({ name: t.stationName ?? "", color: t.color ?? "slate" });
      setView(fromTicket(t));
      if (t.status === "left") {
        const until = t.leftAt ? Date.parse(t.leftAt) + LEAVE_UNDO_MS : 0;
        setUndoUntil(until > Date.now() ? until : null);
        return;
      }
      // Fortsett med køstatusen i samme runde, så ventetid og farge stemmer med en gang.
    }
    if (t.status === "left") return;
    const res = await api<PublicState>("/api/state", { cache: "default" });
    if (!res.ok) {
      setFailures((f) => f + 1); // Behold forrige visning, men vis varsel etter noen feil på rad.
      return;
    }
    setFailures(0);
    // Ignorer svar som er eldre enn det vi allerede har vist (kan komme i feil rekkefølge fra CDN).
    if (res.data.generatedAt < lastGeneratedAt.current) return;
    lastGeneratedAt.current = res.data.generatedAt;
    const station = res.data.stations.find((s) => s.id === t.station);
    if (station) {
      setDescription(station.description);
      setMeta({ name: station.name ?? "", color: station.color ?? "slate" });
      setClosed(station.active ? null : { message: station.closedMessage });
      setMinutes(station.minutesPerPerson);
    }
    const derived = deriveTicket(t, station);
    setView(derived);
    // Beregnet tur etter siste betjening (v1.8)?
    const late =
      station?.serviceEnd && station.endAt && derived.kind === "waiting"
        ? Date.now() + derived.ahead * station.minutesPerPerson * 60_000 > Date.parse(station.endAt)
        : false;
    setLateEnd(late ? station!.serviceEnd : null);
  }, [ticket, id]);

  /** Gjesten ga fra seg plassen: vis «gitt fra seg» lokalt (polling stopper). */
  const onLeft = useCallback(() => {
    setTicket((t) => (t ? { ...t, status: "left", leftAt: new Date().toISOString() } : t));
    setUndoUntil(Date.now() + LEAVE_UNDO_MS);
    setView({ kind: "left" });
  }, []);
  /** Angret: hent lappen på nytt fra serveren. */
  const onRejoined = useCallback(() => {
    setUndoUntil(null);
    lastGeneratedAt.current = "";
    setTicket(null);
    setView({ kind: "loading" });
  }, []);

  // «Ferdig» følges sjeldnere (en operatør kan angre), «ikke funnet» er endelig.
  usePolling(
    refresh,
    view.kind === "done" ? DONE_POLL_INTERVAL_MS : POLL_INTERVAL_MS,
    view.kind !== "not_found" && view.kind !== "left",
  );
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
    return <CenteredMessage title="Fant ikke kølappen" text={ERROR_TEXT.not_found} logoUrl={brand.logoUrl} />;
  }

  const label = `${ticket.station}${ticket.number}`;
  const st = { id: ticket.station, name: meta?.name ?? "" };
  const vars = stationVars(meta?.color ?? "slate") as React.CSSProperties;

  if (view.kind === "left") {
    return <LeftView ticketId={ticket.id} label={label} undoUntil={undoUntil} onRejoined={onRejoined} />;
  }

  if (view.kind === "called") {
    return (
      <main
        className="flex min-h-[100dvh] flex-col items-center justify-center bg-emerald-500 px-6 text-center text-white"
        aria-live="assertive"
      >
        <p className="pulser font-display text-[min(11rem,38vw)] leading-none">{label}</p>
        <p className="mt-8 font-display text-4xl">Det er din tur!</p>
        <p className="mt-4 text-xl font-medium">Gå til {stationPlace(st)}</p>
        {description && <p className="mt-8 max-w-sm rounded-3xl bg-white/15 px-6 py-4 text-lg">{description}</p>}
        {allowLeave && (
          <div className="w-full max-w-sm">
            <LeaveLink
              ticketId={ticket.id}
              tone="dark"
              label="Jeg kommer ikke – gi fra meg plassen"
              question={`Vil du gi fra deg plassen ${label}?`}
              detail="Funksjonæren får beskjed og kaller neste."
              onLeft={onLeft}
            />
          </div>
        )}
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
        {allowLeave && (
          <div className="w-full max-w-sm">
            <LeaveLink
              ticketId={ticket.id}
              label="Jeg kommer ikke tilbake – gi fra meg plassen"
              question={`Vil du gi fra deg plassen ${label}?`}
              onLeft={onLeft}
            />
          </div>
        )}
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
    <main className={`min-h-[100dvh] ${ST.soft}`} style={vars}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-6 pb-12 pt-10">
        <Logo url={brand.logoUrl} className="mb-6 h-10 max-w-[12rem]" alt={brand.eventName} />
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Kølapp · {stationLabel(st)}</p>
        <div className="mt-8 rounded-[2rem] bg-white px-6 py-10 text-center shadow-[0_25px_60px_-45px_rgba(15,23,42,0.5)]">
          <p className="text-sm font-medium text-slate-500">Din plass i køen</p>
          <p className="mt-3 font-display text-[6.5rem] leading-none tracking-tight text-slate-900">{label}</p>
          <p className={`mt-4 inline-flex items-center gap-2 rounded-full ${ST.soft} px-4 py-1.5 text-sm font-medium ${ST.text}`}>
            <span className={`h-2 w-2 rounded-full ${ST.dot}`} />
            Venter
          </p>
        </div>
        {closed && (
          <div role="status" className="mt-6 rounded-3xl border border-slate-300 bg-slate-100 p-5 text-center" data-testid="ticket-closed">
            <p className="font-medium text-slate-800">Stasjonen er midlertidig stengt</p>
            <p className="mt-1 text-sm text-slate-600">Du beholder plassen din i køen.</p>
            {closed.message && <p className="mt-3 font-medium text-slate-900">{closed.message}</p>}
          </div>
        )}
        <div className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-6" aria-live="polite">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-slate-400" aria-hidden />
            <p className="font-medium text-slate-800">{aheadText(view.ahead)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-slate-400" aria-hidden />
            <p className="font-medium text-slate-800">{formatWait(view.ahead, minutes ?? 2, waitDisplay)}</p>
          </div>
        </div>
        {lateEnd && (
          <p role="status" className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-center text-sm font-medium text-amber-900" data-testid="late-warning">
            Det kan bli for sent – siste betjening er kl. {lateEnd}. Snakk med en funksjonær.
          </p>
        )}
        {push?.enabled && push.publicKey && <PushPrompt ticketId={ticket.id} publicKey={push.publicKey} />}
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
        {allowLeave && (
          <LeaveLink
            ticketId={ticket.id}
            label="Gi fra meg plassen"
            question={`Vil du gi fra deg plassen ${label}?`}
            detail={`${aheadText(view.ahead)} – ${formatWait(view.ahead, minutes ?? 2, waitDisplay).replace(/^./, (c) => c.toLowerCase())}${waitDisplay === "duration" ? " ventetid" : ""}.`}
            onLeft={onLeft}
          />
        )}
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
