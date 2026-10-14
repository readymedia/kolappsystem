import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kølapp – Meet & Greet",
    short_name: "KøKlar",
    description: "Digitalt kølappsystem for meet-and-greet med tre stasjoner.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: "#0f172a",
    lang: "nb",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
