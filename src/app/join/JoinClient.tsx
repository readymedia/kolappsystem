"use client";

import { AlertTriangle, CircleSlash } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CenteredMessage, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { parseStationId, STATION_THEME } from "@/lib/config";
import type { PublicState } from "@/lib/public-state";
import { ERROR_TEXT } from "@/lib/texts";

// Åpnes fra QR-koden: /join?station=A&key=...
// Lappen lages med POST (ikke ved selve sidebesøket), så forhåndsvisning i meldingsapper lager ingen lapper.

type View = { kind: "loading" } | { kind: "closed"; message: string } | { kind: "error"; text: string };

export function JoinClient() {
  const router = useRouter();
  const params = useSearchParams();
  const station = parseStationId(params.get("station"));
  const key = params.get("key") ?? "";
  const [view, setView] = useState<View>(
    station ? { kind: "loading" } : { kind: "error", text: ERROR_TEXT.invalid_station },
  );
  const started = useRef(false);

  useEffect(() => {
    if (!station || started.current) return;
    started.current = true;
    const storageKey = `kolapp_${station}`;
    const requestKey = `kolapp_req_${station}`;
    let existing: string | null = null;
    // requestId lagres FØR kallet. Forsvinner svaret på dårlig nett og personen skanner igjen,
    // sendes samme requestId, og serveren gir samme lapp i stedet for en ny.
    let requestId: string = newRequestId();
    try {
      existing = localStorage.getItem(storageKey);
      requestId = localStorage.getItem(requestKey) ?? requestId;
      localStorage.setItem(requestKey, requestId);
    } catch {
      // Privat modus e.l. – vi lager bare en ny lapp.
    }

    void (async () => {
      const res = await api<{ ticketId: string }>("/api/join", {
        method: "POST",
        json: { station, key, existingTicketId: existing, requestId },
      });
      if (res.ok) {
        try {
          localStorage.setItem(storageKey, res.data.ticketId);
          localStorage.removeItem(requestKey);
        } catch {
          // Ignorer.
        }
        router.replace(`/ticket/${res.data.ticketId}`);
        return;
      }
      if (res.error === "closed") {
        // Valgfri melding fra admin («Tilbake kl. 14.00») ligger i den offentlige køstatusen.
        setView({ kind: "closed", message: "" });
        const state = await api<PublicState>("/api/state", { cache: "default" });
        const message = state.ok ? (state.data.stations.find((s) => s.id === station)?.closedMessage ?? "") : "";
        if (message) setView({ kind: "closed", message });
      }
      else if (["invalid_link", "invalid_station", "rate_limited", "too_many_waiting", "busy"].includes(res.error)) {
        setView({ kind: "error", text: res.message });
      } else setView({ kind: "error", text: "Noe gikk galt. Prøv å skanne koden på nytt." });
    })();
  }, [station, key, router]);

  if (view.kind === "closed") {
    return (
      <CenteredMessage
        icon={<CircleSlash className="h-8 w-8 text-slate-400" aria-hidden />}
        title={`Stasjon ${station} er stengt`}
        text={view.message ? `${view.message}\n\n${ERROR_TEXT.closed}` : ERROR_TEXT.closed}
      />
    );
  }
  if (view.kind === "error") {
    return (
      <CenteredMessage
        icon={<AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden />}
        title="Ugyldig lenke"
        text={view.text}
      />
    );
  }
  return (
    <div className={station ? STATION_THEME[station].soft : ""}>
      <CenteredMessage
        tone="soft"
        icon={<Spinner />}
        title="Henter kølappen din …"
        text="Du får et nummer og kan følge køen videre."
      />
    </div>
  );
}

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Eldre nettlesere: lag en UUID v4 for hånd.
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (Number(c) ^ (Math.floor(Math.random() * 256) & (15 >> (Number(c) / 4)))).toString(16),
    );
  }
}
