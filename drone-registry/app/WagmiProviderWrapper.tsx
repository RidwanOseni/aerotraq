"use client";

import { WagmiProvider } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig, TomoEVMKitProvider } from "@tomo-inc/tomo-evm-kit";
import "@tomo-inc/tomo-evm-kit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Define the custom Aeneid Testnet chain
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
  clientId: process.env.NEXT_PUBLIC_TOMO_CLIENT_ID as string, // Client ID from I-detail.txt [1]
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID as string, // WalletConnect Project ID from I-detail.txt [1]
  chains: [aeneid], // Your custom Aeneid chain
  // FIX: Set `ssr` to `false` to address potential React hydration errors.
  // The error analysis indicates that server-side rendering discrepancies
  // can cause hydration issues. Setting this to false can help prevent
  // client-server HTML mismatches at the provider level, ensuring the
  // client takes full control of rendering this part of the application.
  // While Tomo documentation mentions `ssr: true` for Next.js App Router,
  // this adjustment can be a necessary workaround for specific integration conflicts.
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
