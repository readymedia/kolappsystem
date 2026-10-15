"use client";

import { Clock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { buttonClass, Card } from "@/components/ui";
import { api } from "@/lib/client-api";
import type { PublicState } from "@/lib/public-state";
import { stationLabel } from "@/lib/stations";
import { formatWait, type WaitDisplay } from "@/lib/wait";

// Admin: «Kø og ventetid» (v1.7). Gi fra seg plassen (standard på) og hvordan ventetiden regnes ut
// (standard: fast 2 minutter per person, som før – eller faktisk tempo ved hver stasjon).

interface QueueSettings {
  allowLeave: boolean;
  waitMode: "fixed" | "measured";
  waitMinutes: number;
  confirmJoin: boolean;
  waitDisplay: WaitDisplay;
}

const DISPLAYS: { value: WaitDisplay; label: string }[] = [
  { value: "duration", label: "Tid («Ca. 25 minutter»)" },
  { value: "clock", label: "Klokkeslett («Din tur ca. kl. 14:35»)" },
  { value: "both", label: "Begge («Ca. 25 minutter – ca. kl. 14:35»)" },
];

export function QueueCard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [settings, setSettings] = useState<QueueSettings | null>(null);
  const [minutesText, setMinutesText] = useState("2");
  const [message, setMessage] = useState("");
  const [pace, setPace] = useState<{ label: string; minutes: number }[]>([]);

  const loadPace = useCallback(async () => {
    const r = await api<PublicState>("/api/state");
    if (r.ok) setPace(r.data.stations.map((s) => ({ label: stationLabel(s), minutes: s.minutesPerPerson })));
  }, []);

  const apply = useCallback(
    (r: Awaited<ReturnType<typeof api<QueueSettings>>>, okText?: string) => {
      if (r.ok) {
        setSettings({
          allowLeave: r.data.allowLeave,
          waitMode: r.data.waitMode,
          waitMinutes: r.data.waitMinutes,
          confirmJoin: r.data.confirmJoin,
          waitDisplay: r.data.waitDisplay,
        });
        setMinutesText(String(r.data.waitMinutes).replace(".", ","));
        if (okText) setMessage(okText);
        void loadPace();
      } else if (r.status === 401) onUnauthorized();
      else setMessage(r.message);
    },
    [onUnauthorized, loadPace],
  );

  useEffect(() => {
    queueMicrotask(() => void api<QueueSettings>("/api/admin/config").then((r) => apply(r)));
  }, [apply]);

  async function save(patch: Partial<QueueSettings>, okText: string) {
    setMessage("");
    // Vis valget med en gang; svaret fra serveren retter opp hvis noe gikk galt.
    setSettings((cur) => (cur ? { ...cur, ...patch } : cur));
    const r = await api<QueueSettings>("/api/admin/config", { method: "PUT", json: patch });
    apply(r, okText);
    // Feil: hent faktisk innstilling igjen, så bryteren aldri viser noe som ikke er lagret.
    if (!r.ok && r.status !== 401) apply(await api<QueueSettings>("/api/admin/config"));
  }

  const parsedMinutes = Number(minutesText.replace(",", "."));
  const minutesValid = Number.isFinite(parsedMinutes) && parsedMinutes >= 0.5 && parsedMinutes <= 60 && Number.isInteger(parsedMinutes * 2);

  return (
    <Card className="mt-10 p-6 print:hidden">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-slate-400" aria-hidden />
        <h2 className="font-display text-xl text-slate-900">Kø og ventetid</h2>
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="max-w-2xl">
          <p className="font-medium text-slate-800">Gjester kan gi fra seg plassen</p>
          <p className="mt-1 text-sm text-slate-500">
            Kølappen viser «Gi fra meg plassen» (med bekreftelse og 60 sekunder til å angre). Den som er kalt kan også si fra – da ser
            operatøren «A12 ga fra seg plassen». Antallet vises hos operatøren og på stasjonskortene.
          </p>
        </div>
        <Switch
          label="Gjester kan gi fra seg plassen"
          on={settings?.allowLeave ?? false}
          disabled={!settings}
          onToggle={() =>
            settings &&
            void save(
              { allowLeave: !settings.allowLeave },
              settings.allowLeave ? "Gjester kan ikke lenger gi fra seg plassen." : "Gjester kan gi fra seg plassen.",
            )
          }
        />
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="max-w-2xl">
          <p className="font-medium text-slate-800">Vis køen før gjesten tar lapp</p>
          <p className="mt-1 text-sm text-slate-500">
            Etter skann ser gjesten «12 foran deg · ca. 25 minutter» og trykker «Ta kølapp» – eller «Ikke nå». Av: lappen lages med en gang
            (som før).
          </p>
        </div>
        <Switch
          label="Vis køen før gjesten tar lapp"
          on={settings?.confirmJoin ?? false}
          disabled={!settings}
          onToggle={() =>
            settings &&
            void save(
              { confirmJoin: !settings.confirmJoin },
              settings.confirmJoin ? "Gjester får lapp med en gang etter skann." : "Gjester ser køen før de tar lapp.",
            )
          }
        />
      </div>

      <fieldset className="mt-5" disabled={!settings}>
        <legend className="font-medium text-slate-800">Ventetid på kølappen</legend>
        <p className="mt-1 text-sm text-slate-500">Antall foran × minutter per person.</p>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="wait-mode"
                checked={settings?.waitMode === "fixed"}
                onChange={() => void save({ waitMode: "fixed" }, "Fast ventetid per person brukes.")}
              />
              <span>Fast:</span>
            </label>
            <input
              value={minutesText}
              onChange={(e) => setMinutesText(e.target.value)}
              inputMode="decimal"
              aria-label="Minutter per person"
              className="h-9 w-16 rounded-lg border border-slate-200 px-2 text-center"
            />
            <span aria-hidden>minutter per person</span>
            <button
              type="button"
              disabled={!minutesValid || parsedMinutes === settings?.waitMinutes}
              className={buttonClass("outline", "sm")}
              onClick={() => void save({ waitMinutes: parsedMinutes }, `Ventetiden regnes nå med ${minutesText} minutter per person.`)}
            >
              Lagre
            </button>
            {!minutesValid && <span className="text-xs text-red-600">0,5–60, i hele eller halve minutter.</span>}
          </div>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="wait-mode"
              className="mt-1"
              checked={settings?.waitMode === "measured"}
              onChange={() => void save({ waitMode: "measured" }, "Faktisk tempo brukes.")}
            />
            <span>
              <span className="font-medium text-slate-800">Faktisk tempo ved hver stasjon</span>
              <span className="block text-slate-500">
                Midtverdien av tiden mellom de siste oppropene. Til det er nok opprop (minst 4), og etter pauser over 30 minutter, brukes
                det faste tallet over.
              </span>
            </span>
          </label>
        </div>
        <fieldset className="mt-5">
          <legend className="font-medium text-slate-800">Vis ventetiden som</legend>
          <div className="mt-2 space-y-2 text-sm">
            {DISPLAYS.map((d) => (
              <label key={d.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="wait-display"
                  checked={settings?.waitDisplay === d.value}
                  onChange={() => void save({ waitDisplay: d.value }, `Ventetiden vises nå som ${d.label.split(" (")[0]!.toLowerCase()}.`)}
                />
                {d.label}
                {d.value === "duration" && <span className="text-slate-400">(standard)</span>}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">Klokkeslett rundes opp til nærmeste 5 minutter og vises ikke når ventetiden er under 5 minutter.</p>
        </fieldset>
        {settings && pace.length > 0 && (
          <p className="mt-3 text-sm text-slate-600" data-testid="pace">
            Nå: {pace.map((p) => `${p.label} ${String(p.minutes).replace(".", ",")} min`).join(" · ")}
            {" – "}
            f.eks. 10 foran gir «{formatWait(10, pace[0]!.minutes, settings.waitDisplay)}».
          </p>
        )}
      </fieldset>
      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
    </Card>
  );
}

function Switch({ label, on, disabled, onToggle }: { label: string; on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="flex items-center gap-2 rounded-full text-sm font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
    >
      <span className={`relative h-6 w-11 rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden>
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-5" : ""}`} />
      </span>
      {on ? "På" : "Av"}
    </button>
  );
}
