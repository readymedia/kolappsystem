"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_BRANDING, type Branding } from "@/lib/branding";

// Utseendet fra rotlayouten, tilgjengelig for klientkomponenter (navn og logo).

const BrandingContext = createContext<Branding>(DEFAULT_BRANDING);

export function BrandingProvider({ value, children }: { value: Branding; children: ReactNode }) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): Branding {
  return useContext(BrandingContext);
}

/** Logo som <img> (aldri inline SVG). Vises ikke når ingen logo er lastet opp. */
export function Logo({ url, className = "h-10", alt = "" }: { url: string | null; className?: string; alt?: string }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- egen fil fra /api/media, ikke next/image (ingen ekstra kvote)
  return <img src={url} alt={alt} className={`w-auto object-contain ${className}`} data-testid="brand-logo" />;
}
