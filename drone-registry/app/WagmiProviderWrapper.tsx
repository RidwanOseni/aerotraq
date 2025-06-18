"use client";

import { WagmiProvider } from "wagmi";
import { defineChain } from "viem";
// TomoEVMKitProvider and getDefaultConfig are core components of Tomo's EVM Kit:
// - TomoEVMKitProvider: Provides Tomo's enhanced wallet features and UI components
// - getDefaultConfig: Configures Wagmi with Tomo's recommended settings and optimizations
import { getDefaultConfig, TomoEVMKitProvider } from "@tomo-inc/tomo-evm-kit";
import "@tomo-inc/tomo-evm-kit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Define the custom Aeneid Testnet chain
// This chain configuration is essential for interacting with Story Protocol's testnet
// Aeneid is Story Protocol's dedicated testnet for IP registration, licensing, and royalty management
const aeneid = defineChain({
  id: 1315, // Chain ID for Story Aeneid Testnet
  name: 'Story Aeneid Testnet', // Network Name
  nativeCurrency: {
    decimals: 18,
    name: 'IP', // The faucet provides IP tokens
    symbol: 'IP', // The faucet provides IP tokens
  },
  rpcUrls: {
    default: {
      http: ['https://aeneid.storyrpc.io'], // Official RPC URL for Aeneid Testnet
    },
  },
  blockExplorers: {
    default: {
      name: 'Storyscan',
      url: 'https://aeneid.storyscan.io', // Official Blockscout Explorer URL
    },
  },
});

// Tomo's getDefaultConfig handles most Wagmi configurations
const config = getDefaultConfig({
  appName: "Aerotraq", // Your application name
  // clientId and projectId are essential for Tomo's services:
  // - clientId: Enables Tomo's on-ramp and swap features
  // - projectId: Required for WalletConnect integration
  // Both should be stored in environment variables for security
  clientId: process.env.NEXT_PUBLIC_TOMO_CLIENT_ID as string, // Client ID from I-detail.txt [1]
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID as string, // WalletConnect Project ID from I-detail.txt [1]
  chains: [aeneid], // Your custom Aeneid chain
  // Setting ssr to false is a deliberate choice to prevent hydration issues:
  // - While Tomo recommends ssr: true for Next.js App Router
  // - This setting helps avoid client-server rendering mismatches
  // - Particularly important when dealing with wallet connection states
  ssr: false,
});

const queryClient = new QueryClient(); // Retain QueryClient from your original file

// This component wraps the application to provide the Wagmi and Tomo contexts
export default function WagmiProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Wrap WagmiProvider with QueryClientProvider and TomoEVMKitProvider
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TomoEVMKitProvider>
          {children}
        </TomoEVMKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
