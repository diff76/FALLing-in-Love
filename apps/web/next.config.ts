import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker needs the standalone bundle; Vercel builds its own output and breaks on it (missing .nft.json).
  output: process.env.VERCEL ? undefined : "standalone",
  // dev servers are opened from phones on the LAN and through the cloudflared tunnel
  allowedDevOrigins: ["192.168.1.162", "192.168.50.54", "*.trycloudflare.com"],
  transpilePackages: ["@fil/config", "@fil/domain", "@fil/supabase"],
  images: { formats: ["image/avif", "image/webp"] },
  // Clips, frames and posters are large and rarely change: let the CDN and phones keep them a day.
  headers: async () => [
    { source: "/media/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
  ],
};

export default nextConfig;
