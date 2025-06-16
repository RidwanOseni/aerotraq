import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add this line to transpile wagmi, viem, and Tomo packages
  // This helps resolve CommonJS/ESM interoperability issues in Next.js
  transpilePackages: [
    'wagmi',
    '@wagmi/core',
    'viem',
    '@tomo-inc/tomo-evm-kit',
    '@tomo-wallet/uikit-lite',
    '@tomo-inc/shared-type',
  ],
};