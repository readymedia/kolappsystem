import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Kølapp – Meet & Greet",
  description:
    "Digitalt kølappsystem for meet-and-greet med tre stasjoner. Skann QR-koden, få din kølapp og følg køen på mobilen.",
  applicationName: "KøKlar",
  appleWebApp: { capable: true, title: "KøKlar", statusBarStyle: "black" },
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
