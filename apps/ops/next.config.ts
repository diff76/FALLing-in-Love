import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker needs the standalone bundle; Vercel builds its own output and breaks on it (missing .nft.json).
  output: process.env.VERCEL ? undefined : "standalone",
  // dev servers are opened from phones on the LAN and through the cloudflared tunnel
  allowedDevOrigins: ["192.168.1.162", "192.168.50.54", "*.trycloudflare.com"],
  transpilePackages: ["@fil/config", "@fil/domain", "@fil/supabase"],
  headers: async () => [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }],
};

export default nextConfig;
