import { NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { getVapidPublicKey } from "@/lib/push";
import { DEFAULT_CONFIG, getSiteConfig, toPublicConfig } from "@/lib/site-config";

// Offentlig konfig for lydside, storskjerm og kølapp (lyd, overskrift, utseende, push). Ingen hemmeligheter.
// Mellomlagres 5 s på Vercel CDN, så mange skjermer deler ett databasekall.

export const dynamic = "force-dynamic";

const CACHE = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "CDN-Cache-Control": "public, s-maxage=5, stale-while-revalidate=5",
};

export async function GET() {
  try {
    const config = await getSiteConfig();
    return NextResponse.json(toPublicConfig(config, config.pushEnabled ? await getVapidPublicKey() : null), { headers: CACHE });
  } catch (err) {
    if (!(err instanceof DatabaseNotConfiguredError)) console.error("[api] /api/config", err);
    // Uten database: standardoppførsel, men ikke mellomlagret.
    return NextResponse.json(toPublicConfig(DEFAULT_CONFIG), { headers: { "Cache-Control": "no-store" } });
  }
}
