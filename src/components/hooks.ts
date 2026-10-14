"use client";

import { useEffect, useRef } from "react";

/**
 * Kaller fn straks og deretter hvert intervall så lenge siden er synlig.
 * Pauser når fanen er skjult eller telefonen er låst (sparer kall på Vercel Hobby),
 * og henter på nytt med en gang siden blir synlig igjen.
 */
export function usePolling(fn: () => void | Promise<void>, intervalMs: number, enabled = true): void {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let stopped = false;

    const tick = async () => {
      if (stopped || running) return;
      if (document.visibilityState === "visible") {
        running = true;
        try {
          await fnRef.current();
        } finally {
          running = false;
        }
      }
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void tick();
      }
    };

    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled]);
}

/** Holder skjermen våken (Screen Wake Lock API) der det støttes. Stille feil der det ikke gjør. */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        if (document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen");
      } catch {
        // Ikke støttet eller nektet – helt greit.
      }
    };
    const onVisible = () => {
      if (!cancelled && document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}
