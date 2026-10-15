"use client";

import { Maximize, Volume2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePolling, useWakeLock } from "@/components/hooks";
import { detectNewCalls, takeSnapshot, type Snapshot } from "@/lib/announce";
import { api } from "@/lib/client-api";
import { type AudioSettings, SoundPlayer } from "@/lib/sound";
import { DISPLAY_NEXT_COUNT, POLL_INTERVAL_MS, STATION_IDS, STATION_THEME, type StationId } from "@/lib/config";
import type { PublicState, PublicStation } from "@/lib/public-state";

// Fullskjerm på PC/TV: tre kolonner, «NÅ BETJENES», gigantisk nummer og de neste tre.
// Kolonnen blinker i 4,5 s når et nytt nummer kalles. Ingen innlogging.

const BLINK_MS = 4500;

export function DisplayClient() {
  // ?sound=1: storskjermen spiller lydsignal selv (krever ett klikk på skjermen, nettleserkrav).
  const sound = useSearchParams().get("sound") === "1";
  const player = useRef<SoundPlayer | null>(null);
  const soundSnap = useRef<Snapshot | null>(null);
  const audioSettings = useRef<AudioSettings>({ mode: "default", volume: 80, url: null });
  const [soundOn, setSoundOn] = useState(false);
  const [state, setState] = useState<PublicState | null>(null);
  const [offline, setOffline] = useState(false);
  const [blink, setBlink] = useState<Partial<Record<StationId, boolean>>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastCurrent = useRef<Partial<Record<StationId, number | null>>>({});
  const initialized = useRef(false);

  const blinkTimers = useRef<Partial<Record<StationId, ReturnType<typeof setTimeout>>>>({});

  usePolling(async () => {
    const res = await api<PublicState>("/api/state", { cache: "default" });
    setOffline(!res.ok);
    if (!res.ok) return;
    setState(res.data);
    if (sound) {
      const calls = detectNewCalls(soundSnap.current, res.data.stations, null);
      soundSnap.current = takeSnapshot(res.data.stations);
      if (calls.length && player.current) void player.current.play(audioSettings.current);
    }
    // Blink kolonnen når et nytt nummer kalles (ikke ved første innlasting).
    for (const s of res.data.stations) {
      const changed = initialized.current && s.current !== null && s.current !== lastCurrent.current[s.id];
      lastCurrent.current[s.id] = s.current;
      if (!changed) continue;
      setBlink((b) => ({ ...b, [s.id]: true }));
      clearTimeout(blinkTimers.current[s.id]);
      blinkTimers.current[s.id] = setTimeout(() => setBlink((b) => ({ ...b, [s.id]: false })), BLINK_MS);
    }
    initialized.current = true;
  }, POLL_INTERVAL_MS, true, { whenHidden: sound });
  useWakeLock(true);

  // Lydinnstillinger fra admin (bare når lyd er slått på for skjermen).
  usePolling(
    async () => {
      const res = await api<{ audio: AudioSettings }>("/api/config", { cache: "default" });
      if (!res.ok) return;
      const changed = res.data.audio.url !== audioSettings.current.url;
      audioSettings.current = res.data.audio;
      if (changed && res.data.audio.url && player.current) await player.current.preload(res.data.audio.url);
    },
    15_000,
    sound,
    { whenHidden: true },
  );

  async function enableSound() {
    player.current ??= new SoundPlayer();
    if (await player.current.unlock()) {
      setSoundOn(true);
      const url = audioSettings.current.url;
      if (url) await player.current.preload(url);
    }
  }

  // Rydd blink-tidtakere når siden lukkes.
  useEffect(() => {
    const timers = blinkTimers.current;
    return () => Object.values(timers).forEach((t) => clearTimeout(t));
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <main className="min-h-[100dvh] bg-black px-6 py-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="relative">
          <p className="text-center text-xs uppercase tracking-[0.6em] text-white/35">Meet &amp; Greet · Køstatus</p>
          {!isFullscreen && (
            <button
              type="button"
              onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/30 hover:text-white/70"
              aria-label="Fullskjerm"
              title="Fullskjerm"
            >
              <Maximize className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STATION_IDS.map((id) => (
            <Column key={id} id={id} station={state?.stations.find((s) => s.id === id)} blink={Boolean(blink[id])} />
          ))}
        </div>
        {sound && !soundOn && (
          <button
            type="button"
            onClick={enableSound}
            className="fixed inset-x-0 bottom-6 mx-auto flex w-fit items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-lg font-semibold text-white shadow-lg"
          >
            <Volume2 className="h-5 w-5" aria-hidden />
            Klikk for å slå på lyd
          </button>
        )}
        {offline && (
          <p className="mt-6 text-center text-sm text-amber-300/80">Mistet kontakten med serveren – prøver igjen …</p>
        )}
      </div>
    </main>
  );
}

function Column({ id, station, blink }: { id: StationId; station?: PublicStation; blink: boolean }) {
  const t = STATION_THEME[id];
  const active = station?.active !== false;
  const current = station?.current ?? null;
  const next = station?.waiting.slice(0, DISPLAY_NEXT_COUNT) ?? [];
  return (
    <section className={`rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 ${blink ? "kallblink" : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl text-white">Stasjon {id}</h2>
        <span className={`text-xs uppercase tracking-[0.25em] ${active ? t.display : "text-white/30"}`}>
          {active ? "Åpen" : "Stengt"}
        </span>
      </div>
      <p className="mt-10 text-xs uppercase tracking-[0.4em] text-white/40">Nå betjenes</p>
      <p
        className={`mt-2 font-display text-[7rem] leading-[0.85] tabular-nums sm:text-[9rem] ${current !== null ? t.display : "text-white/15"}`}
        aria-live="polite"
      >
        {current !== null ? `${id}${current}` : "–"}
      </p>
      <p className="mt-10 text-lg text-white/50">
        Neste: <span className="text-white/90">{next.length ? next.map((n) => `${id}${n}`).join(", ") : "–"}</span>
      </p>
    </section>
  );
}
