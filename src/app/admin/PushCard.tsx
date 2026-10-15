"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { api } from "@/lib/client-api";

// Admin: push-varsel på kølappen (v1.5). Av som standard. Av = ingen knapp for publikum og ingen utsending.

export function PushCard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [subscribers, setSubscribers] = useState(0);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const r = await api<{ pushEnabled: boolean; pushSubscribers: number }>("/api/admin/config");
    if (r.ok) {
      setEnabled(r.data.pushEnabled);
      setSubscribers(r.data.pushSubscribers);
    } else if (r.status === 401) onUnauthorized();
  }, [onUnauthorized]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function toggle(next: boolean) {
    setMessage("");
    const r = await api<{ pushEnabled: boolean; pushSubscribers: number }>("/api/admin/config", {
      method: "PUT",
      json: { pushEnabled: next },
    });
    if (r.ok) {
      setEnabled(r.data.pushEnabled);
      setSubscribers(r.data.pushSubscribers);
      setMessage(next ? "Push-varsler er slått på. Nye kølapper viser «Varsle meg» innen 5 sekunder." : "Push-varsler er slått av. Knappen er borte og ingenting sendes.");
    } else if (r.status === 401) onUnauthorized();
    else setMessage(r.message);
  }

  return (
    <Card className="mt-10 p-6 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <Bell className="h-5 w-5 text-slate-400" aria-hidden />
        <h2 className="flex-1 font-display text-xl text-slate-900">Push-varsler</h2>
        <button
          type="button"
          role="switch"
          aria-checked={enabled ?? false}
          aria-label="Push-varsler på kølappen"
          disabled={enabled === null}
          onClick={() => void toggle(!enabled)}
          className="flex items-center gap-2 rounded-full text-sm font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
        >
          <span
            className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-emerald-500" : "bg-slate-300"}`}
            aria-hidden
          >
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "translate-x-5" : ""}`} />
          </span>
          {enabled ? "På" : "Av"}
        </button>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-slate-500">
        Gjester kan få varsel på mobilen når de er nest i køen og når det er deres tur – også med låst skjerm. Kølappen viser knappen
        «Varsle meg» bare når dette er på.
      </p>
      <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 text-sm text-slate-500">
        <li>Android og PC: virker direkte.</li>
        <li>iPhone/iPad (iOS 16.4 eller nyere): bare etter «Legg til på Hjem-skjerm». Kølappen viser en kort veiviser.</li>
        <li>Den åpne kølappen virker som før. Push er et tillegg.</li>
      </ul>
      {enabled && (
        <p className="mt-3 text-sm text-slate-700" data-testid="push-subscribers">
          {subscribers === 1 ? "1 gjest" : `${subscribers} gjester`} i kø har varsel på nå.
        </p>
      )}
      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
    </Card>
  );
}
