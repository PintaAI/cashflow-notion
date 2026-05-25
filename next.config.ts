import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Empty turbopack config to acknowledge Turbopack usage
  // PWA requires webpack, so builds will use webpack
  turbopack: {},
  allowedDevOrigins: ["jennie-linux.tail2268a1.ts.net"],
};

export default withPWA(nextConfig);
