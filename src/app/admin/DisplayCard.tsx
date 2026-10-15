"use client";

import { AlertTriangle, Copy, ExternalLink, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { useBranding } from "@/components/BrandingContext";
import { DisplayBoard } from "@/components/DisplayBoard";
import { ScaledPreview } from "@/components/ScaledPreview";
import { usePolling } from "@/components/hooks";
import { buttonClass, Card } from "@/components/ui";
import { api } from "@/lib/client-api";
import { POLL_INTERVAL_MS, type StationId } from "@/lib/config";
import { stationLabel } from "@/lib/stations";
import {
  buildDisplayQuery,
  DEFAULT_DISPLAY_OPTIONS,
  type DisplayOptions,
  type DisplaySize,
} from "@/lib/display-options";
import type { PublicState } from "@/lib/public-state";
import type { AdminStation } from "./AdminClient";

// Admin «Skjermer»: overskrift på storskjermen og lenkebygger for /display med forhåndsvisning.
// Forhåndsvisningen er en komponent (ikke iframe), så frame-ancestors 'none' kan beholdes.

const QR_WARNING =
  "⚠️ QR-koden på storskjermen kan fotograferes og deles. Alle som har bildet kan ta kølapp uten å være på stedet, og også skjermlenken gir tilgang til QR-koden. Vern som er aktivt: maks 100 ventende per nettverk, «Bytt nøkkel» (gjør både QR og skjermlenke ugyldig) og «Fjern ventende lapper». Vurdert som akseptabelt nå. Slå av hvis misbruk oppstår.";

const SIZES: { value: DisplaySize; label: string }[] = [
  { value: "s", label: "Liten" },
  { value: "m", label: "Normal" },
  { value: "l", label: "Stor" },
  { value: "xl", label: "Ekstra stor" },
];

const TOGGLES: { key: "title" | "desc" | "header" | "clock" | "sound" | "qr"; label: string }[] = [
  { key: "title", label: "Stasjonsnavn" },
  { key: "desc", label: "Beskrivelse" },
  { key: "header", label: "Overskrift" },
  { key: "clock", label: "Klokke" },
  { key: "sound", label: "Lydsignal" },
  { key: "qr", label: "QR-kode for kølapp" },
];

export function DisplayCard({ stations, onUnauthorized }: { stations: AdminStation[] | null; onUnauthorized: () => void }) {
  // Aktive stasjoner i admin-rekkefølge (v1.6).
  const allIds = stations?.map((s) => s.id) ?? [];
  const idsKey = allIds.join(",");
  // Storskjermbakgrunnen fra «Utseende» er standard; lenken får bare «theme=» når den avviker.
  const brand = useBranding();
  const siteTheme = brand.displayBackground;
  const defaults: DisplayOptions = { ...DEFAULT_DISPLAY_OPTIONS, theme: siteTheme };
  const [opts, setOpts] = useState<DisplayOptions>(defaults);
  const [title, setTitle] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [titleMsg, setTitleMsg] = useState("");
  const [state, setState] = useState<PublicState | null>(null);
  // Tokens gjelder bare for den nøkkel-/utvalgskombinasjonen de ble hentet for (sig), så en gammel
  // (ugyldig) lenke aldri vises etter «Bytt nøkkel».
  const [tokenState, setTokenState] = useState<{ sig: string; map: Record<string, string>; failed: boolean }>({
    sig: "",
    map: {},
    failed: false,
  });
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
    void api<{ displayTitle: string }>("/api/admin/config").then((r) => {
      if (r.ok) {
        setTitle(r.data.displayTitle);
        setSavedTitle(r.data.displayTitle);
      } else if (r.status === 401) onUnauthorized();
    });
  }, [onUnauthorized]);

  // Ekte data i forhåndsvisningen.
  usePolling(async () => {
    const res = await api<PublicState>("/api/state", { cache: "default" });
    if (res.ok) setState(res.data);
  }, POLL_INTERVAL_MS);

  // Signerte tokens for QR (valgt utvalg + hver stasjon alene). Hentes på nytt når en nøkkel byttes.
  const keySig = stations?.map((s) => s.joinUrl).join("|") ?? "";
  const selKey = opts.stations?.join(",") ?? "";
  const sig = `${keySig}#${selKey}#${retry}`;
  useEffect(() => {
    if (!opts.qr) return;
    let cancelled = false;
    const sets = [selKey, ...idsKey.split(",").filter(Boolean)];
    void Promise.all(
      sets.map(async (set) => {
        const r = await api<{ token: string }>(`/api/admin/display-token?station=${set}`);
        if (!r.ok && r.status === 401) onUnauthorized();
        return [set, r.ok ? r.data.token : ""] as const;
      }),
    ).then((pairs) => {
      if (cancelled) return;
      const map = Object.fromEntries(pairs.filter(([, t]) => t));
      setTokenState({ sig, map, failed: pairs.some(([, t]) => !t) });
    });
    return () => {
      cancelled = true;
    };
  }, [opts.qr, selKey, sig, idsKey, onUnauthorized]);
  const tokens = tokenState.sig === sig ? tokenState.map : {};
  const tokenFailed = opts.qr && tokenState.sig === sig && tokenState.failed;

  const linkFor = (stationsSel: StationId[] | null) => {
    const key = stationsSel?.join(",") ?? "";
    const o: DisplayOptions = { ...opts, stations: stationsSel, token: opts.qr ? (tokens[key] ?? null) : null };
    return `${origin}/display${buildDisplayQuery(o, siteTheme)}`;
  };
  const mainLink = linkFor(opts.stations);
  const qrPending = opts.qr && !tokens[selKey];

  async function copy(text: string, id: string) {
    await navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function saveTitle(e: React.FormEvent) {
    e.preventDefault();
    const r = await api<{ displayTitle: string }>("/api/admin/config", { method: "PUT", json: { displayTitle: title ?? "" } });
    if (r.ok) {
      setSavedTitle(r.data.displayTitle);
      setTitle(r.data.displayTitle);
      setTitleMsg("Lagret. Storskjermene oppdateres innen 20 sekunder.");
    } else if (r.status === 401) onUnauthorized();
    else setTitleMsg(r.message);
  }

  function toggleStation(id: StationId) {
    const cur = opts.stations ?? [];
    const picked = cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id];
    const next = allIds.filter((s) => picked.includes(s)); // admin-rekkefølge
    setOpts({ ...opts, stations: next.length && next.length < allIds.length ? next : null });
  }

  return (
    <Card className="mt-10 p-6 print:hidden" >
      <div className="flex items-center gap-2">
        <Monitor className="h-5 w-5 text-slate-400" aria-hidden />
        <h2 className="font-display text-xl text-slate-900">Skjermer</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Lag lenker til storskjermer: én skjerm med alle stasjoner, eller én skjerm per stasjon. Uten valg ser storskjermen ut som før.
      </p>

      <form onSubmit={saveTitle} className="mt-5 flex flex-wrap items-end gap-2">
        <label className="min-w-64 flex-1 text-sm font-medium text-slate-800">
          Overskrift på storskjerm
          <input
            value={title ?? ""}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleMsg("");
            }}
            maxLength={80}
            placeholder="Tom = ingen overskrift"
            disabled={title === null}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal"
          />
        </label>
        <button type="submit" disabled={title === null || title === savedTitle} className={buttonClass("outline", "md")}>
          Lagre overskrift
        </button>
        {brand.eventName && title !== null && title !== `${brand.eventName} · Køstatus` && (
          <button type="button" className={buttonClass("ghost", "md")} onClick={() => setTitle(`${brand.eventName} · Køstatus`)}>
            Bruk arrangementsnavnet
          </button>
        )}
        {titleMsg && <p className="w-full text-sm text-slate-600">{titleMsg}</p>}
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <fieldset className="space-y-4 text-sm">
          <legend className="sr-only">Skjermvalg</legend>
          <div>
            <p className="font-medium text-slate-800">Stasjoner</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {allIds.map((id) => (
                <label key={id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={opts.stations === null || opts.stations.includes(id)}
                    onChange={() => (opts.stations === null ? setOpts({ ...opts, stations: allIds.filter((s) => s !== id) }) : toggleStation(id))}
                  />
                  {id}
                </label>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="font-medium text-slate-800">Størrelse på nummeret</span>
            <select
              value={opts.size}
              onChange={(e) => setOpts({ ...opts, size: e.target.value as DisplaySize })}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2"
            >
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-slate-800">Antall i «Neste»</span>
            <select
              value={opts.next}
              onChange={(e) => setOpts({ ...opts, next: Number(e.target.value) })}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "Skjul" : n}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="font-medium text-slate-800">Vis</p>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {TOGGLES.map((t) => (
                <label key={t.key} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={opts[t.key]} onChange={(e) => setOpts({ ...opts, [t.key]: e.target.checked })} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium text-slate-800">Bakgrunn</p>
            <div className="mt-1 flex gap-4">
              {(["dark", "light"] as const).map((th) => (
                <label key={th} className="flex items-center gap-1.5">
                  <input type="radio" name="display-theme" checked={opts.theme === th} onChange={() => setOpts({ ...opts, theme: th })} />
                  {th === "dark" ? "Mørk" : "Lys"}
                </label>
              ))}
            </div>
          </div>
          <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setOpts(defaults)}>
            Tilbakestill valg
          </button>
        </fieldset>

        <div className="min-w-0">
          <ScaledPreview className="bg-black" label="Forhåndsvisning av storskjerm">
            <DisplayBoard
              logoUrl={brand.logoUrl}
              state={state}
              options={opts}
              title={savedTitle}
              qr={opts.qr ? Object.fromEntries(allIds.map((id) => [id, EXAMPLE_QR])) : null}
              wide
              className="h-[900px]"
            />
          </ScaledPreview>
          <p className="mt-1 text-xs text-slate-400">Forhåndsvisning med ekte køtall{opts.qr ? " (QR-koden er et eksempel)" : ""}.</p>
        </div>
      </div>

      {opts.qr && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="qr-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{QR_WARNING.replace(/^⚠️\s*/, "")}</span>
        </p>
      )}
      {opts.sound && (
        <p className="mt-3 text-sm text-slate-500">Lydsignal krever ett klikk på skjermen etter at den er åpnet. Se Lydsignal nedenfor.</p>
      )}

      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Skjermlenke</p>
        <p className="mt-2 break-all font-mono text-sm text-slate-800" data-testid="display-link">
          {qrPending ? (tokenFailed ? "Kunne ikke lage signert lenke." : "Lager signert lenke …") : mainLink}
        </p>
        {tokenFailed && (
          <button type="button" className={`${buttonClass("ghost", "sm")} mt-1`} onClick={() => setRetry((n) => n + 1)}>
            Prøv igjen
          </button>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={qrPending} className={buttonClass("primary", "sm")} onClick={() => copy(mainLink, "main")}>
            <Copy className="h-4 w-4" aria-hidden />
            {copied === "main" ? "Kopiert" : "Kopier lenke"}
          </button>
          <OpenLink href={qrPending ? null : mainLink} className={buttonClass("outline", "sm")}>
            <ExternalLink className="h-4 w-4" aria-hidden />
            Åpne i nytt vindu
          </OpenLink>
        </div>
      </div>

      <details className="mt-4 rounded-2xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">Én skjerm per stasjon</summary>
        <p className="mt-2 text-xs text-slate-500">Samme valg som over, én lenke per stasjon – for stativ med én skjerm per stasjon.</p>
        <ul className="mt-3 space-y-2">
          {(stations ?? []).map(({ id, name }) => {
            const link = linkFor([id]);
            const pending = opts.qr && !tokens[id];
            return (
              <li key={id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-28 truncate font-medium text-slate-800" title={stationLabel({ id, name })}>
                  {stationLabel({ id, name })}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500" title={link}>
                  {pending ? "…" : link}
                </span>
                <button type="button" disabled={pending} className={buttonClass("ghost", "sm")} onClick={() => copy(link, id)}>
                  <Copy className="h-4 w-4" aria-hidden />
                  {copied === id ? "Kopiert" : "Kopier"}
                </button>
                <OpenLink href={pending ? null : link} className={buttonClass("ghost", "sm")} label={`Åpne skjerm for stasjon ${id}`}>
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </OpenLink>
              </li>
            );
          })}
        </ul>
      </details>
    </Card>
  );
}

/** Lenke som åpnes i nytt vindu, eller en deaktivert knapp mens lenken lages. */
function OpenLink({ href, className, label, children }: { href: string | null; className: string; label?: string; children: React.ReactNode }) {
  if (!href) {
    return (
      <button type="button" disabled className={className} aria-label={label}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener" className={className} aria-label={label}>
      {children}
    </a>
  );
}

/** Eksempel-QR i forhåndsvisningen (ikke en ekte lenke – ekte QR vises bare på selve skjermen). */
const EXAMPLE_QR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h21v21H0z"/><path stroke="#000" d="M1 1.5h7M13 1.5h7M1 2.5h1M7 2.5h1M13 2.5h1M19 2.5h1M1 3.5h1M3 3.5h3M7 3.5h1M10 3.5h1M13 3.5h1M15 3.5h3M19 3.5h1M1 4.5h1M3 4.5h3M7 4.5h1M9 4.5h2M13 4.5h1M15 4.5h3M19 4.5h1M1 5.5h1M3 5.5h3M7 5.5h1M13 5.5h1M15 5.5h3M19 5.5h1M1 6.5h1M7 6.5h1M11 6.5h1M13 6.5h1M19 6.5h1M1 7.5h7M9 7.5h1M11 7.5h1M13 7.5h7M9 9.5h3M15 9.5h2M2 10.5h2M6 10.5h3M12 10.5h3M18 10.5h2M1 11.5h1M4 11.5h2M9 11.5h1M11 11.5h2M16 11.5h1M19 11.5h1M9 12.5h2M14 12.5h4M1 13.5h7M9 13.5h1M12 13.5h2M17 13.5h2M1 14.5h1M7 14.5h1M10 14.5h3M15 14.5h1M18 14.5h2M1 15.5h1M3 15.5h3M7 15.5h1M9 15.5h1M13 15.5h3M1 16.5h1M3 16.5h3M7 16.5h1M10 16.5h2M14 16.5h1M17 16.5h2M1 17.5h1M3 17.5h3M7 17.5h1M9 17.5h3M15 17.5h2M19 17.5h1M1 18.5h1M7 18.5h1M10 18.5h1M13 18.5h2M17 18.5h2M1 19.5h7M9 19.5h2M12 19.5h1M14 19.5h3M19 19.5h1"/></svg>';
