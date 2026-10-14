import QRCode from "qrcode";
import { fail, handle, ok } from "@/lib/http";
import { getAdminStations } from "@/lib/queue";

// Admin: stasjoner med hemmelig nøkkel, join-lenke og QR-kode (SVG laget her, aldri hos tredjepart).

export async function GET(req: Request) {
  return handle(req, { requireSession: true }, async () => {
    // QR skal alltid peke på produksjonsadressen, også om admin åpnes fra en forhåndsvisning.
    // Rekkefølge: PUBLIC_BASE_URL > Vercel sitt produksjonsdomene > adressen admin bruker nå.
    const origin = (
      process.env.PUBLIC_BASE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
      (req.headers.get("x-forwarded-host")
        ? `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host")}`
        : new URL(req.url).origin)
    ).replace(/\/$/, "");
    const stations = await getAdminStations();
    if (!stations) return fail("server_error");
    const withQr = await Promise.all(
      stations.map(async (s) => {
        const joinUrl = `${origin}/join?station=${s.id}&key=${encodeURIComponent(s.joinKey)}`;
        const qrSvg = await QRCode.toString(joinUrl, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
        return { id: s.id, description: s.description, active: s.active, waitingCount: s.waitingCount, issued: s.issued, joinUrl, qrSvg };
      }),
    );
    return ok({ stations: withQr });
  });
}
