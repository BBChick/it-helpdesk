import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactCompiler: true,
  output: 'export',
  images: {
    unoptimized: true,
  }
};

export default nextConfig;
