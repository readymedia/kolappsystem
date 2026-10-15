"use client";

// Avspilling av lydsignal med Web Audio. Felles for lydsiden, storskjermen og forhåndsvisning i admin.
//
// - Nettlesere tillater ikke lyd før brukeren har trykket på siden: kall unlock() fra et klikk.
// - Når konteksten er låst opp, kan lyd spilles også når fanen ligger i bakgrunnen.
// - Standardlyden er et rolig todelt klokkeslag som lages i koden (ingen fil, ingen lisens).
// - Egen lyd dekodes én gang og mellomlagres. Kan den ikke spilles i denne nettleseren (f.eks. AIFF
//   utenfor Safari), brukes standardlyden i stedet og `unsupported` settes.

export interface AudioSettings {
  mode: "default" | "custom" | "off";
  volume: number; // 0–100
  url: string | null;
}

type Ctx = AudioContext;

export class SoundPlayer {
  private ctx: Ctx | null = null;
  private buffers = new Map<string, AudioBuffer | "unsupported">();

  /** «running» når lyd kan spilles, «locked» før første klikk, ellers nettleserens tilstand. */
  get state(): string {
    return this.ctx?.state ?? "locked";
  }

  /** Må kalles fra et klikk. Returnerer true når lyd kan spilles. */
  async unlock(): Promise<boolean> {
    try {
      if (!this.ctx) {
        const C: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!C) return false;
        this.ctx = new C();
      }
      if (this.ctx.state !== "running") await this.ctx.resume();
      // En stille lyd «låser opp» lyd på iPhone/iPad.
      const silent = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = silent;
      src.connect(this.ctx.destination);
      src.start(0);
      return this.ctx.state === "running";
    } catch {
      return false;
    }
  }

  /** Henter og dekoder egen lyd på forhånd. «unsupported» = nettleseren kan ikke spille filen. */
  async preload(url: string): Promise<"ok" | "unsupported" | "error"> {
    if (this.buffers.has(url)) return this.buffers.get(url) === "unsupported" ? "unsupported" : "ok";
    if (!this.ctx) return "error";
    try {
      const res = await fetch(url);
      if (!res.ok) return "error";
      const data = await res.arrayBuffer();
      try {
        this.buffers.set(url, await this.ctx.decodeAudioData(data));
        return "ok";
      } catch {
        this.buffers.set(url, "unsupported");
        return "unsupported";
      }
    } catch {
      return "error";
    }
  }

  /** Spiller lydsignalet etter innstillingene. Returnerer hva som faktisk ble spilt. */
  async play(settings: AudioSettings): Promise<"custom" | "default" | "off" | "locked"> {
    if (settings.mode === "off") return "off";
    if (!this.ctx || this.ctx.state !== "running") return "locked";
    const gain = this.ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, settings.volume / 100));
    gain.connect(this.ctx.destination);

    let played: "custom" | "default" = "default";
    if (settings.mode === "custom" && settings.url) {
      if (!this.buffers.has(settings.url)) await this.preload(settings.url);
      const buf = this.buffers.get(settings.url);
      if (buf && buf !== "unsupported") {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(gain);
        src.start();
        played = "custom";
      }
    }
    if (played === "default") this.chime(gain);
    markPlayed(played);
    return played;
  }

  isUnsupported(url: string | null): boolean {
    return url !== null && this.buffers.get(url) === "unsupported";
  }

  /** «Ding–dong»: to toner (E5 → C5) med myk innsving og lang utklang, og en svak overtone for klang. */
  private chime(out: GainNode) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.02;
    const tone = (freq: number, start: number) => {
      for (const [mult, level] of [
        [1, 0.55],
        [2, 0.12],
        [3, 0.05],
      ] as const) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * mult;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(level, start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 1.6);
        osc.connect(g).connect(out);
        osc.start(start);
        osc.stop(start + 1.7);
      }
    };
    tone(659.25, t0);
    tone(523.25, t0 + 0.45);
  }
}

/** Synlig spor for tester og feilsøking: antall avspillinger og siste type på <html>. */
function markPlayed(kind: string) {
  const el = document.documentElement;
  el.dataset.soundCount = String(Number(el.dataset.soundCount ?? 0) + 1);
  el.dataset.soundLast = kind;
}
