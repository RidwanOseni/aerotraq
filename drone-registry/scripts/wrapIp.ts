import { storyClient } from '../lib/storyClient.js'; 

// Import 'parseEther' from 'viem' to convert a human-readable number
// into a BigInt suitable for blockchain transactions (e.g., 0.1 IP to 100000000000000000). [4]
import { parseEther } from 'viem'; 

/**
 * Wraps a specified amount of native IP tokens into $WIP (Wrapped IP) tokens.
 * This process uses the Story Protocol SDK's WipClient.deposit method.
 */
async function wrapIp() {
  try {
    // Define the amount of native IP tokens you want to wrap into $WIP.
    // The Story Aeneid Testnet Faucet provides 10 IP. [5]
    // A small amount like 0.1 IP is suitable for testing to ensure you have enough
    // IP for gas fees for this transaction and future transactions. [6]
    const amountToWrap = parseEther("2"); // Example: Wrap 0.1 native IP tokens

    console.log(`Attempting to wrap ${amountToWrap / 10n**18n} IP to $WIP...`);

    // Call the 'deposit' method of the WipClient.
    // This sends a transaction to the Story Protocol network to perform the wrapping. [4]
    const response = await storyClient.wipClient.deposit({
      amount: amountToWrap,
      txOptions: { waitForTransaction: true }, // It's recommended to wait for the transaction to be mined for confirmation. [4]
    });

    console.log(`Successfully wrapped IP to $WIP!`);
    console.log(`Transaction Hash: ${response.txHash}`);
    // You can use the Aeneid Testnet explorer to view your transaction. [7]
    console.log(`View transaction on explorer: https://aeneid.storyscan.io/tx/${response.txHash}`); 

  } catch (error) {
    console.error("Error wrapping IP to $WIP:", error);
    // Provide more specific error details if available for debugging.
    if (error instanceof Error) {
      console.error("Detailed error message:", error.message);
    }
  }
}

// Execute the function to initiate the IP wrapping process.
wrapIp();