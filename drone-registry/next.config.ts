import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add this line to transpile wagmi and viem packages
  // This helps resolve CommonJS/ESM interoperability issues in Next.js
  transpilePackages: ['wagmi', '@wagmi/core', 'viem'],
};

export default nextConfig;