import type { MetadataRoute } from "next";
import { BRAND, BRAND_ASSETS } from "@/content/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/today",
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.description,
    lang: BRAND.locale,
    dir: "ltr",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND.colors.paper,
    theme_color: BRAND.colors.paper,
    categories: ["health", "fitness", "food", "lifestyle"],
    icons: [
      { src: BRAND_ASSETS.appIcon, sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: BRAND_ASSETS.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: BRAND_ASSETS.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: BRAND_ASSETS.iconMaskable512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: BRAND_ASSETS.appIconMaskable,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Heute", url: "/today" },
      { name: "Essen loggen", short_name: "Loggen", url: "/log" },
      { name: "Tagebuch", url: "/diary" },
      { name: "Gewicht", url: "/progress/weight" },
    ],
  };
}
