import { http } from "viem";
import { privateKeyToAccount, Address } from "viem/accounts";
import { StoryClient, StoryConfig } from "@story-protocol/core-sdk";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Retrieve private key and RPC URL from environment variables
const privateKey = process.env.WALLET_PRIVATE_KEY as Address;
const rpcProviderUrl = process.env.RPC_PROVIDER_URL;

if (!privateKey) {
  throw new Error("WALLET_PRIVATE_KEY environment variable is not set.");
}

if (!rpcProviderUrl) {
  throw new Error("RPC_PROVIDER_URL environment variable is not set.");
}

// Initialize the account from the private key and export it
// This account object contains the wallet address used by the StoryClient for signing transactions.
export const account = privateKeyToAccount(privateKey); // MODIFIED LINE: Added 'export'

// Configure the Story Client
const config: StoryConfig = {
  account: account, // the account object from above
  transport: http(rpcProviderUrl),
  chainId: "aeneid", // Story Protocol testnet chain ID [2]
};

// Create and export the Story Client instance
export const storyClient = StoryClient.newClient(config);