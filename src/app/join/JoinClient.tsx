"use client";

import { AlertTriangle, CircleSlash, Clock, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBranding } from "@/components/BrandingContext";
import { buttonClass, Card, CenteredMessage, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { parseStationId } from "@/lib/config";
import type { PublicState, PublicStation } from "@/lib/public-state";
import { ST, stationLabel, stationVars } from "@/lib/stations";
import { aheadText, ERROR_TEXT } from "@/lib/texts";
import { formatWait, type WaitDisplay } from "@/lib/wait";

// Åpnes fra QR-koden: /join?station=A&key=...
// Lappen lages med POST (ikke ved selve sidebesøket), så forhåndsvisning i meldingsapper lager ingen lapper.
// v1.8: Er «Vis køen før gjesten tar lapp» slått på i admin, vises køen først med knappen «Ta kølapp».

type View =
  | { kind: "loading" }
  | { kind: "preview"; station: PublicStation; waitDisplay: WaitDisplay }
  | { kind: "later" }
  | { kind: "closed"; label: string; message: string }
  | { kind: "full"; label: string; serviceEnd: string | null }
  | { kind: "error"; text: string };

interface QueueConfig {
  queue?: { confirmJoin?: boolean; waitDisplay?: WaitDisplay };
}

export function JoinClient() {
  const router = useRouter();
  const { logoUrl } = useBranding();
  const params = useSearchParams();
  const station = parseStationId(params.get("station"));
  const key = params.get("key") ?? "";
  const [view, setView] = useState<View>(station ? { kind: "loading" } : { kind: "error", text: ERROR_TEXT.invalid_station });
  const [joining, setJoining] = useState(false);
  const started = useRef(false);

  /** Stasjonens offentlige status (navn, stengt-melding, kø) – fra den delte, CDN-mellomlagrede køstatusen. */
  const publicStation = useCallback(async (): Promise<PublicStation | null> => {
    const state = await api<PublicState>("/api/state", { cache: "default" });
    return state.ok ? (state.data.stations.find((s) => s.id === station) ?? null) : null;
  }, [station]);

  const join = useCallback(async () => {
    if (!station) return;
    setJoining(true);
    const storageKey = `kolapp_${station}`;
    const requestKey = `kolapp_req_${station}`;
    let existing: string | null = null;
    // requestId lagres FØR kallet. Forsvinner svaret på dårlig nett og personen skanner igjen,
    // sendes samme requestId, og serveren gir samme lapp i stedet for en ny.
    let requestId: string = newRequestId();
    try {
      existing = localStorage.getItem(storageKey);
      requestId = localStorage.getItem(requestKey) ?? requestId;
      localStorage.setItem(requestKey, requestId);
    } catch {
      // Privat modus e.l. – vi lager bare en ny lapp.
    }
    const res = await api<{ ticketId: string }>("/api/join", {
      method: "POST",
      json: { station, key, existingTicketId: existing, requestId },
    });
    if (res.ok) {
      try {
        localStorage.setItem(storageKey, res.data.ticketId);
        localStorage.removeItem(requestKey);
      } catch {
        // Ignorer.
      }
      router.replace(`/ticket/${res.data.ticketId}`);
      return;
    }
    setJoining(false);
    if (res.error === "closed" || res.error === "queue_full") {
      // Navn, valgfri melding («Tilbake kl. 14.00») og sluttid ligger i den offentlige køstatusen.
      const s = await publicStation();
      const label = s ? stationLabel(s) : `Stasjon ${station}`;
      if (res.error === "closed") setView({ kind: "closed", label, message: s?.closedMessage ?? "" });
      else setView({ kind: "full", label, serviceEnd: s?.serviceEnd ?? null });
    } else if (["invalid_link", "invalid_station", "rate_limited", "too_many_waiting", "busy"].includes(res.error)) {
      setView({ kind: "error", text: res.message });
    } else setView({ kind: "error", text: "Noe gikk galt. Prøv å skanne koden på nytt." });
  }, [station, key, router, publicStation]);

  useEffect(() => {
    if (!station || started.current) return;
    started.current = true;
    void (async () => {
      let hasTicket = false;
      try {
        hasTicket = Boolean(localStorage.getItem(`kolapp_${station}`));
      } catch {
        // Ignorer.
      }
      // Har mobilen allerede en lapp her, eller er forhåndsvisning av: rett til lappen (som før).
      const cfg = hasTicket ? null : await api<QueueConfig>("/api/config", { cache: "default" });
      if (!cfg || !cfg.ok || !cfg.data.queue?.confirmJoin) {
        await join();
        return;
      }
      const s = await publicStation();
      // Ukjent stasjon, stengt eller full: la serveren avgjøre og vise riktig melding.
      if (!s || !s.active || s.full) {
        await join();
        return;
      }
      setView({ kind: "preview", station: s, waitDisplay: cfg.data.queue.waitDisplay ?? "duration" });
    })();
  }, [station, join, publicStation]);

  if (view.kind === "preview") {
    const s = view.station;
    const ahead = s.waiting.length;
    return (
      <main className={`flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-6 ${ST.soft}`} style={stationVars(s.color)}>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- egen fil fra /api/media
          <img src={logoUrl} alt="" className="h-12 w-auto max-w-[14rem] object-contain" data-testid="brand-logo" />
        )}
        <Card className="w-full max-w-sm p-7 shadow-[0_25px_60px_-40px_rgba(15,23,42,0.4)]" >
          <p className={`text-xs uppercase tracking-[0.3em] ${ST.text}`}>Kø · {stationLabel(s)}</p>
          {s.description && <p className="mt-3 text-slate-700">{s.description}</p>}
          <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4" data-testid="join-preview">
            <p className="flex items-center gap-3 font-medium text-slate-800">
              <Users className="h-5 w-5 text-slate-400" aria-hidden />
              {ahead === 0 ? "Ingen i kø – du blir neste" : aheadText(ahead)}
            </p>
            <p className="flex items-center gap-3 font-medium text-slate-800">
              <Clock className="h-5 w-5 text-slate-400" aria-hidden />
              {formatWait(ahead, s.minutesPerPerson, view.waitDisplay)}
            </p>
          </div>
          <button type="button" disabled={joining} onClick={() => void join()} className={`${buttonClass("primary", "lg")} mt-6 w-full`}>
            {joining ? "Henter kølapp …" : "Ta kølapp"}
          </button>
          <button
            type="button"
            onClick={() => setView({ kind: "later" })}
            className="mx-auto mt-3 block text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800"
          >
            Ikke nå
          </button>
        </Card>
      </main>
    );
  }
  if (view.kind === "later") {
    return (
      <CenteredMessage
        logoUrl={logoUrl}
        title="Greit!"
        text="Du har ikke tatt kølapp. Skann QR-koden igjen når du vil stille deg i kø."
      />
    );
  }
  if (view.kind === "closed") {
    return (
      <CenteredMessage
        logoUrl={logoUrl}
        icon={<CircleSlash className="h-8 w-8 text-slate-400" aria-hidden />}
        title={`${view.label} er stengt`}
        text={view.message ? `${view.message}\n\n${ERROR_TEXT.closed}` : ERROR_TEXT.closed}
      />
    );
  }
  if (view.kind === "full") {
    return (
      <CenteredMessage
        logoUrl={logoUrl}
        icon={<CircleSlash className="h-8 w-8 text-slate-400" aria-hidden />}
        title="Køen er full"
        text={`${view.label} tar ikke imot flere i kø i dag${view.serviceEnd ? ` (siste betjening kl. ${view.serviceEnd})` : ""}. Snakk med en funksjonær.`}
      />
    );
  }
  if (view.kind === "error") {
    return (
      <CenteredMessage
        logoUrl={logoUrl}
        icon={<AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden />}
        title="Ugyldig lenke"
        text={view.text}
      />
    );
  }
  return (
    <div className="bg-paper">
      <CenteredMessage
        logoUrl={logoUrl}
        tone="soft"
        icon={<Spinner />}
        title="Henter kølappen din …"
        text="Du får et nummer og kan følge køen videre."
      />
    </div>
  );
}

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Eldre nettlesere: lag en UUID v4 for hånd.
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (Number(c) ^ (Math.floor(Math.random() * 256) & (15 >> (Number(c) / 4)))).toString(16),
    );
  }
}
