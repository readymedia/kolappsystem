import type { NextConfig } from "next";

// Sikkerhetshoder for alle sider og API-er. Ingen eksterne skript, fonter eller bilder brukes.
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  // Next.js trenger inline-skript for hydrering; 'unsafe-eval' kun i utvikling.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  // Lydsignal: lydfiler fra egen app (blob: for lengdesjekk ved opplasting i admin), Web Worker for lydsiden.
  "media-src 'self' blob:",
  "worker-src 'self'",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Hoder for alle svar. CSP settes separat: opplastede filer (/api/media) skal ha sin egen, strengere CSP.
// (Hoder herfra overstyrer hoder satt i ruten, så sandbox-CSP-en må settes her – rettet i v1.4.)
const commonHeaders = [
  // Nøkkelen står i QR-lenken: send aldri adressen videre til andre nettsteder.
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    // Lydsiden het «/audiosignal» i bestillingen – begge adresser virker.
    return [{ source: "/audiosignal", destination: "/audio", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: commonHeaders },
      // Service worker for push (v1.5): alltid ny versjon, aldri mellomlagret.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      { source: "/:path((?!api/media/).*)", headers: [{ key: "Content-Security-Policy", value: csp }] },
      // Opplastede filer (lyd, logo): kan aldri kjøre skript eller hente noe, selv om de åpnes direkte.
      {
        source: "/api/media/:sha*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; sandbox" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
