"use client";

import { capacityText } from "@/lib/wait";
import { RefreshCw, RotateCcw, SkipForward, Undo2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling, useWakeLock } from "@/components/hooks";
import { LogoutButton } from "@/components/LogoutButton";
import { buttonClass, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { POLL_INTERVAL_MS, type StationId } from "@/lib/config";
import { ST, stationLabel, stationVars, type StationInfo } from "@/lib/stations";
import type { OperatorView } from "@/lib/queue";

// Mobil for den som styrer en stasjon. Alle knapper sender én atomisk handling til serveren
// og får ny tilstand tilbake, så skjermen alltid viser sannheten.

type Action = "next" | "skip" | "undo" | "requeue";

export function OperatorClient({ station, stations }: { station: StationId; stations: StationInfo[] }) {
  const router = useRouter();
  const me = stations.find((s) => s.id === station) ?? { id: station, name: "", color: "slate" };
  // Mange stasjoner: vis valgt stasjon i den rullbare velgeren (én gang ved innlasting).
  const activeTab = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    activeTab.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);
  const [view, setView] = useState<OperatorView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Økes ved hver knappetrykk. Et polling-svar som startet før trykket forkastes,
  // så et gammelt svar aldri overskriver den ferske tilstanden fra handlingen.
  const actionSeq = useRef(0);
  // Når siden sist fikk ferske data, og hvor mange oppdateringer på rad som har feilet.
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [failures, setFailures] = useState(0);

  const handleError = useCallback(
    (status: number, message: string) => {
      if (status === 401) router.refresh(); // Økta er ute – vis PIN-skjermen.
      else setError(message);
    },
    [router],
  );

  const load = useCallback(async () => {
    if (busy) return;
    const seq = actionSeq.current;
    const res = await api<OperatorView>(`/api/operator/${station}`);
    if (seq !== actionSeq.current) return;
    if (res.ok) {
      setView(res.data);
      setError("");
      setUpdatedAt(new Date());
      setFailures(0);
    } else {
      setFailures((f) => f + 1);
      if (res.status === 401) handleError(res.status, res.message);
    }
  }, [station, busy, handleError]);

  usePolling(load, POLL_INTERVAL_MS);
  useWakeLock(true);

  async function act(action: Action, ticketId?: string) {
    if (busy) return;
    setBusy(true);
    actionSeq.current += 1;
    const res = await api<OperatorView>(`/api/operator/${station}/${action}`, {
      method: "POST",
      json: ticketId
        ? { ticketId }
        : action === "next" || action === "skip"
          ? { expectedCurrentId: view?.current?.id ?? null }
          : action === "undo"
            ? { expectedActionId: view?.lastActionId ?? null }
            : {},
    });
    setBusy(false);
    if (res.ok) {
      setView(res.data);
      setError("");
      setUpdatedAt(new Date());
      setFailures(0);
      try {
        navigator.vibrate?.(30);
      } catch {
        // Ignorer.
      }
    } else handleError(res.status, res.message);
  }

  return (
    <main className="min-h-[100dvh] bg-paper pb-64" style={stationVars(me.color)}>
      <div className="mx-auto max-w-md px-5 pt-6">
        <div className="flex items-center justify-between">
          {/* Rullbar når det er mange stasjoner (v1.6). */}
          <nav
            className="flex max-w-[calc(100%-6rem)] gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1 [scrollbar-width:none]"
            aria-label="Velg stasjon"
          >
            {stations.map((s) => (
              <Link
                key={s.id}
                href={`/operator?station=${s.id}`}
                aria-current={s.id === station ? "page" : undefined}
                ref={s.id === station ? activeTab : undefined}
                title={stationLabel(s)}
                style={stationVars(s.color)}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                  s.id === station ? `${ST.solid} text-white` : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {s.id}
              </Link>
            ))}
          </nav>
          <LogoutButton />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Operator</p>
            <h1 className="mt-1 font-display text-2xl text-slate-900">{stationLabel(me)}</h1>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${ST.soft} ${ST.text}`}>
            <Users className="h-4 w-4" aria-hidden />
            {view?.waitingCount ?? "–"} venter
          </span>
        </div>

        {view && view.capacityLeft !== null && (
          <p className={`mt-2 text-right text-xs font-medium ${view.full ? "text-red-600" : "text-slate-600"}`} data-testid="capacity">
            {capacityText(view.full, view.capacityLeft, view.serviceEnd)}
          </p>
        )}
        {Boolean(view?.leftCount) && (
          <p className="mt-2 text-right text-xs text-slate-500" data-testid="left-count">
            {view!.leftCount === 1 ? "1 har gitt fra seg plassen" : `${view!.leftCount} har gitt fra seg plassen`}
          </p>
        )}
        <div className="mt-2 flex items-center justify-end gap-2 text-xs text-slate-400">
          <span aria-live="polite">
            {updatedAt
              ? `Oppdatert ${updatedAt.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Henter …"}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Oppdater nå"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Oppdater
          </button>
        </div>

        {failures >= 2 && (
          <p role="status" className="mt-3 rounded-2xl bg-amber-100 px-4 py-3 text-center text-sm font-medium text-amber-900">
            Mistet kontakten – prøver igjen. Tallene kan være utdaterte.
          </p>
        )}

        <div className="mt-6 rounded-[2rem] bg-white p-7 text-center shadow-[0_25px_60px_-50px_rgba(15,23,42,0.6)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Betjenes nå</p>
          <p className="mt-3 font-display text-6xl text-slate-900" aria-live="polite">
            {view?.current ? `${station}${view.current.number}` : "–"}
          </p>
          {view?.calledLeft && (
            <p role="status" className="mt-3 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900" data-testid="called-left">
              {station}
              {view.calledLeft.number} ga fra seg plassen.{" "}
              {view.waitingCount > 0 ? "Trykk NESTE for å kalle neste." : "Ingen venter."}
            </p>
          )}
          <p className={`mt-3 text-sm ${view?.active === false ? "font-medium text-red-600" : "text-slate-500"}`}>
            {view?.active === false
              ? `Stasjonen er satt til stengt${view.closedMessage ? ` – «${view.closedMessage}»` : ""}`
              : "Åpen for kø"}
          </p>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Neste i køen</p>
          {!view ? (
            <div className="mt-4 flex justify-center">
              <Spinner className="h-6 w-6 text-slate-300" />
            </div>
          ) : view.next.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Ingen venter akkurat nå.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {view.next.map((t, i) => (
                <li key={t.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="font-display text-xl text-slate-900">
                    {station}
                    {t.number}
                  </span>
                  <span className="text-xs uppercase tracking-wider text-slate-400">{i === 0 ? "Neste" : `${i + 1}. i kø`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {view && view.skipped.length > 0 && (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-amber-700">Hoppet over</p>
            <ul className="mt-4 space-y-2">
              {view.skipped.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-2">
                  <span className="font-display text-lg text-slate-900">
                    {station}
                    {t.number}
                  </span>
                  <button type="button" disabled={busy} onClick={() => act("requeue", t.id)} className={buttonClass("outline", "sm")}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Sett tilbake i kø
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div className="mx-auto max-w-md space-y-3">
          {error && (
            <p role="alert" className="text-center text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => act("next")}
            disabled={busy || !view}
            className={`flex h-24 w-full items-center justify-center rounded-3xl text-2xl font-semibold tracking-wide text-white transition active:scale-[0.98] disabled:opacity-60 ${ST.solid}`}
          >
            {busy ? <Spinner className="h-7 w-7 text-white" /> : "NESTE"}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => act("skip")}
              disabled={busy || !view?.current}
              className={`${buttonClass("outline", "lg")} rounded-xl`}
            >
              <SkipForward className="h-4 w-4" aria-hidden />
              Hopp over
            </button>
            <button
              type="button"
              onClick={() => act("undo")}
              disabled={busy || !view?.canUndo}
              className={`${buttonClass("outline", "lg")} rounded-xl`}
            >
              <Undo2 className="h-4 w-4" aria-hidden />
              Angre siste
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
