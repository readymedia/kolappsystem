"use client";

import { ExternalLink, Music, Trash2, Upload, Volume2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClass, Card } from "@/components/ui";
import { api } from "@/lib/client-api";
import { AUDIO_COMPAT_WARNING, AUDIO_LABEL, AUDIO_MAX_BYTES, AUDIO_MAX_SECONDS, type AudioMime } from "@/lib/media";
import { SoundPlayer } from "@/lib/sound";

// Admin: lydsignal når et nytt nummer kalles. Standardlyd, egen opplastet lyd eller av, og volum.
// Lyden spilles på lydsiden /audio (PC/iPad mot lydanlegg) og på storskjermen med ?sound=1.

type Mode = "default" | "custom" | "off";

interface Config {
  audioMode: Mode;
  audioVolume: number;
  audioFile: { sha256: string; mime: string; size: number } | null;
}

export function AudioCard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [volume, setVolume] = useState(80);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const player = useRef<SoundPlayer | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const apply = useCallback(
    (res: Awaited<ReturnType<typeof api<Config>>>, okText?: string) => {
      if (res.ok) {
        setConfig(res.data);
        setVolume(res.data.audioVolume);
        if (okText) setMessage({ ok: true, text: okText });
      } else if (res.status === 401) onUnauthorized();
      else setMessage({ ok: false, text: res.message });
    },
    [onUnauthorized],
  );

  useEffect(() => {
    void api<Config>("/api/admin/config").then((r) => apply(r));
  }, [apply]);

  async function save(patch: Partial<{ audioMode: Mode; audioVolume: number }>, okText?: string) {
    setBusy(true);
    apply(await api<Config>("/api/admin/config", { method: "PUT", json: patch }), okText);
    setBusy(false);
  }

  function onVolume(v: number) {
    setVolume(v);
    clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(() => void save({ audioVolume: v }), 400);
  }

  async function preview() {
    if (!config) return;
    player.current ??= new SoundPlayer();
    await player.current.unlock();
    const url = config.audioFile ? `/api/media/${config.audioFile.sha256}` : null;
    const result = await player.current.play({ mode: config.audioMode === "off" ? "default" : config.audioMode, volume, url });
    if (config.audioMode === "custom" && result === "default" && player.current.isUnsupported(url)) {
      setMessage({ ok: false, text: "Denne nettleseren kan ikke spille den opplastede filen – standardlyden ble spilt. Bruk MP3 eller WAV." });
    }
  }

  async function upload(file: File) {
    setMessage(null);
    if (file.size > AUDIO_MAX_BYTES) {
      setMessage({ ok: false, text: "Filen er for stor (maks 2 MB)." });
      return;
    }
    const duration = await readDuration(file);
    if (duration !== null && duration > AUDIO_MAX_SECONDS + 0.5) {
      setMessage({ ok: false, text: `Lyden er ${Math.round(duration)} sekunder. Maks er ${AUDIO_MAX_SECONDS} sekunder.` });
      return;
    }
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    const res = await api<Config>("/api/admin/audio", { method: "POST", body: form });
    setBusy(false);
    apply(
      res,
      duration === null
        ? "Lyden er lastet opp. Denne nettleseren kan ikke spille den – test på lydsiden."
        : "Lyden er lastet opp og tatt i bruk.",
    );
    if (fileInput.current) fileInput.current.value = "";
  }

  async function removeFile() {
    setBusy(true);
    apply(await api<Config>("/api/admin/audio", { method: "DELETE" }), "Egen lyd er fjernet. Standardlyden brukes.");
    setBusy(false);
  }

  const mime = config?.audioFile?.mime as AudioMime | undefined;
  const warning = mime ? AUDIO_COMPAT_WARNING[mime] : undefined;

  return (
    <Card className="mt-10 p-6 print:hidden">
      <h2 className="flex items-center gap-2 font-display text-lg text-slate-900">
        <Music className="h-4 w-4 text-slate-400" aria-hidden />
        Lydsignal
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Spilles når et nytt nummer kalles – på lydsiden (PC/iPad koblet til lydanlegget) og på storskjermen hvis lyd er slått på der.
      </p>

      {!config ? (
        <p className="mt-4 text-sm text-slate-400">Henter …</p>
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <fieldset>
              <legend className="text-sm font-medium text-slate-800">Lyd</legend>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
                {(
                  [
                    ["default", "Standardlyd"],
                    ["custom", "Egen lyd"],
                    ["off", "Av"],
                  ] as const
                ).map(([m, label]) => (
                  <label
                    key={m}
                    className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${
                      config.audioMode === m ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"
                    } ${m === "custom" && !config.audioFile ? "pointer-events-none opacity-40" : ""}`}
                  >
                    <input
                      type="radio"
                      name="audio-mode"
                      value={m}
                      checked={config.audioMode === m}
                      disabled={busy || (m === "custom" && !config.audioFile)}
                      onChange={() => void save({ audioMode: m })}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className="text-sm font-medium text-slate-800">Volum: {volume} %</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={volume}
                onChange={(e) => onVolume(Number(e.target.value))}
                aria-label="Volum for lydsignal"
                className="mt-2 w-full accent-slate-900"
              />
              <span className="text-xs text-slate-400">Gjelder alle lydsider og storskjermer innen 15 sekunder.</span>
            </label>

            <button type="button" onClick={preview} className={buttonClass("outline", "sm")}>
              <Volume2 className="h-4 w-4" aria-hidden />
              Spill av
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-800">Egen lyd</p>
            {config.audioFile ? (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span>
                  {AUDIO_LABEL[mime!] ?? config.audioFile.mime} · {(config.audioFile.size / 1024).toFixed(0)} kB
                </span>
                <button type="button" onClick={removeFile} disabled={busy} className={buttonClass("ghost", "sm")} aria-label="Fjern egen lyd">
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Fjern
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Ingen egen lyd lastet opp.</p>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.aif,.aiff"
              className="hidden"
              aria-label="Velg lydfil"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className={buttonClass("outline", "sm")}>
              <Upload className="h-4 w-4" aria-hidden />
              {config.audioFile ? "Bytt lyd …" : "Last opp lyd …"}
            </button>
            <p className="text-xs text-slate-400">MP3 eller WAV anbefales (spilles overalt). Også M4A, OGG, FLAC og AIFF. Maks 2 MB og 15 sekunder.</p>
            {warning && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{warning}</p>}
          </div>
        </div>
      )}

      {message && <p className={`mt-4 text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Link href="/audio" target="_blank" className={buttonClass("ghost", "sm")}>
          <ExternalLink className="h-4 w-4" aria-hidden />
          Åpne lydsiden
        </Link>
        <span className="self-center text-xs text-slate-400">
          Én stasjon: /audio?station=A · På storskjermen: /display?sound=1
        </span>
      </div>
    </Card>
  );
}

/** Lengden i sekunder, eller null hvis nettleseren ikke kan lese filen (f.eks. AIFF utenfor Safari). */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = setTimeout(() => done(null), 4000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      done(Number.isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    audio.src = url;
  });
}
