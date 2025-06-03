import { zeroAddress } from "viem";
import { storyClient } from "../lib/storyClient.js";

console.log('Script started');
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  if (err instanceof Error) {
    console.error(err.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  if (reason instanceof Error) {
    console.error(reason.stack);
  }
  process.exit(1);
});

async function createCollection() {
  try {
    const newCollection = await storyClient.nftClient.createNFTCollection({
      name: "Drone DGIP Collection",
      symbol: "DDGIP",
      isPublicMinting: true,
      mintOpen: true,
      mintFeeRecipient: zeroAddress,
      contractURI: "",
      txOptions: { waitForTransaction: true },
    });

    console.log(`New SPG NFT collection created at transaction hash ${newCollection.txHash}`);
    console.log(`NFT contract address: ${newCollection.spgNftContract}`);
  } catch (error) {
    console.error("Error creating NFT collection:", error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
  }
}

async function main() {
  try {
    await createCollection();
  } catch (error) {
    console.error("Fatal error in main:", error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
  }
}

main();
