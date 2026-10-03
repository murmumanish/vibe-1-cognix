import type { NextConfig } from "next";
import dns from "node:dns";

// Ensure Node process uses Google & Cloudflare DNS for MongoDB SRV resolution
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore if restricted
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mongoose", "bcryptjs"],
};

export default nextConfig;
