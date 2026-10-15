"use client";

import { AlertTriangle, Bell, BellOff, Volume2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling, useWakeLock } from "@/components/hooks";
import { detectNewCalls, parseStationFilter, takeSnapshot, type Snapshot } from "@/lib/announce";
import { POLL_INTERVAL_MS, STATION_IDS, STATION_THEME, type StationId } from "@/lib/config";
import type { PublicState } from "@/lib/public-state";
import { type AudioSettings, SoundPlayer } from "@/lib/sound";

// Lydsiden: står åpen på en PC/iPad koblet til lydanlegget og spiller lydsignal når et nytt nummer kalles.
// /audio            → alle stasjoner
// /audio?station=A  → bare A (flere: A,C)
// Hentingen går i en Web Worker, så siden lytter også når den ligger i bakgrunnen.

const CONFIG_MS = 15_000;
const DEFAULT_SETTINGS: AudioSettings = { mode: "default", volume: 80, url: null };
const LOG_SIZE = 8;

export function AudioClient() {
  const params = useSearchParams();
  const filter = parseStationFilter(params.get("station"));
  const filterKey = filter?.join(",") ?? "";
  const stations: StationId[] = filter ?? [...STATION_IDS];

  const player = useRef<SoundPlayer | null>(null);
  const snapshot = useRef<Snapshot | null>(null);
  const settingsRef = useRef<AudioSettings>(DEFAULT_SETTINGS);
  const startedRef = useRef(false);

  const [started, setStarted] = useState(false);
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_SETTINGS);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [failures, setFailures] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [log, setLog] = useState<{ label: string; at: Date; station: StationId }[]>([]);
  const [workerFailed, setWorkerFailed] = useState(false);

  const getPlayer = () => (player.current ??= new SoundPlayer());

  const onState = useCallback(
    (ok: boolean, data: PublicState | null) => {
      if (!ok || !data) {
        setFailures((f) => f + 1);
        return;
      }
      setFailures(0);
      setLastCheck(new Date());
      const calls = detectNewCalls(snapshot.current, data.stations, parseStationFilter(filterKey));
      snapshot.current = takeSnapshot(data.stations);
      if (!startedRef.current || calls.length === 0) return;
      setLog((l) =>
        [...calls.map((c) => ({ label: `${c.station}${c.number}`, at: new Date(), station: c.station })), ...l].slice(0, LOG_SIZE),
      );
      // Én lyd selv om flere stasjoner kaller samtidig.
      void getPlayer()
        .play(settingsRef.current)
        .then((r) => setBlocked(r === "locked"));
    },
    [filterKey],
  );

  const onConfig = useCallback(async (ok: boolean, data: { audio: AudioSettings } | null) => {
    if (!ok || !data) return;
    const next = data.audio;
    const changedUrl = next.url !== settingsRef.current.url;
    settingsRef.current = next;
    setSettings(next);
    if (startedRef.current && next.mode === "custom" && next.url && changedUrl) {
      setUnsupported((await getPlayer().preload(next.url)) === "unsupported");
    }
  }, []);

  // Henting i Web Worker (tåler bakgrunn). Faller tilbake til vanlig henting hvis worker ikke kan startes.
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./poller.worker.ts", import.meta.url));
    } catch {
      // Planlagt som oppgave, ikke synkront i effekten.
      queueMicrotask(() => setWorkerFailed(true));
      return;
    }
    worker.onmessage = (e: MessageEvent<{ type: string; ok: boolean; data: unknown }>) => {
      if (e.data.type === "state") onState(e.data.ok, e.data.data as PublicState | null);
      if (e.data.type === "config") void onConfig(e.data.ok, e.data.data as { audio: AudioSettings } | null);
    };
    worker.onerror = () => setWorkerFailed(true);
    worker.postMessage({ type: "start", stateMs: POLL_INTERVAL_MS, configMs: CONFIG_MS });
    const wake = () => worker?.postMessage({ type: "now" });
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    return () => {
      worker?.postMessage({ type: "stop" });
      worker?.terminate();
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
    };
  }, [onState, onConfig]);

  // Reserveløsning uten worker.
  usePolling(
    async () => {
      const [s, c] = await Promise.all([
        fetch("/api/state").then(async (r) => ({ ok: r.ok, data: r.ok ? await r.json() : null })).catch(() => ({ ok: false, data: null })),
        fetch("/api/config").then(async (r) => ({ ok: r.ok, data: r.ok ? await r.json() : null })).catch(() => ({ ok: false, data: null })),
      ]);
      onState(s.ok, s.data);
      await onConfig(c.ok, c.data);
    },
    POLL_INTERVAL_MS,
    workerFailed,
    { whenHidden: true },
  );

  useWakeLock(started);

  // Oppdag at nettleseren har satt lyden på pause (f.eks. iPad etter avbrudd).
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setBlocked(getPlayer().state !== "running"), 2000);
    return () => clearInterval(t);
  }, [started]);

  async function start() {
    const ok = await getPlayer().unlock();
    if (!ok) {
      setBlocked(true);
      return;
    }
    startedRef.current = true;
    setStarted(true);
    setBlocked(false);
    const s = settingsRef.current;
    if (s.mode === "custom" && s.url) setUnsupported((await getPlayer().preload(s.url)) === "unsupported");
  }

  async function test() {
    await getPlayer().unlock();
    const r = await getPlayer().play(settingsRef.current);
    setBlocked(r === "locked");
  }

  const fmt = (d: Date) => d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <main className="min-h-[100dvh] bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-xl">
        <p className="text-xs uppercase tracking-[0.4em] text-white/40">Lydsignal</p>
        <h1 className="mt-2 font-display text-3xl">
          {filter ? `Stasjon ${stations.join(", ")}` : "Alle stasjoner"}
        </h1>

        <div className="mt-3 flex gap-2">
          {stations.map((id) => (
            <span key={id} className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white ${STATION_THEME[id].solid}`}>
              {id}
            </span>
          ))}
        </div>

        {!started ? (
          <button
            type="button"
            onClick={start}
            className="mt-10 flex h-40 w-full flex-col items-center justify-center gap-3 rounded-[2rem] bg-emerald-500 text-2xl font-semibold text-white shadow-lg transition active:scale-[0.98]"
          >
            <Bell className="h-10 w-10" aria-hidden />
            Start lydsignal
          </button>
        ) : (
          <div className="mt-10 rounded-[2rem] border border-emerald-400/40 bg-emerald-500/10 p-6">
            <p className="flex items-center gap-2 text-xl font-semibold text-emerald-300">
              <Volume2 className="h-6 w-6" aria-hidden />
              Lyd aktiv ✓
            </p>
            <p className="mt-2 text-sm text-white/60">La siden stå åpen. Den spiller når et nytt nummer kalles.</p>
          </div>
        )}

        {settings.mode === "off" && (
          <p className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm">
            <BellOff className="h-4 w-4" aria-hidden />
            Lyd er slått av i admin.
          </p>
        )}

        {started && blocked && (
          <button
            type="button"
            onClick={start}
            role="alert"
            className="mt-4 flex w-full items-center gap-2 rounded-2xl bg-red-600 px-4 py-4 text-left font-semibold"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            Nettleseren har satt lyden på pause. Trykk her for å slå den på igjen.
          </button>
        )}

        {failures >= 3 && (
          <p role="status" className="mt-4 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-amber-950">
            Mistet kontakten – prøver igjen. Sjekk nettet.
          </p>
        )}

        {unsupported && (
          <p className="mt-4 rounded-2xl bg-amber-400/20 px-4 py-3 text-sm text-amber-200">
            Denne nettleseren kan ikke spille den opplastede lyden. Standardlyden brukes i stedet. Last opp MP3 eller WAV i admin.
          </p>
        )}

        <dl className="mt-8 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/5 p-4">
            <dt className="text-white/40">Sist sjekket</dt>
            <dd className="mt-1 font-display text-xl tabular-nums" aria-live="polite">
              {lastCheck ? fmt(lastCheck) : "–"}
            </dd>
          </div>
          <div className="rounded-2xl bg-white/5 p-4">
            <dt className="text-white/40">Lyd</dt>
            <dd className="mt-1 font-display text-xl">
              {settings.mode === "off" ? "Av" : settings.mode === "custom" ? "Egen lyd" : "Standard"} · {settings.volume} %
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={test}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-medium hover:bg-white/10"
        >
          <Volume2 className="h-4 w-4" aria-hidden />
          Test lyd
        </button>

        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-[0.3em] text-white/40">Siste opprop</h2>
          {log.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">Ingen ennå.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {log.map((l, i) => (
                <li key={`${l.label}-${l.at.getTime()}-${i}`} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2">
                  <span className="font-display text-xl">{l.label}</span>
                  <span className="text-sm tabular-nums text-white/50">{fmt(l.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-10 text-xs text-white/30">
          Tips: /audio?station=A spiller bare for stasjon A. Volum og lyd endres i admin og gjelder her innen 15 sekunder.
        </p>
      </div>
    </main>
  );
}
