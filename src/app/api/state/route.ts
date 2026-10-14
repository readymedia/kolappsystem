import { fail, handle, ok } from "@/lib/http";
import { getPublicState } from "@/lib/queue";

// Delt, offentlig køstatus for alle stasjoner. Brukes av /ticket, /display og forsiden.
// Mellomlagres 1 sekund på Vercel CDN, så hundrevis av telefoner deler ett databasekall per sekund.
// Viktig for Vercel Hobby (begrenset antall funksjonskall per måned).

export const dynamic = "force-dynamic";

const CACHE = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "CDN-Cache-Control": "public, s-maxage=1, stale-while-revalidate=1",
};

export async function GET(req: Request) {
  return handle(req, {}, async () => {
    const state = await getPublicState();
    return state ? ok(state, CACHE) : fail("server_error");
  });
}
