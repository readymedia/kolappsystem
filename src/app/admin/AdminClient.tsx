"use client";

import { AlertTriangle, ArchiveRestore, Copy, Palette, Plus, Eraser, Info, KeyRound, Monitor, Pencil, Power, Printer, RotateCcw, UserCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { usePolling } from "@/components/hooks";
import { useBranding } from "@/components/BrandingContext";
import { AudioCard } from "./AudioCard";
import { DisplayCard } from "./DisplayCard";
import { PushCard } from "./PushCard";
import { QueueCard } from "./QueueCard";
import { LogoutButton } from "@/components/LogoutButton";
import { buttonClass, Card, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { NEW_PIN_PATTERN, type StationId } from "@/lib/config";
import { MAX_ACTIVE_STATIONS, ST, stationLabel, stationVars } from "@/lib/stations";
import { StationSettings } from "./StationSettings";

// Admin: utskriftsvennlige QR-koder, nullstill kø, aktiver/deaktiver, bytt nøkkel, rediger beskrivelse og bytt PIN.

export interface AdminStation {
  id: StationId;
  name: string;
  color: string;
  description: string;
  active: boolean;
  closedMessage: string;
  waitingCount: number;
  leftCount: number;
  issued: number;
  joinUrl: string;
  qrSvg: string;
}

export function AdminClient({ version, commit }: { version: string; commit: string }) {
  const router = useRouter();
  const [stations, setStations] = useState<AdminStation[] | null>(null);
  const [archived, setArchived] = useState<{ id: string; name: string; color: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [pinIsDefault, setPinIsDefault] = useState(false);
  const [error, setError] = useState("");
  // Stabil referanse: kortene henter innstillinger i en effekt som ellers ville kjørt på nytt ved hver
  // oppdatering (og overskrevet det admin holder på å skrive).
  const onUnauthorized = useCallback(() => router.refresh(), [router]);

  const load = useCallback(async () => {
    const res = await api<{ stations: AdminStation[]; archived: { id: string; name: string; color: string }[]; pinIsDefault: boolean }>(
      "/api/admin/stations",
    );
    if (res.ok) {
      setStations(res.data.stations);
      setArchived(res.data.archived ?? []);
      setPinIsDefault(res.data.pinIsDefault);
      setError("");
    } else if (res.status === 401) router.refresh();
    else setError(res.message);
  }, [router]);

  // Henter på nytt hvert 15. sekund så tallene for ventende holder seg ferske.
  usePolling(load, 15_000);

  async function stationAction(id: StationId, action: string, json?: unknown) {
    const res = await api<{ ok: true; removed?: number }>(`/api/admin/stations/${id}/${action}`, {
      method: "POST",
      json: json ?? {},
    });
    if (!res.ok) {
      if (res.status === 401) router.refresh();
      else setError(res.message);
      return null;
    }
    await load();
    return res.data;
  }

  async function createStation() {
    setCreating(true);
    const res = await api<{ ok: true; id: string }>("/api/admin/stations", { method: "POST", json: {} });
    setCreating(false);
    if (!res.ok) {
      if (res.status === 401) router.refresh();
      else setError(res.message);
      return;
    }
    setError("");
    await load();
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
          <div className="flex flex-wrap gap-2">
            <LogoutButton />
            <Link href="/admin/utseende" className={buttonClass("outline", "md")}>
              <Palette className="h-4 w-4" aria-hidden />
              Utseende
            </Link>
            <button type="button" onClick={() => window.print()} className={buttonClass("primary", "md")}>
              <Printer className="h-4 w-4" aria-hidden />
              Skriv ut
            </button>
          </div>
        </div>

        {pinIsDefault && (
          <p role="alert" className="mt-6 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Du bruker fortsatt standard-PIN 1234. Bytt den nederst på siden før arrangementet (minst 6 sifre).
          </p>
        )}

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
          <>
            <div className="mt-10 grid gap-6 md:grid-cols-3 print:block">
              {stations.map((s, i) => (
                <StationCard
                  key={s.id}
                  station={s}
                  onAction={stationAction}
                  isFirst={i === 0}
                  isLast={i === stations.length - 1}
                />
              ))}
              <button
                type="button"
                onClick={createStation}
                disabled={creating || stations.length >= MAX_ACTIVE_STATIONS}
                className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[2rem] border-2 border-dashed border-slate-300 p-6 text-slate-600 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 print:hidden"
              >
                <Plus className="h-6 w-6" aria-hidden />
                <span className="font-medium">{creating ? "Oppretter …" : "Ny stasjon"}</span>
                <span className="text-xs text-slate-500">
                  {stations.length >= MAX_ACTIVE_STATIONS
                    ? `Maks ${MAX_ACTIVE_STATIONS} stasjoner. Arkiver en for å lage ny.`
                    : `${stations.length} av ${MAX_ACTIVE_STATIONS} i bruk`}
                </span>
              </button>
            </div>
            {archived.length > 0 && (
              <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
                <summary className="cursor-pointer text-sm font-medium text-slate-800">Arkiverte stasjoner ({archived.length})</summary>
                <ul className="mt-3 space-y-2">
                  {archived.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 text-sm" style={stationVars(a.color)}>
                      <span className={`h-3 w-3 rounded-full ${ST.dot}`} aria-hidden />
                      <span className="flex-1 text-slate-700">{stationLabel(a)}</span>
                      <button
                        type="button"
                        className={buttonClass("outline", "sm")}
                        disabled={stations.length >= MAX_ACTIVE_STATIONS}
                        onClick={() => stationAction(a.id, "restore")}
                      >
                        <ArchiveRestore className="h-4 w-4" aria-hidden />
                        Gjenopprett
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-slate-500">Gjenopprettet stasjon får tom kø og ny QR-kode (skriv ut på nytt).</p>
              </details>
            )}
          </>
        )}

        <DisplayCard stations={stations} onUnauthorized={onUnauthorized} />

        <AudioCard onUnauthorized={onUnauthorized} />

        <QueueCard onUnauthorized={onUnauthorized} />

        <PushCard onUnauthorized={onUnauthorized} />

        <div className="mt-10 grid gap-6 md:grid-cols-2 print:hidden">
          <PinCard onUnauthorized={onUnauthorized} />
          <AboutCard version={version} commit={commit} />
        </div>
      </div>
    </main>
  );
}

function StationCard({
  station: s,
  onAction,
  isFirst,
  isLast,
}: {
  station: AdminStation;
  isFirst: boolean;
  isLast: boolean;
  onAction: (id: StationId, action: string, json?: unknown) => Promise<{ ok: true; removed?: number } | null>;
}) {
  const [confirm, setConfirm] = useState<"reset" | "rotate-key" | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(s.description);
  const [copied, setCopied] = useState(false);
  const [cleanup, setCleanup] = useState<{ from: string; to: string; result: string } | null>(null);
  // Stenging: skjema med valgfri melding til publikum. null = skjult.
  const [closing, setClosing] = useState<string | null>(null);
  const [closedMsg, setClosedMsg] = useState(s.closedMessage);
  const [msgSaved, setMsgSaved] = useState(false);

  async function run(action: string, json?: unknown) {
    setBusy(true);
    const res = await onAction(s.id, action, json);
    setBusy(false);
    setConfirm(null);
    return res;
  }

  return (
    <Card
      className={`print-page p-6 ${ST.border} print:mx-auto print:max-w-lg print:border-0 print:p-0 print:pt-16 print:text-center`}
      style={stationVars(s.color)}
    >
      <PrintBrand />
      <div className="flex items-center justify-between print:block">
        <h2 className="flex items-center gap-2 font-display text-2xl text-slate-900 print:block print:text-7xl">
          <span className={`h-3 w-3 shrink-0 rounded-full ${ST.dot} print:hidden`} aria-hidden />
          {stationLabel(s)}
          {s.name.trim() && (
            <span className="rounded-md bg-slate-100 px-1.5 text-sm font-medium text-slate-500 print:hidden" title={`Kode ${s.id} – står på lappene`} aria-hidden>
              {s.id}
            </span>
          )}
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium print:hidden ${s.active ? `${ST.soft} ${ST.text}` : "bg-slate-100 text-slate-500"}`}
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
          {s.leftCount > 0 && ` · ${s.leftCount} ga fra seg plassen`}
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
            onClick={() => (s.active ? setClosing(closing === null ? s.closedMessage : null) : run("activate"))}
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
        {s.active && closing !== null && (
          <form
            className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run("deactivate", { message: closing })) {
                setClosedMsg(closing.trim());
                setClosing(null);
              }
            }}
          >
            <label className="block text-sm font-medium text-slate-800">
              Melding til publikum <span className="font-normal text-slate-500">(valgfri, maks 80 tegn)</span>
              <input
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
                maxLength={80}
                placeholder="F.eks. «Tilbake kl. 14.00»"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal"
              />
            </label>
            <p className="text-xs text-slate-500">Vises på storskjermen, ved skann og på kølappene. De som står i kø beholder plassen.</p>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={buttonClass("danger", "sm")}>
                Steng stasjonen
              </button>
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setClosing(null)}>
                Avbryt
              </button>
            </div>
          </form>
        )}
        {!s.active && (
          <form
            className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run("closed-message", { message: closedMsg })) {
                setMsgSaved(true);
                setTimeout(() => setMsgSaved(false), 2000);
              }
            }}
          >
            <label className="block text-sm font-medium text-slate-800">
              Melding mens stengt
              <input
                value={closedMsg}
                onChange={(e) => setClosedMsg(e.target.value)}
                maxLength={80}
                placeholder="Ingen melding"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal"
              />
            </label>
            <button type="submit" disabled={busy || closedMsg === s.closedMessage} className={buttonClass("outline", "sm")}>
              {msgSaved ? "Lagret" : "Lagre melding"}
            </button>
          </form>
        )}
        {cleanup ? (
          <form
            className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await run("remove-waiting", { from: Number(cleanup.from), to: Number(cleanup.to) });
              if (res) setCleanup({ ...cleanup, result: `Fjernet ${res.removed ?? 0} ventende lapper.` });
            }}
          >
            <p className="text-sm font-medium text-slate-800">Fjern ventende lapper</p>
            <p className="text-xs text-slate-500">
              For falske lapper (f.eks. hvis QR-koden er delt på nett). Bare ventende lapper i området fjernes.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-1">
                Fra {s.id}
                <input
                  value={cleanup.from}
                  onChange={(e) => setCleanup({ ...cleanup, from: e.target.value.replace(/\D/g, ""), result: "" })}
                  inputMode="numeric"
                  className="h-9 w-16 rounded-lg border border-slate-200 px-2"
                  aria-label="Fra nummer"
                />
              </label>
              <label className="flex items-center gap-1">
                til {s.id}
                <input
                  value={cleanup.to}
                  onChange={(e) => setCleanup({ ...cleanup, to: e.target.value.replace(/\D/g, ""), result: "" })}
                  inputMode="numeric"
                  className="h-9 w-16 rounded-lg border border-slate-200 px-2"
                  aria-label="Til nummer"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !cleanup.from || !cleanup.to} className={buttonClass("danger", "sm")}>
                Fjern
              </button>
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setCleanup(null)}>
                Lukk
              </button>
            </div>
            {cleanup.result && <p className="text-sm text-emerald-700">{cleanup.result}</p>}
          </form>
        ) : (
          <button
            type="button"
            className={`${buttonClass("ghost", "sm")} mt-2`}
            onClick={() => setCleanup({ from: "", to: "", result: "" })}
          >
            <Eraser className="h-4 w-4" aria-hidden />
            Fjern ventende lapper …
          </button>
        )}
        <StationSettings
          id={s.id}
          name={s.name}
          color={s.color}
          isFirst={isFirst}
          isLast={isLast}
          waitingCount={s.waitingCount}
          onAction={(action, json) => onAction(s.id, action, json)}
        />
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
    if (!NEW_PIN_PATTERN.test(pin)) {
      setMessage({ ok: false, text: "PIN må være 6–12 sifre." });
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
    <Card className="p-6">
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

/** «Om appen» – vises bare i /admin, aldri for publikum. */
function AboutCard({ version, commit }: { version: string; commit: string }) {
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 font-display text-lg text-slate-900">
        <Info className="h-4 w-4 text-slate-400" aria-hidden />
        Om appen
      </h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">App</dt>
        <dd className="text-slate-800">KøKlar – kølappsystem for meet-and-greet</dd>
        <dt className="text-slate-500">Versjon</dt>
        <dd className="text-slate-800">
          {version} <span className="text-slate-400">· {commit}</span>
        </dd>
        <dt className="text-slate-500">Utvikler</dt>
        <dd className="text-slate-800">
          Andreas Aarlott ·{" "}
          <a href="mailto:andreas.aarlott@ntnu.no" className="text-sky-700 underline-offset-2 hover:underline">
            andreas.aarlott@ntnu.no
          </a>
        </dd>
        <dt className="text-slate-500">Utvikling</dt>
        <dd className="text-slate-800">AI-støttet utvikling</dd>
      </dl>
    </Card>
  );
}

/** Logo og arrangementsnavn øverst på hver utskrevne QR-side (v1.4). Vises bare ved utskrift. */
function PrintBrand() {
  const { logoUrl, eventName } = useBranding();
  if (!logoUrl && !eventName) return null;
  return (
    <div className="hidden print:mb-10 print:block">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- egen fil fra /api/media
        <img src={logoUrl} alt="" className="mx-auto h-24 w-auto max-w-[12cm] object-contain" />
      )}
      {eventName && <p className="mt-4 text-xl uppercase tracking-[0.3em] text-slate-500">{eventName}</p>}
    </div>
  );
}
