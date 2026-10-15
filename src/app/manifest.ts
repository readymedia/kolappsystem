import type { MetadataRoute } from "next";
import { getBranding } from "@/lib/branding-server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { eventName, primaryColor } = await getBranding();
  return {
    name: eventName ? `Kølapp – ${eventName}` : "Kølapp",
    short_name: "KøKlar",
    description: "Digitalt kølappsystem for meet-and-greet.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: primaryColor,
    lang: "nb",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
