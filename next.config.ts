import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // Empty turbopack config to acknowledge Turbopack usage
  // PWA requires webpack, so builds will use webpack
  turbopack: {},
  allowedDevOrigins: ["jennie-linux.tail2268a1.ts.net"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
} as NextConfig;

export default withPWA(nextConfig);
