"use client";

import { DoorOpen, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";
import { api } from "@/lib/client-api";

// «Gi fra meg plassen» (v1.7). Bevisst en diskret lenke + bekreftelse, så ingen mister plassen ved et uhell.
// Vises bare når admin tillater det (standard på).

type Tone = "light" | "dark";

export function LeaveLink({
  ticketId,
  label,
  question,
  detail,
  tone = "light",
  onLeft,
}: {
  ticketId: string;
  /** Teksten på lenken, f.eks. «Gi fra meg plassen» / «Jeg kommer ikke – gi fra meg plassen». */
  label: string;
  /** Spørsmålet i bekreftelsen. */
  question: string;
  /** Ekstra linje i bekreftelsen (f.eks. antall foran og ventetid). */
  detail?: string;
  tone?: Tone;
  onLeft: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dark = tone === "dark";

  async function leave() {
    setBusy(true);
    setError("");
    const res = await api(`/api/tickets/${ticketId}/leave`, { method: "POST", json: {} });
    setBusy(false);
    if (res.ok) onLeft();
    else setError(res.message);
  }

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className={`mx-auto mt-6 flex items-center gap-1.5 text-sm underline underline-offset-4 ${dark ? "text-white/80 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
        data-testid="leave-link"
      >
        <DoorOpen className="h-4 w-4" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="leave-question"
      className={`mt-6 rounded-3xl p-5 text-left ${dark ? "bg-white/15 text-white" : "border border-slate-200 bg-white text-slate-800"}`}
      data-testid="leave-confirm"
    >
      <p id="leave-question" className="font-medium">
        {question}
      </p>
      {detail && <p className={`mt-1 text-sm ${dark ? "text-white/80" : "text-slate-600"}`}>{detail}</p>}
      <p className={`mt-1 text-sm ${dark ? "text-white/80" : "text-slate-600"}`}>
        Vil du komme tilbake senere, skanner du QR-koden igjen og får en ny kølapp.
      </p>
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={leave} className={buttonClass("danger", "md")}>
          {busy ? "Gir fra meg plassen …" : "Ja, gi fra meg plassen"}
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className={dark ? "inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-medium text-slate-900" : buttonClass("outline", "md")}
        >
          Behold plassen
        </button>
      </div>
    </div>
  );
}

/** Skjermen etter at gjesten har gitt fra seg plassen, med «Angre» de første sekundene. */
export function LeftView({
  ticketId,
  label,
  undoUntil,
  onRejoined,
}: {
  ticketId: string;
  label: string;
  /** Tidspunkt (ms) angre-knappen forsvinner. null = ingen angremulighet. */
  undoUntil: number | null;
  onRejoined: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const secondsLeft = undoUntil ? Math.max(0, Math.ceil((undoUntil - now) / 1000)) : 0;

  useEffect(() => {
    if (!undoUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [undoUntil]);

  async function undo() {
    setBusy(true);
    setError("");
    const res = await api(`/api/tickets/${ticketId}/leave`, { method: "DELETE", json: {} });
    setBusy(false);
    if (res.ok) onRejoined();
    else setError(res.message);
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-100 px-6 text-center text-slate-900" data-testid="ticket-left">
      <DoorOpen className="h-12 w-12 text-slate-500" aria-hidden />
      <p className="mt-6 font-display text-4xl">Du har gitt fra deg plassen</p>
      <p className="mt-4 max-w-sm text-lg text-slate-600">
        Takk! Da kommer de bak deg raskere fram. Vil du likevel stille deg i kø, skanner du QR-koden igjen.
      </p>
      <p className="mt-10 font-display text-7xl text-slate-300 line-through decoration-2">{label}</p>
      {secondsLeft > 0 && !error && (
        <button type="button" disabled={busy} onClick={undo} className={`${buttonClass("outline", "lg")} mt-10`} data-testid="leave-undo">
          <Undo2 className="h-5 w-5" aria-hidden />
          {busy ? "Tar plassen tilbake …" : `Angre – ta plassen tilbake (${secondsLeft} s)`}
        </button>
      )}
      {error && <p className="mt-8 max-w-sm text-sm text-slate-600">{error}</p>}
    </main>
  );
}
