import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The first two games and their design notes were replaced. Old links land on the games page.
  async redirects() {
    return ["signal", "warmup", "design"].map((slug) => ({ source: `/play/${slug}`, destination: "/play", permanent: false }));
  },
};

export default nextConfig;
