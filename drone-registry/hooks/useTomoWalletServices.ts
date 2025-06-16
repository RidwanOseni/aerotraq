'use client';

import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { WebWalletInvokeType } from '@tomo-inc/tomo-evm-kit';
import { toast } from 'sonner';

// Define a type for the Tomo SDK core methods expected to be on the provider.
// This interface explicitly tells TypeScript about the 'handleWebWalletInvoke' function.
interface TomoProviderCore {
  handleWebWalletInvoke: (type: WebWalletInvokeType) => void;
}

// Define a type for the provider object returned by connector.getProvider().
// This extends the default provider type (implicitly 'any' or a generic object)
// to include the 'core' property, which holds the Tomo SDK instance.
interface TomoEnhancedProvider {
  core?: TomoProviderCore;
  // You might extend this with other properties from the base provider if needed for other interactions.
}

export const useTomoWalletServices = () => {
  const { connector, isConnected } = useAccount(); // Get isConnected here for a more comprehensive check

  const invokeTomoService = useCallback(async (type: WebWalletInvokeType) => {
    // Ensure wallet is connected before attempting to get the provider
    if (!isConnected) {
      toast.error("Please connect your wallet to use this service.");
      return;
    }

    // Ensure the connector itself is available
    if (!connector) {
      toast.error("Wallet connector not available. Please try reconnecting.");
      return;
    }

    try {
      // Safely retrieve the provider. It's possible for getProvider() to return null or undefined
      // if the connector isn't fully initialized or ready.
      const provider = await connector.getProvider() as TomoEnhancedProvider | null | undefined;

      if (!provider) {
        toast.error("Wallet provider not found. Please try reconnecting your wallet.");
        console.error("Tomo Enhanced Provider (from connector.getProvider()) is null or undefined.");
        return; // Halt if provider is not available
      }

      // Access the Tomo SDK core from the provider
      const tomoSDK = provider.core;

      if (tomoSDK && typeof tomoSDK.handleWebWalletInvoke === 'function') {
        tomoSDK.handleWebWalletInvoke(type); // Call the Tomo SDK method
      } else {
        // This block is executed if tomoSDK is null/undefined or if handleWebWalletInvoke isn't a function
        toast.error("Tomo SDK for internal wallet services is not available or correctly initialized with your current connection.");
        console.error("Tomo SDK core or handleWebWalletInvoke missing:", tomoSDK);
        // Provide a hint about social login, as per Tomo documentation
        if (isConnected && !tomoSDK) {
          toast.info("These services may require connecting via Tomo's social login option.");
        }
      }
    } catch (error: any) {
      toast.error(`Failed to open ${type} service: ${error.message || "An unexpected error occurred."}`);
      console.error(`Error invoking Tomo ${type} service:`, error);
    }
  }, [connector, isConnected]); // Added isConnected to dependencies for accurate re-evaluation

  const openSwap = useCallback(() => {
    invokeTomoService(WebWalletInvokeType.SWAP);
  }, [invokeTomoService]);

  const openOnRamp = useCallback(() => {
    invokeTomoService(WebWalletInvokeType.ONRAMP);
  }, [invokeTomoService]);

  const openSend = useCallback(() => {
    invokeTomoService(WebWalletInvokeType.SEND);
  }, [invokeTomoService]);

  const openReceive = useCallback(() => {
    invokeTomoService(WebWalletInvokeType.RECEIVE);
  }, [invokeTomoService]);

  return {
    openSwap,
    openOnRamp,
    openSend,
    openReceive,
  };
};
