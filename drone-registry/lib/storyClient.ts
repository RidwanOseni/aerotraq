import path from "path";
import { fileURLToPath } from "url";
import { http } from "viem";
import { privateKeyToAccount, Address } from "viem/accounts";
import { StoryClient, StoryConfig } from "@story-protocol/core-sdk";
import dotenv from "dotenv";

// ⛑ Recreate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('storyClient __dirname:', __dirname);
console.log('Expected .env path:', path.resolve(__dirname, '../.env'));

// Load env vars from correct path
dotenv.config({ path: path.resolve(__dirname, "../.env") });

console.log('Loaded WALLET_PRIVATE_KEY:', process.env.WALLET_PRIVATE_KEY ? '[set]' : '[NOT SET]');
console.log('Loaded RPC_PROVIDER_URL:', process.env.RPC_PROVIDER_URL ? '[set]' : '[NOT SET]');

// Ensure required env vars are present
const privateKey = process.env.WALLET_PRIVATE_KEY as Address;
const rpcProviderUrl = process.env.RPC_PROVIDER_URL;

if (!privateKey) {
  throw new Error("WALLET_PRIVATE_KEY environment variable is not set.");
}

if (!rpcProviderUrl) {
  throw new Error("RPC_PROVIDER_URL environment variable is not set.");
}

// Setup Story Client
const account = privateKeyToAccount(privateKey);

const config: StoryConfig = {
  account,
  transport: http(rpcProviderUrl),
  chainId: "aeneid", // Story Protocol testnet
};

export const storyClient = StoryClient.newClient(config);
