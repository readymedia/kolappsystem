"use client";

import { AlertTriangle, ArrowLeft, ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { DisplayBoard } from "@/components/DisplayBoard";
import { ScaledPreview } from "@/components/ScaledPreview";
import { usePolling } from "@/components/hooks";
import { buttonClass, Card, Spinner } from "@/components/ui";
import { brandingVars, DEFAULT_BRANDING, FONT_IDS, FONTS, type Branding, type FontId } from "@/lib/branding";
import { api } from "@/lib/client-api";
import { contrastWarning, normalizeHex } from "@/lib/color";
import { POLL_INTERVAL_MS, STATION_THEME } from "@/lib/config";
import { DEFAULT_DISPLAY_OPTIONS } from "@/lib/display-options";
import { IMAGE_LABEL, LOGO_MAX_BYTES, type ImageMime } from "@/lib/media";
import type { PublicState } from "@/lib/public-state";

const DEFAULT_DISPLAY_TITLE = "Meet & Greet · Køstatus";

// Admin → Utseende (v1.4): arrangementsnavn, logo, hovedfarge, storskjermbakgrunn og fonter, med live forhåndsvisning.
// Standardverdiene gir dagens utseende. «Tilbakestill til standard» fjerner også logoen.

interface Config {
  displayTitle: string;
  eventName: string;
  logoFile: { sha256: string; mime: string; size: number } | null;
  primaryColor: string;
  displayBackground: "dark" | "light";
  fontDisplay: FontId;
  fontBody: FontId;
}

type Draft = Omit<Branding, "logoUrl">;

const toDraft = (c: Config): Draft => ({
  eventName: c.eventName,
  primaryColor: c.primaryColor,
  displayBackground: c.displayBackground,
  fontDisplay: c.fontDisplay,
  fontBody: c.fontBody,
});

/** CSS-variabler for forhåndsvisningen. Fontene må settes direkte (de løses opp på <html>). */
function previewStyle(b: Branding): CSSProperties {
  const v = brandingVars(b);
  return {
    ...v,
    "--font-display": v["--brand-font-display"],
    "--font-sans": v["--brand-font-body"],
    fontFamily: v["--brand-font-body"],
  } as CSSProperties;
}

export function UtseendeClient() {
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [colorText, setColorText] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [state, setState] = useState<PublicState | null>(null);
  // Bruk arrangementsnavnet også som overskrift på storskjermen (forhåndsvalgt når overskriften ikke er endret).
  const [alsoTitle, setAlsoTitle] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const apply = useCallback(
    (res: Awaited<ReturnType<typeof api<Config>>>, okText?: string) => {
      if (res.ok) {
        setConfig(res.data);
        setDraft(toDraft(res.data));
        setColorText(res.data.primaryColor);
        if (okText) setMessage({ ok: true, text: okText });
      } else if (res.status === 401) router.refresh();
      else setMessage({ ok: false, text: res.message });
    },
    [router],
  );

  useEffect(() => {
    void api<Config>("/api/admin/config").then((r) => apply(r));
  }, [apply]);

  usePolling(async () => {
    const res = await api<PublicState>("/api/state", { cache: "default" });
    if (res.ok) setState(res.data);
  }, POLL_INTERVAL_MS);

  if (!config || !draft) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-paper">
        <Spinner />
      </main>
    );
  }

  const logoUrl = config.logoFile ? `/api/media/${config.logoFile.sha256}` : null;
  const preview: Branding = { ...draft, logoUrl };
  const nameChanged = draft.eventName.trim() !== config.eventName;
  const titleFromName = draft.eventName.trim() ? `${draft.eventName.trim()} · Køstatus` : DEFAULT_DISPLAY_TITLE;
  const titleUntouched = config.displayTitle === DEFAULT_DISPLAY_TITLE || config.displayTitle === `${config.eventName} · Køstatus`;
  const updateTitle = nameChanged && titleUntouched && alsoTitle;
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(config));
  const warning = contrastWarning(draft.primaryColor);
  const isDefault =
    JSON.stringify(toDraft(config)) === JSON.stringify(toDraft({ ...config, ...DEFAULT_BRANDING })) && !config.logoFile;

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    if (updateTitle) await api("/api/admin/config", { method: "PUT", json: { displayTitle: titleFromName } });
    apply(await api<Config>("/api/admin/branding", { method: "PUT", json: draft }), "Lagret. Alle sider bruker nytt utseende nå (storskjermer innen 20 sekunder).");
    setBusy(false);
  }

  async function reset() {
    setBusy(true);
    setConfirmReset(false);
    apply(await api<Config>("/api/admin/branding", { method: "DELETE" }), "Tilbakestilt til standard utseende.");
    setBusy(false);
  }

  async function upload(file: File) {
    setMessage(null);
    if (file.size > LOGO_MAX_BYTES) {
      setMessage({ ok: false, text: "Filen er for stor (maks 512 kB)." });
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    apply(await api<Config>("/api/admin/logo", { method: "POST", body: form }), "Logoen er lastet opp og i bruk.");
    setBusy(false);
  }

  async function removeLogo() {
    setBusy(true);
    apply(await api<Config>("/api/admin/logo", { method: "DELETE" }), "Logoen er fjernet.");
    setBusy(false);
  }

  const set = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch });
    setMessage(null);
  };

  return (
    <main className="min-h-[100dvh] bg-paper pb-20">
      <div className="mx-auto max-w-6xl px-6 pt-10">
        <Link href="/admin" className={buttonClass("ghost", "sm")}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Til admin
        </Link>
        <p className="mt-6 text-xs uppercase tracking-[0.35em] text-slate-400">Admin</p>
        <h1 className="mt-2 font-display text-3xl text-slate-900">Utseende</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Tilpass navn, logo, farge og fonter for dette arrangementet. Gjelder forsiden, kølappene, skann, storskjermen og utskrift av QR.
          Uten endringer ser alt ut som før.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
          <Card className="space-y-6 p-6">
            <label className="block text-sm font-medium text-slate-800">
              Arrangementsnavn
              <input
                value={draft.eventName}
                onChange={(e) => set({ eventName: e.target.value })}
                maxLength={60}
                placeholder="Tomt = ikke vist"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Vises på forsiden, i fanetittelen og på utskriften av QR-kodene.
              </span>
            </label>
            {nameChanged && titleUntouched && (
              <label className="-mt-3 flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={alsoTitle} onChange={(e) => setAlsoTitle(e.target.checked)} className="mt-1" />
                <span>
                  Bruk også som overskrift på storskjermen: «{titleFromName}»
                </span>
              </label>
            )}
            {nameChanged && !titleUntouched && (
              <p className="-mt-3 text-xs text-slate-500">Storskjermen har egen overskrift («{config.displayTitle}»). Endre den under «Skjermer» i admin.</p>
            )}

            <div>
              <p className="text-sm font-medium text-slate-800">Logo</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-16 w-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-2">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- egen fil fra /api/media
                    <img src={logoUrl} alt="Nåværende logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400">Ingen logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" disabled={busy} className={buttonClass("outline", "sm")} onClick={() => fileInput.current?.click()}>
                    <ImagePlus className="h-4 w-4" aria-hidden />
                    {logoUrl ? "Bytt logo …" : "Last opp logo …"}
                  </button>
                  {logoUrl && (
                    <button type="button" disabled={busy} className={buttonClass("ghost", "sm")} onClick={removeLogo} aria-label="Fjern logo">
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Fjern logo
                    </button>
                  )}
                </div>
              </div>
              {config.logoFile && (
                <p className="mt-1 text-xs text-slate-500">
                  {IMAGE_LABEL[config.logoFile.mime as ImageMime] ?? config.logoFile.mime} · {Math.ceil(config.logoFile.size / 1024)} kB
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">PNG, JPEG, WebP eller SVG, maks 512 kB. Gjerne liggende format med gjennomsiktig bakgrunn.</p>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                className="hidden"
                data-testid="logo-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload(f);
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="primary-text">
                Hovedfarge
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={draft.primaryColor}
                  onChange={(e) => {
                    set({ primaryColor: e.target.value });
                    setColorText(e.target.value);
                  }}
                  aria-label="Velg hovedfarge"
                  className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                />
                <input
                  id="primary-text"
                  value={colorText}
                  onChange={(e) => {
                    setColorText(e.target.value);
                    const hex = normalizeHex(e.target.value);
                    if (hex) set({ primaryColor: hex });
                  }}
                  maxLength={7}
                  className="h-10 w-28 rounded-lg border border-slate-200 px-3 font-mono text-sm"
                />
                <span className={buttonClass("primary", "sm")} style={previewStyle(preview)}>
                  Eksempel
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Brukes på knapper. Tekstfargen (hvit eller mørk) velges automatisk.</p>
              {warning && (
                <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {warning}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-slate-800">Storskjermbakgrunn</p>
              <div className="mt-1 flex gap-4 text-sm">
                {(["dark", "light"] as const).map((bg) => (
                  <label key={bg} className="flex items-center gap-1.5">
                    <input type="radio" name="display-bg" checked={draft.displayBackground === bg} onChange={() => set({ displayBackground: bg })} />
                    {bg === "dark" ? "Mørk" : "Lys"}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">Standard for storskjermen. En skjermlenke med eget valg for bakgrunn overstyrer dette.</p>
            </div>

            {(["fontDisplay", "fontBody"] as const).map((key) => (
              <label key={key} className="block text-sm font-medium text-slate-800">
                {key === "fontDisplay" ? "Font for overskrifter og nummer" : "Font for brødtekst"}
                <select
                  value={draft[key]}
                  onChange={(e) => set({ [key]: e.target.value as FontId })}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 font-normal"
                  style={{ fontFamily: FONTS[draft[key]].family }}
                >
                  {FONT_IDS.map((id) => (
                    <option key={id} value={id} style={{ fontFamily: FONTS[id].family }}>
                      {FONTS[id].label}
                      {id === DEFAULT_BRANDING[key] ? " (standard)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}

            {message && (
              <p role="status" className={`rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                {message.text}
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5">
              <button type="button" disabled={busy || !dirty} className={buttonClass("primary", "md")} onClick={save}>
                Lagre
              </button>
              {dirty && (
                <button type="button" className={buttonClass("ghost", "md")} onClick={() => apply({ ok: true, data: config })}>
                  Angre endringer
                </button>
              )}
              <button
                type="button"
                disabled={busy || isDefault}
                className={buttonClass(confirmReset ? "danger" : "outline", "md")}
                onClick={() => (confirmReset ? reset() : setConfirmReset(true))}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                {confirmReset ? "Bekreft – fjerner også logo" : "Tilbakestill til standard"}
              </button>
              {confirmReset && (
                <button type="button" className={buttonClass("ghost", "md")} onClick={() => setConfirmReset(false)}>
                  Avbryt
                </button>
              )}
            </div>
          </Card>

          <div className="min-w-0 space-y-6" style={previewStyle(preview)} data-testid="branding-preview">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Forhåndsvisning · storskjerm</p>
              <ScaledPreview className="mt-2" label="Forhåndsvisning av storskjerm">
                <DisplayBoard
                  state={state}
                  options={{ ...DEFAULT_DISPLAY_OPTIONS, theme: draft.displayBackground }}
                  title={updateTitle ? titleFromName : config.displayTitle}
                  logoUrl={logoUrl}
                  wide
                  className="h-[900px]"
                />
              </ScaledPreview>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Forhåndsvisning · forside og kølapp</p>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-paper p-5">
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- egen fil fra /api/media
                    <img src={logoUrl} alt="" className="mb-4 h-10 w-auto max-w-[10rem] object-contain" />
                  )}
                  {draft.eventName && <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">{draft.eventName}</p>}
                  <p className="mt-2 font-display text-2xl text-slate-900">Kølappsystem</p>
                  <p className="mt-2 text-sm text-slate-600">Tre stasjoner, én digital kø.</p>
                  <span className={`${buttonClass("primary", "sm")} mt-4`}>Storskjerm</span>
                </div>
                <div className={`rounded-2xl ${STATION_THEME.A.soft} p-5`}>
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- egen fil fra /api/media
                    <img src={logoUrl} alt="" className="mb-4 h-8 w-auto max-w-[8rem] object-contain" />
                  )}
                  <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Kølapp · Stasjon A</p>
                  <div className="mt-3 rounded-2xl bg-white px-4 py-5 text-center">
                    <p className="text-xs text-slate-500">Din plass i køen</p>
                    <p className="mt-1 font-display text-5xl text-slate-900">A12</p>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">3 personer foran deg</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
