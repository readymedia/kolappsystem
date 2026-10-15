"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Skalerer et 1600×900-felt (storskjerm) ned til tilgjengelig bredde. Brukes i admin («Skjermer», «Utseende»). */
export function ScaledPreview({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / 1600);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={box}
      className={`relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 ${className}`}
      data-testid="display-preview"
      aria-label={label}
    >
      <div className="pointer-events-none absolute left-0 top-0 h-[900px] w-[1600px] origin-top-left" style={{ transform: `scale(${scale})` }} inert>
        {children}
      </div>
    </div>
  );
}
