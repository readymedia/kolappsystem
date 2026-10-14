"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { buttonClass, Card } from "./ui";

/** PIN-skjerm for /operator og /admin. Sjekken skjer på serveren; ved suksess lastes siden på nytt. */
export function PinGate({ title }: { title: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) return;
    setBusy(true);
    const res = await api("/api/auth/login", { method: "POST", json: { pin } });
    setBusy(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    setPin("");
    setError(res.message);
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-paper px-6">
      <Card className="w-full max-w-sm p-8 shadow-[0_25px_60px_-40px_rgba(15,23,42,0.4)]">
        <form onSubmit={submit} className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-900 text-white">
              <Lock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-lg text-slate-900">{title}</h1>
              <p className="text-sm text-slate-500">Skriv inn PIN-koden for å fortsette</p>
            </div>
          </div>
          <input
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            maxLength={12}
            placeholder="PIN"
            aria-label="PIN-kode"
            className="h-14 w-full rounded-xl border border-slate-200 px-3 text-center text-2xl tracking-[0.4em] outline-none focus:ring-2 focus:ring-slate-300"
          />
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={`${buttonClass("primary", "lg")} w-full rounded-xl`}>
            {busy ? "Sjekker …" : "Lås opp"}
          </button>
        </form>
      </Card>
    </main>
  );
}
