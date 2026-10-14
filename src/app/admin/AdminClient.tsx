"use client";

import { Copy, KeyRound, Monitor, Pencil, Power, Printer, RotateCcw, UserCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { usePolling } from "@/components/hooks";
import { LogoutButton } from "@/components/LogoutButton";
import { buttonClass, Card, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { PIN_PATTERN, STATION_THEME, type StationId } from "@/lib/config";

// Admin: utskriftsvennlige QR-koder, nullstill kø, aktiver/deaktiver, bytt nøkkel, rediger beskrivelse og bytt PIN.

interface AdminStation {
  id: StationId;
  description: string;
  active: boolean;
  waitingCount: number;
  issued: number;
  joinUrl: string;
  qrSvg: string;
}

export function AdminClient() {
  const router = useRouter();
  const [stations, setStations] = useState<AdminStation[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await api<{ stations: AdminStation[] }>("/api/admin/stations");
    if (res.ok) {
      setStations(res.data.stations);
      setError("");
    } else if (res.status === 401) router.refresh();
    else setError(res.message);
  }, [router]);

  // Henter på nytt hvert 15. sekund så tallene for ventende holder seg ferske.
  usePolling(load, 15_000);

  async function stationAction(id: StationId, action: string, json?: unknown) {
    const res = await api(`/api/admin/stations/${id}/${action}`, { method: "POST", json: json ?? {} });
    if (!res.ok) {
      if (res.status === 401) router.refresh();
      else setError(res.message);
      return false;
    }
    await load();
    return true;
  }

  return (
    <main className="min-h-[100dvh] bg-paper pb-20 print:bg-white print:pb-0">
      <div className="mx-auto max-w-5xl px-6 pt-10 print:max-w-none print:px-0 print:pt-0">
        <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Admin</p>
            <h1 className="mt-2 font-display text-3xl text-slate-900">Stasjoner og QR-koder</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Skriv ut QR-kodene og heng dem opp. Hver kode inneholder stasjonens hemmelige nøkkel – del den ikke på nett.
            </p>
          </div>
          <div className="flex gap-2">
            <LogoutButton />
            <button type="button" onClick={() => window.print()} className={buttonClass("primary", "md")}>
              <Printer className="h-4 w-4" aria-hidden />
              Skriv ut
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
            {error}
          </p>
        )}

        {!stations ? (
          <div className="mt-16 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-3 print:block">
            {stations.map((s) => (
              <StationCard key={s.id} station={s} onAction={stationAction} />
            ))}
          </div>
        )}

        <PinCard onUnauthorized={() => router.refresh()} />
      </div>
    </main>
  );
}

