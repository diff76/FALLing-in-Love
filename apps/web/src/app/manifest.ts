import type { MetadataRoute } from "next";

/** "Add to home screen": the paper-cut heart from the event poster as the app icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FALLing in Love · 2026 온출전",
    short_name: "FALLing in Love",
    description: "An Autumn Garden Matinée · 2026. 10. 11. 한신성전",
    start_url: "/",
    display: "standalone",
    background_color: "#FCF8F0",
    theme_color: "#2E251C",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
