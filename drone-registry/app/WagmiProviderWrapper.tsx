"use client"; // This directive is necessary for client-side components 

import { WagmiProvider } from 'wagmi'; // 
import { createConfig, http, createStorage } from '@wagmi/core'; // 
import { polygonAmoy } from 'wagmi/chains'; // 
import { injected } from 'wagmi/connectors'; // 

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
  chains: [polygonAmoy], // Uses polygonAmoy 
  // Define the connectors available for connecting wallets 
  connectors: [injected()], // Uses injected connector 
  // Define the transports (RPC URLs) for interacting with the chains 
  transports: {
    [polygonAmoy.id]: http("https://polygon-amoy-bor-rpc.publicnode.com"), // Uses http transport for Polygon Amoy 
  },
  // Configure storage to use sessionStorage with SSR fallback 
  // The storage parameter persists Config's State between sessions 
  storage: createStorage({
    storage: typeof window !== 'undefined' ? window.sessionStorage : noopStorage, // Conditional storage 
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