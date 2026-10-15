"use client";

import { Monitor, Settings2, UserCog } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePolling } from "@/components/hooks";
import { Logo, useBranding } from "@/components/BrandingContext";
import { buttonClass } from "@/components/ui";
import { api } from "@/lib/client-api";
import { ST, stationLabel, stationsIntro, stationVars } from "@/lib/stations";
import type { PublicState } from "@/lib/public-state";

export function HomeClient() {
  const brand = useBranding();
  const [state, setState] = useState<PublicState | null>(null);
  usePolling(async () => {
    const res = await api<PublicState>("/api/state", { cache: "default" });
    if (res.ok) setState(res.data);
  }, 30_000);

  return (
    <main className="min-h-[100dvh] bg-paper">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Logo url={brand.logoUrl} className="mb-6 h-14 max-w-[16rem]" alt={brand.eventName} />
        {brand.eventName && <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{brand.eventName}</p>}
        <h1 className="mt-4 font-display text-4xl text-slate-900 sm:text-5xl">Kølappsystem</h1>
        <p className="mt-4 max-w-xl text-slate-600">
          {stationsIntro(state?.stations.length ?? 3)} Publikum skanner QR-koden ved inngangen og følger med på sin egen kølapp.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {(state?.stations ?? []).map((s) => {
            return (
              <div key={s.id} className={`rounded-3xl border ${ST.border} ${ST.soft} p-5`} style={stationVars(s.color)}>
                <p className={`text-xs uppercase tracking-[0.25em] ${ST.text}`}>{stationLabel(s)}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{s.description}</p>
                <p className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                  {s.active ? "Åpen" : "Stengt"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/display" className={buttonClass("primary", "lg")}>
            <Monitor className="h-4 w-4" aria-hidden />
            Storskjerm
          </Link>
          <Link href="/operator?station=A" className={buttonClass("outline", "lg")}>
            <UserCog className="h-4 w-4" aria-hidden />
            Operator
          </Link>
          <Link href="/admin" className={buttonClass("outline", "lg")}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Admin
          </Link>
        </div>
      </div>
    </main>
  );
}