function StationCard({
  station: s,
  onAction,
}: {
  station: AdminStation;
  onAction: (id: StationId, action: string, json?: unknown) => Promise<boolean>;
}) {
  const t = STATION_THEME[s.id];
  const [confirm, setConfirm] = useState<"reset" | "rotate-key" | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(s.description);
  const [copied, setCopied] = useState(false);

  async function run(action: string, json?: unknown) {
    setBusy(true);
    await onAction(s.id, action, json);
    setBusy(false);
    setConfirm(null);
  }

  return (
    <Card className={`print-page p-6 ${t.border} print:mx-auto print:max-w-lg print:border-0 print:p-0 print:pt-16 print:text-center`}>
      <div className="flex items-center justify-between print:block">
        <h2 className="font-display text-2xl text-slate-900 print:text-7xl">Stasjon {s.id}</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium print:hidden ${s.active ? `${t.soft} ${t.text}` : "bg-slate-100 text-slate-500"}`}
        >
          {s.active ? "Aktiv" : "Stengt"}
        </span>
      </div>
      <p className="mt-2 hidden text-2xl text-slate-700 print:block">{s.description}</p>

      <div
        className="mx-auto mt-5 w-56 rounded-2xl bg-white print:mt-12 print:w-[12cm]"
        role="img"
        aria-label={`QR-kode for stasjon ${s.id}`}
        // SVG lages på serveren av qrcode-biblioteket fra vår egen URL – trygt innhold.
        dangerouslySetInnerHTML={{ __html: s.qrSvg }}
      />
      <p className="mt-6 hidden text-2xl font-medium text-slate-900 print:block">Skann for å få kølapp</p>

      <div className="print:hidden">
        <p className="mt-3 break-all text-center text-[11px] leading-relaxed text-slate-400">{s.joinUrl}</p>
        <button
          type="button"
          className={`${buttonClass("ghost", "sm")} mx-auto mt-1 flex`}
          onClick={async () => {
            await navigator.clipboard?.writeText(s.joinUrl).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Copy className="h-4 w-4" aria-hidden />
          {copied ? "Kopiert" : "Kopier lenke"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          {s.waitingCount} venter · {s.issued} lapper delt ut
        </p>

        <div className="mt-4">
          {editing ? (
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await run("description", { description: desc });
                setEditing(false);
              }}
            >
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                maxLength={300}
                rows={3}
                aria-label="Hvem man møter"
                className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className={buttonClass("primary", "sm")}>
                  Lagre
                </button>
                <button
                  type="button"
                  className={buttonClass("ghost", "sm")}
                  onClick={() => {
                    setDesc(s.description);
                    setEditing(false);
                  }}
                >
                  Avbryt
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
              <p className="flex-1 text-sm text-slate-700">{s.description || "Ingen beskrivelse"}</p>
              <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setEditing(true)} aria-label="Rediger beskrivelse">
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className={buttonClass(confirm === "reset" ? "danger" : "outline", "sm")}
            onClick={() => (confirm === "reset" ? run("reset") : setConfirm("reset"))}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {confirm === "reset" ? "Bekreft nullstilling" : "Nullstill kø"}
          </button>
          <button
            type="button"
            disabled={busy}
            className={buttonClass("outline", "sm")}
            onClick={() => run(s.active ? "deactivate" : "activate")}
          >
            <Power className="h-4 w-4" aria-hidden />
            {s.active ? "Deaktiver" : "Aktiver"}
          </button>
          <button
            type="button"
            disabled={busy}
            className={buttonClass(confirm === "rotate-key" ? "danger" : "outline", "sm")}
            onClick={() => (confirm === "rotate-key" ? run("rotate-key") : setConfirm("rotate-key"))}
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            {confirm === "rotate-key" ? "Bekreft – gamle QR slutter å virke" : "Bytt nøkkel"}
          </button>
          {confirm && (
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setConfirm(null)}>
              Avbryt
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 pt-1">
          <Link href={`/operator?station=${s.id}`} className={buttonClass("ghost", "sm")}>
            <UserCog className="h-4 w-4" aria-hidden />
            Operator
          </Link>
          <Link href="/display" className={buttonClass("ghost", "sm")}>
            <Monitor className="h-4 w-4" aria-hidden />
            Storskjerm
          </Link>
        </div>
      </div>
    </Card>
  );
}

function PinCard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!PIN_PATTERN.test(pin)) {
      setMessage({ ok: false, text: "PIN må være 4–12 sifre." });
      return;
    }
    setBusy(true);
    const res = await api("/api/admin/pin", { method: "PUT", json: { pin } });
    setBusy(false);
    if (res.ok) {
      setPin("");
      setMessage({ ok: true, text: "PIN-koden er lagret. Alle andre er logget ut." });
      setTimeout(() => setMessage(null), 4000);
    } else if (res.status === 401) onUnauthorized();
    else setMessage({ ok: false, text: res.message });
  }

  return (
    <Card className="mt-10 max-w-md p-6 print:hidden">
      <h2 className="font-display text-lg text-slate-900">PIN-kode</h2>
      <p className="mt-1 text-sm text-slate-500">Felles for operator og admin. Ny PIN logger ut alle andre enheter.</p>
      <form onSubmit={save} className="mt-4 flex gap-3">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={12}
          placeholder="Ny PIN"
          aria-label="Ny PIN-kode"
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-base outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button type="submit" disabled={busy} className={buttonClass("primary", "md")}>
          Lagre
        </button>
      </form>
      {message && <p className={`mt-3 text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>}
    </Card>
  );
}
