"use client";

import type { WaitDisplay } from "@/lib/wait";
import { Maximize, Volume2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DisplayBoard } from "@/components/DisplayBoard";
import { usePolling, useWakeLock } from "@/components/hooks";
import { detectNewCalls, takeSnapshot, type Snapshot } from "@/lib/announce";
import { api } from "@/lib/client-api";
import { POLL_INTERVAL_MS, type StationId } from "@/lib/config";
import { brandingVars, type Branding } from "@/lib/branding";
import { hasThemeParam, parseDisplayOptions } from "@/lib/display-options";
import { useBranding } from "@/components/BrandingContext";
import type { PublicState } from "@/lib/public-state";
import { type AudioSettings, SoundPlayer } from "@/lib/sound";

// Storskjerm på PC/TV. Uten valg i adressen: tre kolonner som før. Valg (?station=A&size=xl …) se
// src/lib/display-options.ts og docs/UI-SPEC.md. Kolonnen blinker i 4,5 s når et nytt nummer kalles.

const BLINK_MS = 4500;
const CONFIG_INTERVAL_MS = 15_000;
const QR_INTERVAL_MS = 60_000;

interface PublicConfigResponse {
  audio: AudioSettings;
  display?: { title: string };
  brand?: Branding;
  queue?: { waitDisplay?: WaitDisplay };
}

export function DisplayClient() {
  const params = useSearchParams();
  const query = params.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- query er nøkkelen for params
  const parsed = useMemo(() => parseDisplayOptions(params), [query]);
  const themeInLink = useMemo(() => hasThemeParam(params), [query]); // eslint-disable-line react-hooks/exhaustive-deps
  // Utseende fra layouten ved innlasting, deretter fra /api/config (skjermen står lenge uten å lastes på nytt).
  const initialBrand = useBranding();
  const [brand, setBrand] = useState<Branding>(initialBrand);
  const options = useMemo(
    () => (themeInLink ? parsed : { ...parsed, theme: brand.displayBackground }),
    [parsed, themeInLink, brand.displayBackground],
  );
  const sound = options.sound;
  const wantQr = options.qr && options.token !== null;

  const player = useRef<SoundPlayer | null>(null);
  const soundSnap = useRef<Snapshot | null>(null);
  const audioSettings = useRef<AudioSettings>({ mode: "default", volume: 80, url: null });
  const [soundOn, setSoundOn] = useState(false);
  const [state, setState] = useState<PublicState | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [waitDisplay, setWaitDisplay] = useState<WaitDisplay>("duration");
  const [qr, setQr] = useState<Partial<Record<StationId, string>> | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
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
      const calls = detectNewCalls(soundSnap.current, res.data.stations, options.stations);
      soundSnap.current = takeSnapshot(res.data.stations);
      if (calls.length && player.current) {
        // Har nettleseren satt lyden på pause (f.eks. etter dvale), vis knappen igjen.
        void player.current.play(audioSettings.current).then((r) => r === "locked" && setSoundOn(false));
      }
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

  // Overskrift og lydinnstillinger fra admin (CDN-mellomlagret 5 s, hentes hvert 15. s).
  usePolling(
    async () => {
      const res = await api<PublicConfigResponse>("/api/config", { cache: "default" });
      if (!res.ok) {
        setTitle((t) => t ?? "Meet & Greet · Køstatus");
        return;
      }
      setTitle(res.data.display?.title ?? "Meet & Greet · Køstatus");
      setWaitDisplay(res.data.queue?.waitDisplay ?? "duration");
      if (res.data.brand) {
        const b = res.data.brand;
        setBrand(b);
        // Ny farge og font uten ny innlasting.
        for (const [k, v] of Object.entries(brandingVars(b))) document.documentElement.style.setProperty(k, v);
      }
      const changed = res.data.audio.url !== audioSettings.current.url;
      audioSettings.current = res.data.audio;
      if (sound && changed && res.data.audio.url && player.current) await player.current.preload(res.data.audio.url);
    },
    CONFIG_INTERVAL_MS,
    true,
    { whenHidden: sound },
  );

  // QR-koder (bare med signert skjermlenke). Hentes hvert minutt, så «Bytt nøkkel» slår inn raskt.
  usePolling(
    async () => {
      const station = options.stations?.join(",") ?? "";
      const res = await api<{ qr: Partial<Record<StationId, string>> }>(
        `/api/display/qr?station=${station}&t=${options.token ?? ""}`,
      );
      if (res.ok) {
        setQr(res.data.qr);
        setQrExpired(false);
      } else if (res.status === 403) {
        setQr(null);
        setQrExpired(true);
      }
    },
    QR_INTERVAL_MS,
    // Utdatert lenke er endelig for dette tokenet: slutt å spørre (ny lenke lages i admin).
    wantQr && !qrExpired,
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

  const fullscreenButton = !isFullscreen && (
    <button
      type="button"
      onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
      className={`rounded-full p-2 ${options.theme === "light" ? "text-slate-300 hover:text-slate-600" : "text-white/30 hover:text-white/70"}`}
      aria-label="Fullskjerm"
      title="Fullskjerm"
    >
      <Maximize className="h-5 w-5" aria-hidden />
    </button>
  );
  const headerVisible = options.header || options.clock;

  return (
    <>
      <DisplayBoard
        state={state}
        options={options}
        title={title}
        blink={blink}
        qr={wantQr ? qr : null}
        logoUrl={brand.logoUrl}
        waitDisplay={waitDisplay}
        corner={headerVisible ? fullscreenButton : null}
      />
      {/* Uten topplinje: fullskjermknappen ligger diskret i hjørnet. */}
      {!headerVisible && fullscreenButton && <div className="fixed right-4 top-4">{fullscreenButton}</div>}
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
      {(offline || qrExpired) && (
        <div className="fixed inset-x-0 bottom-2 space-y-1 text-center text-sm">
          {offline && <p className="text-amber-500/90">Mistet kontakten med serveren – prøver igjen …</p>}
          {qrExpired && (
            <p className={options.theme === "light" ? "text-slate-400" : "text-white/40"} data-testid="qr-expired">
              QR-lenken er utdatert – lag en ny under «Skjermer» i admin.
            </p>
          )}
        </div>
      )}
    </>
  );
}
