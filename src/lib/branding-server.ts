import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { DEFAULT_BRANDING, type Branding } from "./branding";
import { getSiteConfig, toBranding } from "./site-config";

// Utseendet leses av rotlayouten på hver side. Det mellomlagres i Next.js datacache (tag «branding»),
// så besøkende koster ingen databasekall. Lagring i admin kaller brandingChanged().

const TAG = "branding";

// Mellomlagringen overlever nye deployer på Vercel. Endres formen på Branding, øk «branding-vN»
// så en ny versjon ikke leser gammel form.
const cached = unstable_cache(async () => toBranding(await getSiteConfig()), ["branding-v1"], {
  tags: [TAG],
  // Sikkerhetsnett: hentes uansett på nytt hvert 5. minutt.
  revalidate: 300,
});

/** Utseendet, eller standard hvis databasen ikke svarer (feil mellomlagres ikke). */
export async function getBranding(): Promise<Branding> {
  // Uten database (forhåndsvisning/bygg uten DATABASE_URL): standard, uten støy i byggloggen.
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return DEFAULT_BRANDING;
  try {
    return await cached();
  } catch {
    return DEFAULT_BRANDING;
  }
}

/** Kalles etter lagring i admin: nytt utseende på alle sider med en gang. */
export function brandingChanged(): void {
  revalidateTag(TAG, { expire: 0 });
  revalidatePath("/", "layout");
}
