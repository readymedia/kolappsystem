import { NextResponse } from "next/server";
import { getMedia } from "@/lib/site-config";

// Serverer opplastede filer (lyd, logo). Adressen inneholder innholdets sha256, så filen kan
// mellomlagres «for alltid» – ny fil gir ny adresse. Sandbox-CSP: en SVG kan aldri kjøre skript.

export async function GET(_req: Request, { params }: { params: Promise<{ sha: string }> }) {
  try {
    const file = await getMedia((await params).sha);
    if (!file) return new NextResponse("Ikke funnet", { status: 404, headers: { "Cache-Control": "no-store" } });
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(file.bytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (err) {
    console.error("[api] /api/media", err);
    return new NextResponse("Feil", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
