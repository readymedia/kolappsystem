import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
// Valgfrie fonter for «Utseende» (v1.4). Nettleseren laster bare ned fonter som faktisk brukes.
import "@fontsource-variable/manrope";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/source-sans-3";
import "@fontsource-variable/work-sans";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { BrandingProvider } from "@/components/BrandingContext";
import { brandingVars } from "@/lib/branding";
import { getBranding } from "@/lib/branding-server";

export async function generateMetadata(): Promise<Metadata> {
  const { eventName } = await getBranding();
  // Sidene setter bare første del («Storskjerm»); arrangementsnavnet legges til her.
  return {
    ...metadata,
    title: eventName ? { default: `Kølapp – ${eventName}`, template: `%s – ${eventName}` } : { default: "Kølapp", template: "%s" },
  };
}

const metadata: Metadata = {
  description:
    "Digitalt kølappsystem for meet-and-greet. Skann QR-koden, få din kølapp og følg køen på mobilen.",
  applicationName: "KøKlar",
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "KøKlar", statusBarStyle: "black" },
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();
  return (
    <html lang="nb" style={brandingVars(branding) as CSSProperties}>
      <body>
        <BrandingProvider value={branding}>{children}</BrandingProvider>
      </body>
    </html>
  );
}
