"use client";

import { BarChart3, Download, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { buttonClass, Card } from "@/components/ui";
import { api } from "@/lib/client-api";
import type { StationStats } from "@/lib/queue";

// Admin (v1.8): «Rapport» per stasjon (nå + tidligere runder, CSV) og «Nullstill alle køer».
// Rapporten er bare tall og tider – ingen persondata. Sammendrag lagres automatisk før hver nullstilling.

type Report = { current: StationStats[]; history: StationStats[] };

const minutes = (s: number | null) => (s === null ? "–" : `${Math.round(s / 60)} min`);
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("nb-NO", { timeZone: "Europe/Oslo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–";

export function ReportCard({ onUnauthorized, refreshKey }: { onUnauthorized: () => void; refreshKey: number }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await api<Report>("/api/admin/report");
    if (r.ok) setReport(r.data);
    else if (r.status === 401) onUnauthorized();
    else setError(r.message);
  }, [onUnauthorized]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load, refreshKey]);

  return (
    <Card className="mt-10 p-6 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <BarChart3 className="h-5 w-5 text-slate-400" aria-hidden />
        <h2 className="flex-1 font-display text-xl text-slate-900">Rapport</h2>
        <button type="button" className={buttonClass("ghost", "sm")} onClick={() => void load()}>
          Oppdater
        </button>
        <a href="/api/admin/report?format=csv" className={buttonClass("outline", "sm")} download>
          <Download className="h-4 w-4" aria-hidden />
          Last ned CSV
        </a>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Siden siste nullstilling per stasjon. Et sammendrag lagres automatisk hver gang en kø nullstilles («Tidligere runder»). Bare tall –
        ingen persondata.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {report && (
        <>
          <StatsTable rows={report.current} caption="Nå" />
          {report.history.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">Tidligere runder ({report.history.length})</summary>
              <StatsTable rows={report.history} caption="Tidligere runder" showEnded />
            </details>
          )}
        </>
      )}
    </Card>
  );
}

function StatsTable({ rows, caption, showEnded = false }: { rows: StationStats[]; caption: string; showEnded?: boolean }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm" data-testid={showEnded ? "report-history" : "report-current"}>
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">Stasjon</th>
            {showEnded && <th className="py-2 pr-3 font-medium">Nullstilt</th>}
            <th className="py-2 pr-3 text-right font-medium">Delt ut</th>
            <th className="py-2 pr-3 text-right font-medium">Betjent</th>
            <th className="py-2 pr-3 text-right font-medium">Hoppet over</th>
            <th className="py-2 pr-3 text-right font-medium">Ga fra seg</th>
            <th className="py-2 pr-3 text-right font-medium">Venter</th>
            <th className="py-2 pr-3 text-right font-medium">Snitt ventetid</th>
            <th className="py-2 pr-3 text-right font-medium">Lengste</th>
            <th className="py-2 pr-3 text-right font-medium">Tempo</th>
            <th className="py-2 font-medium">Travleste time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-800">
          {rows.map((s, i) => (
            <tr key={`${s.station}-${s.endedAt ?? "now"}-${i}`}>
              <td className="py-2 pr-3 font-medium">{s.label}</td>
              {showEnded && <td className="py-2 pr-3">{when(s.endedAt)}</td>}
              <td className="py-2 pr-3 text-right tabular-nums">{s.issued}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{s.served}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{s.skipped}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{s.left}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{s.waiting}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{minutes(s.avgWaitSeconds)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{minutes(s.maxWaitSeconds)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {s.minutesPerPerson === null ? "–" : `${String(s.minutesPerPerson).replace(".", ",")} min/person`}
              </td>
              <td className="py-2">{s.busiestHour ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** «Nullstill alle køer …» med bekreftelse som viser hvor mange som mister lappen. */
export function ResetAllButton({ waitingTotal, onDone, onError }: { waitingTotal: number; onDone: () => void; onError: (msg: string) => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    const r = await api("/api/admin/reset-all", { method: "POST", json: {} });
    setBusy(false);
    setConfirm(false);
    if (r.ok) onDone();
    else onError(r.message);
  }

  if (!confirm) {
    return (
      <button type="button" className={buttonClass("outline", "sm")} onClick={() => setConfirm(true)}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        Nullstill alle køer …
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-900" role="alertdialog" aria-label="Nullstill alle køer">
      <span>
        {waitingTotal === 0
          ? "Ingen venter. Alle køer starter på 1 igjen."
          : `${waitingTotal} venter totalt – de mister lappene sine. Alle køer starter på 1 igjen.`}
      </span>
      <button type="button" disabled={busy} className={buttonClass("danger", "sm")} onClick={() => void reset()}>
        {busy ? "Nullstiller …" : "Bekreft – tøm alle køer"}
      </button>
      <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setConfirm(false)}>
        Avbryt
      </button>
    </div>
  );
}
