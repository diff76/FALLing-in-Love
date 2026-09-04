import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@fil/config", "@fil/domain", "@fil/supabase"],
  images: { formats: ["image/avif", "image/webp"] },
};

export default nextConfig;
