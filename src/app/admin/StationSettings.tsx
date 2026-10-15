"use client";

import { Archive, ArrowLeft, ArrowRight, Check, Settings2 } from "lucide-react";
import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { PALETTE, PALETTE_IDS, stationShades } from "@/lib/stations";

// Stasjonsinnstillinger i admin (v1.6): navn, farge, rekkefølge og arkivering. Skjult bak «Innstillinger»
// så kortet holder seg ryddig. Koden (A, B …) kan aldri endres – den står i QR-koder og på lapper.

export interface StationSettingsProps {
  id: string;
  name: string;
  color: string;
  isFirst: boolean;
  isLast: boolean;
  /** Antall ventende – arkivering krever tom kø. */
  waitingCount: number;
  /** Sluttid «16:00» og maks i kø (v1.8), eller null. */
  serviceEnd: string | null;
  maxWaiting: number | null;
  onAction: (action: string, json?: unknown) => Promise<unknown>;
}

export function StationSettings({ id, name, color, isFirst, isLast, waitingCount, serviceEnd, maxWaiting, onAction }: StationSettingsProps) {
  const [endDraft, setEndDraft] = useState(serviceEnd ?? "");
  const [maxDraft, setMaxDraft] = useState(maxWaiting === null ? "" : String(maxWaiting));
  const [applyAll, setApplyAll] = useState(false);
  const [limitsSaved, setLimitsSaved] = useState(false);
  const maxValid = maxDraft === "" || (/^\d+$/.test(maxDraft) && Number(maxDraft) >= 1 && Number(maxDraft) <= 10000);
  const limitsDirty = applyAll || endDraft !== (serviceEnd ?? "") || maxDraft !== (maxWaiting === null ? "" : String(maxWaiting));
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftColor, setDraftColor] = useState(color);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = draftName.trim() !== name || draftColor !== color;
  const custom = !PALETTE[draftColor];

  async function run(action: string, json?: unknown) {
    setBusy(true);
    await onAction(action, json);
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className={`${buttonClass("ghost", "sm")} mt-2`}
        onClick={() => {
          setDraftName(name);
          setDraftColor(color);
          setEndDraft(serviceEnd ?? "");
          setMaxDraft(maxWaiting === null ? "" : String(maxWaiting));
          setApplyAll(false);
          setOpen(true);
        }}
      >
        <Settings2 className="h-4 w-4" aria-hidden />
        Navn, farge, sluttid og rekkefølge …
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-slate-200 p-3" data-testid={`station-settings-${id}`}>
      <label className="block text-sm font-medium text-slate-800">
        Navn
        <input
          value={draftName}
          onChange={(e) => {
            setDraftName(e.target.value);
            setSaved(false);
          }}
          maxLength={40}
          placeholder={`Stasjon ${id}`}
          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal"
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Tomt = «Stasjon {id}». Koden {id} står på lappene ({id}1, {id}2 …) og endres aldri.
        </span>
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Farge</legend>
        <div className="mt-2 grid grid-cols-6 gap-2">
          {PALETTE_IDS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setDraftColor(c);
                setSaved(false);
              }}
              aria-label={PALETTE[c]!.label}
              aria-pressed={draftColor === c}
              title={PALETTE[c]!.label}
              className={`flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ${draftColor === c ? "ring-2 ring-slate-900" : ""}`}
              style={{ background: PALETTE[c]!.solid }}
            >
              {draftColor === c && <Check className="h-4 w-4 text-white" aria-hidden />}
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          Egen farge
          <input
            type="color"
            value={custom ? draftColor : stationShades(draftColor).solid}
            onChange={(e) => {
              setDraftColor(e.target.value.toLowerCase());
              setSaved(false);
            }}
            className="h-7 w-10 cursor-pointer rounded border border-slate-200 bg-white"
            aria-label="Egen farge"
          />
          {custom && <span className="font-mono">{draftColor}</span>}
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !dirty}
          className={buttonClass("primary", "sm")}
          onClick={async () => {
            await run("meta", { name: draftName.trim(), color: draftColor });
            setSaved(true);
          }}
        >
          {saved && !dirty ? "Lagret" : "Lagre"}
        </button>
        <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setOpen(false)}>
          Lukk
        </button>
      </div>

      <fieldset className="space-y-2 border-t border-slate-100 pt-3">
        <legend className="text-sm font-medium text-slate-800">Sluttid og kapasitet</legend>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="block">
            <span className="text-xs text-slate-600">Siste betjening kl.</span>
            <input
              type="time"
              value={endDraft}
              onChange={(e) => {
                setEndDraft(e.target.value);
                setLimitsSaved(false);
              }}
              className="mt-1 block h-9 rounded-lg border border-slate-200 px-2"
              aria-label="Siste betjening"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Maks i kø</span>
            <input
              value={maxDraft}
              onChange={(e) => {
                setMaxDraft(e.target.value.replace(/\D/g, ""));
                setLimitsSaved(false);
              }}
              inputMode="numeric"
              placeholder="Ingen"
              className="mt-1 block h-9 w-20 rounded-lg border border-slate-200 px-2"
              aria-label="Maks i kø"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
          Bruk på alle stasjoner
        </label>
        <p className="text-xs text-slate-500">
          Tomt = ingen grense. Nye gjester får «Køen er full» når de ikke rekker fram før sluttid, eller når køen er full. De som står i
          kø beholder plassen.
        </p>
        <button
          type="button"
          disabled={busy || !limitsDirty || !maxValid}
          className={buttonClass("outline", "sm")}
          onClick={async () => {
            await run("limits", { serviceEnd: endDraft, maxWaiting: maxDraft === "" ? null : Number(maxDraft), applyToAll: applyAll });
            setApplyAll(false);
            setLimitsSaved(true);
          }}
        >
          {limitsSaved && !limitsDirty ? "Lagret" : applyAll ? "Lagre for alle stasjoner" : "Lagre sluttid og kapasitet"}
        </button>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">Rekkefølge</span>
        <button type="button" disabled={busy || isFirst} className={buttonClass("outline", "sm")} onClick={() => run("move-up")} aria-label="Flytt til venstre">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" disabled={busy || isLast} className={buttonClass("outline", "sm")} onClick={() => run("move-down")} aria-label="Flytt til høyre">
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="border-t border-slate-100 pt-3">
        {waitingCount > 0 ? (
          <p className="text-xs text-slate-500">Arkivering krever tom kø ({waitingCount} venter). Nullstill køen først.</p>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              className={buttonClass(confirmArchive ? "danger" : "ghost", "sm")}
              onClick={() => (confirmArchive ? run("archive") : setConfirmArchive(true))}
            >
              <Archive className="h-4 w-4" aria-hidden />
              {confirmArchive ? `Bekreft – arkiver stasjon ${id}` : "Arkiver stasjon …"}
            </button>
            {confirmArchive && (
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setConfirmArchive(false)}>
                Avbryt
              </button>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Skjules overalt, og QR-koden slutter å virke. Kan hentes tilbake under «Arkiverte stasjoner».
            </p>
          </>
        )}
      </div>
    </div>
  );
}
