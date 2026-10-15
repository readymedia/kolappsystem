import { getBranding } from "@/lib/branding-server";

// Eget manifest per kølapp (v1.5): «Legg til på Hjem-skjerm» på iPhone åpner da akkurat denne lappen
// (Hjem-skjerm-appen har egen lagring og vet ellers ikke hvilken lapp gjesten har). Push på iPhone krever dette.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!UUID.test(id)) return new Response("Ikke funnet", { status: 404 });
  const { eventName, primaryColor } = await getBranding();
  const manifest = {
    name: eventName ? `Kølapp – ${eventName}` : "Kølapp",
    short_name: "Kølapp",
    id: `/ticket/${id}`,
    start_url: `/ticket/${id}`,
    scope: "/",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: primaryColor,
    lang: "nb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
