import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoids SegmentViewNode / webpack manifest corruption during HMR on Windows.
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
