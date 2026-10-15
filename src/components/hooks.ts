"use client";

import { useEffect, useRef } from "react";

/**
 * Kaller fn straks og deretter hvert intervall så lenge siden er synlig.
 * Pauser når fanen er skjult eller telefonen er låst (sparer kall på Vercel Hobby),
 * og henter på nytt med en gang siden blir synlig igjen.
 *
 * Robust mot alt som kan stoppe oppdateringen:
 * - en ny runde planlegges ALLTID, også om fn kaster en feil (ellers stopper siden til den lastes på nytt)
 * - våkner på visibilitychange, focus, pageshow (tilbake-knapp / bfcache) og online (nettet tilbake),
 *   fordi ikke alle nettlesere sender visibilitychange ved bytte av vindu eller opplåsing av telefon
 * - et «vekk» mens en runde pågår gir en ny runde rett etter, så ingen oppdatering går tapt
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
    let pending = false;
    let stopped = false;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(() => void tick(), ms);
    };

    const tick = async () => {
      if (stopped) return;
      if (running) {
        pending = true;
        return;
      }
      if (document.visibilityState !== "visible") {
        schedule(intervalMs);
        return;
      }
      running = true;
      try {
        await fnRef.current();
      } catch (err) {
        console.warn("[polling] runde feilet, prøver igjen", err);
      } finally {
        running = false;
      }
      if (pending) {
        pending = false;
        schedule(0);
      } else {
        schedule(intervalMs);
      }
    };

    const wake = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void tick();
    };

    void tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("online", wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("online", wake);
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
