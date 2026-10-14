"use client";

import { AlertTriangle, CircleSlash } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CenteredMessage, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { parseStationId, STATION_THEME } from "@/lib/config";
import { ERROR_TEXT } from "@/lib/texts";

// Åpnes fra QR-koden: /join?station=A&key=...
// Lappen lages med POST (ikke ved selve sidebesøket), så forhåndsvisning i meldingsapper lager ingen lapper.

type View = { kind: "loading" } | { kind: "closed" } | { kind: "error"; text: string };

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
    let existing: string | null = null;
    try {
      existing = localStorage.getItem(storageKey);
    } catch {
      // Privat modus e.l. – vi lager bare en ny lapp.
    }

    void (async () => {
      const res = await api<{ ticketId: string }>("/api/join", {
        method: "POST",
        json: { station, key, existingTicketId: existing },
      });
      if (res.ok) {
        try {
          localStorage.setItem(storageKey, res.data.ticketId);
        } catch {
          // Ignorer.
        }
        router.replace(`/ticket/${res.data.ticketId}`);
        return;
      }
      if (res.error === "closed") setView({ kind: "closed" });
      else if (res.error === "invalid_link" || res.error === "invalid_station") setView({ kind: "error", text: res.message });
      else setView({ kind: "error", text: res.error === "rate_limited" ? res.message : "Noe gikk galt. Prøv å skanne koden på nytt." });
    })();
  }, [station, key, router]);

  if (view.kind === "closed") {
    return (
      <CenteredMessage
        icon={<CircleSlash className="h-8 w-8 text-slate-400" aria-hidden />}
        title={`Stasjon ${station} er stengt`}
        text={ERROR_TEXT.closed}
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
