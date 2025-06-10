import { storyClient } from '../lib/storyClient.js'; // Import your configured Story Protocol client [8]
import { Address, zeroAddress } from 'viem'; // Import Address type and zeroAddress for comparison [8, 14]

/**
 * Checks the royalty vault address for a given IP Asset ID using the Story Protocol SDK.
 * If the returned address is the zero address, it indicates no valid vault is associated. [Previous Turn]
 */
async function checkRoyaltyVaultAddress() {
  // Replace this with your actual IP Asset ID.
  // The IP ID you provided was: 0xA5f62bF3cc325A5154FF3d0f8CfB7D2d45A611bF [Your Query]
  const targetIpId: Address = "0xA5f62bF3cc325A5154FF3d0f8CfB7D2d45A611bF";

  console.log(`Attempting to retrieve royalty vault address for IP ID: ${targetIpId}`);

  try {
    // Call the 'getRoyaltyVaultAddress' method of the RoyaltyClient [15]
    const royaltyVaultAddress = await storyClient.royalty.getRoyaltyVaultAddress(targetIpId);

    console.log(`Royalty Vault Address for IP ID ${targetIpId}: ${royaltyVaultAddress}`);

    // Check if the returned address is the zero address [Previous Turn]
    if (royaltyVaultAddress === zeroAddress) {
      console.log(`\n**IMPORTANT:** The returned royalty vault address is the zero address.`);
      console.log(`This indicates that, for some reason, the Royalty Module does not yet have`);
      console.log(`a valid, non-zero vault associated with IP ID: ${targetIpId}.`);
      console.log(`This might be due to asynchronous initialization or an issue with royalty policy linkage. [Previous Turn]`);
    } else {
      console.log(`\nSuccessfully retrieved a non-zero royalty vault address.`);
      console.log(`The royalty vault is active and ready to receive/manage revenues.`);
      // You can view this address on the explorer (e.g., Aeneid Storyscan.io or Blockscout)
      console.log(`You can inspect this address on the Aeneid explorer: https://aeneid.storyscan.io/address/${royaltyVaultAddress}`);
    }
  } catch (error) {
    console.error(`Error retrieving royalty vault address for IP ID ${targetIpId}:`, error);
    if (error instanceof Error) {
      console.error("Detailed error message:", error.message);
    }
  }
}

// Execute the function to initiate the check
checkRoyaltyVaultAddress();