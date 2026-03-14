import type { NextConfig } from "next";
import withWebspatial from "@webspatial/next-plugin";

const nextConfig: NextConfig = withWebspatial()({
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
});

export default nextConfig;
