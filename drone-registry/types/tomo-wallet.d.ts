export {};

// Declare global to extend the Window interface
declare global {
    interface Window {
      // tomo_ethereum is the EVM provider injected by Tomo Web SDK and Extension Wallet
      // Used for direct methods like getChainId, switchChain, signMessage, sendTransaction, request.
      // Based on "EVM Provider 
      tomo_ethereum?: {
        getChainId: () => Promise<number | string>;
        switchChain: (chainId: string) => Promise<void>;
        signMessage: (msg: string, address: string) => Promise<string>;
        signTypedData: (address: string, msg: string) => Promise<string>;
        sendTransaction: (params: EvmTxParams) => Promise<any>;
        request: <Result = any, Params = any>(
          request: RequestArguments<Params>,
          context?: any // Context parameter might be used internally by Tomo's request method
        ) => Promise<Result>;
        // Common event methods for Ethereum providers
        on?: (event: string, callback: (...args: any[]) => void) => void;
        removeListener?: (event: string, callback: (...args: any[]) => void) => void;
      };
  
      // tomo_evm is also injected by the Tomo Extension Wallet
      // Used for request methods and event listeners.
      // Based on "EVM Integration | Tomo Docs" 
      tomo_evm?: {
        request: <Result = any, Params = any>(
          request: RequestArguments<Params>
        ) => Promise<Result>;
        on: (event: string, callback: (...args: any[]) => void) => void;
        removeListener: (event: string, callback: (...args: any[]) => void) => void;
      };
    }
  }
  
  // Interfaces for EvmTxParams and RequestArguments as defined in Tomo Docs
  // from "EVM Provider | 
  interface EvmTxParams {
    from: string;
    to: string;
    value: string;
    gasPrice?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    data?: string;
  }
  
  interface RequestArguments<T = any> {
    method: string;
    params?: T;
    id?: number; // Optional ID for JSON-RPC requests
  }