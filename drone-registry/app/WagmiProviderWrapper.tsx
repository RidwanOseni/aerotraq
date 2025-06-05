"use client";

import { WagmiProvider } from 'wagmi';
import { createConfig, http, createStorage } from '@wagmi/core';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem'; // Import defineChain from viem

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

// Custom no-op storage for SSR fallback
// It provides the necessary methods (getItem, setItem, removeItem) but does nothing,
// making it safe to use in SSR environments where `window.sessionStorage` is not available
const noopStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => { /* do nothing */ },
  removeItem: (_key: string) => { /* do nothing */ },
};

// Define the Wagmi configuration
const config = createConfig({
  // Define the chains supported by the app
  chains: [aeneid], // Replaced polygonAmoy with custom aeneid chain
  // Define the connectors available for connecting wallets
  connectors: [injected()],
  // Define the transports (RPC URLs) for interacting with the chains
  transports: {
    [aeneid.id]: http(aeneid.rpcUrls.default.http), // Use the RPC URL from the aeneid chain definition
  },
  // Configure storage to use sessionStorage with SSR fallback
  // The storage parameter persists Config's State between sessions
  storage: createStorage({
    storage: typeof window !== 'undefined' ? window.sessionStorage : noopStorage,
  }),
  ssr: true, // Flag indicating server-side rendering environment. Necessary for Next.js App Router
});

// This component wraps the application to provide the Wagmi context
export default function WagmiProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Provide the configured Wagmi client to the application
    <WagmiProvider config={config}>
      {children}
    </WagmiProvider>
  );
}