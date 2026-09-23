import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // dev servers are opened from phones on the LAN and through the cloudflared tunnel
  allowedDevOrigins: ["192.168.1.162", "192.168.50.54", "*.trycloudflare.com"],
  transpilePackages: ["@fil/config", "@fil/domain", "@fil/supabase"],
  images: { formats: ["image/avif", "image/webp"] },
};

export default nextConfig;
