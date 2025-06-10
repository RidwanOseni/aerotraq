import { NextRequest, NextResponse } from 'next/server';
import { storyClient, account } from '../../../lib/storyClient'; // MODIFIED LINE: Imported 'account'
import { Address, parseEther, zeroAddress } from 'viem';

// Define the $WIP Token Address for Story Protocol Aeneid Testnet.
// This address is standard for Story Protocol's testnet.
const WIP_TOKEN_ADDRESS = "0x1514000000000000000000000000000000000000" as Address; // [3]

export async function POST(request: NextRequest) {
  try {
    // This route expects to receive the IP Asset ID (ipId) of User A's DGIP
    // and the License Terms ID (licenseTermsId) from the frontend.
    const { ipId, licenseTermsId } = await request.json(); // [4]

    // Basic validation for the incoming IP ID
    if (!ipId || typeof ipId !== 'string' || !ipId.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid or missing IP ID.' }, { status: 400 }); // [4]
    }

    // Validate licenseTermsId as well
    if (licenseTermsId === null || typeof licenseTermsId !== 'number' || licenseTermsId < 0) {
      return NextResponse.json({ error: 'Invalid or missing License Terms ID.' }, { status: 400 }); // [5]
    }

    console.log(`Initiating royalty payment simulation for IP ID: ${ipId}`); // [5]

    // Fix for RoyaltyModule__ZeroReceiverVault() error:
    // Ensure the royalty vault is deployed by attempting to mint a license token
    // for the IP Asset if a vault is not yet associated.
    let royaltyVaultAddress: Address = zeroAddress;
    try {
      royaltyVaultAddress = await storyClient.royalty.getRoyaltyVaultAddress(ipId as Address); // [5]
      console.log(`Current Royalty Vault Address for ${ipId}: ${royaltyVaultAddress}`); // [5]
    } catch (vaultCheckError) {
      // Log the warning but don't stop here, as vault might just not be deployed yet.
      console.warn(`Could not retrieve royalty vault address initially: ${vaultCheckError}`); // [6]
    }

    if (royaltyVaultAddress === zeroAddress) {
      console.log(`Royalty vault not found for IP ID ${ipId}. Attempting to mint a license token to trigger vault deployment...`); // [6]

      try {
        const mintLicenseResponse = await storyClient.license.mintLicenseTokens({
          licensorIpId: ipId as Address, // [6]
          licenseTermsId: licenseTermsId, // [6]
          amount: 1, // Mint 1 license token to trigger vault deployment [6]
          maxMintingFee: 0n,
          maxRevenueShare: 100, // [7]
          // FIX: Use the storyClient's own account address as the receiver
          receiver: account.address, // MODIFIED LINE: Changed to 'account.address'
          txOptions: { waitForTransaction: true }, // [7]
        });

        console.log(`Successfully minted license token. Transaction Hash: ${mintLicenseResponse.txHash}`); // [7]

        // Re-check the vault address after minting to confirm deployment (optional but good practice)
        royaltyVaultAddress = await storyClient.royalty.getRoyaltyVaultAddress(ipId as Address); // [7]
        if (royaltyVaultAddress === zeroAddress) {
          throw new Error("Vault still not deployed after attempting to mint license token. Royalty payment will likely fail."); // [8]
        }
        console.log(`Royalty vault successfully deployed/found at: ${royaltyVaultAddress}`); // [8]

      } catch (mintError: any) {
        console.error(`Failed to mint license token to deploy royalty vault: ${mintError.message}`); // [8]
        return NextResponse.json({
          status: 'error',
          message: `Failed to prepare IP for royalty payment (minting license token failed): ${mintError.message}` // [8]
        }, { status: 500 }); // [9]
      }
    } else {
      console.log(`Royalty vault already exists for IP ID ${ipId}. Proceeding with payment.`); // [9]
    }

    // --- Trigger Royalty Payment using Story Protocol SDK ---
    const paymentAmount = parseEther("0.1"); // Simulate a fixed payment of 0.1 $WIP [9]
    const payRoyaltyResponse = await storyClient.royalty.payRoyaltyOnBehalf({
      receiverIpId: ipId as Address, // This is User A's IP Asset ID, receiving the royalty [9]
      payerIpId: zeroAddress, // Represents an external payer (User B) in this simulation [9]
      token: WIP_TOKEN_ADDRESS, // The currency token for the payment, which is $WIP [10]
      amount: paymentAmount, // The amount of $WIP tokens to pay [10]
      txOptions: { waitForTransaction: true }, // Wait for the transaction to be mined for confirmation [10]
    });

    console.log(`Royalty payment transaction sent. Transaction Hash: ${payRoyaltyResponse.txHash}`); // [10]

    // Return a success response to the frontend with the transaction hash
    return NextResponse.json({
      status: 'success',
      message: `Royalty payment simulated successfully for IP ID: ${ipId}`, // [10]
      txHash: payRoyaltyResponse.txHash, // [11]
    });

  } catch (error: any) {
    // Handle any errors that occur during the API call or Story Protocol interaction
    console.error("Error in simulate-royalty-payment API route:", error); // [11]
    return NextResponse.json({
      status: 'error',
      message: error.message || "An unexpected error occurred during royalty payment simulation." // [11]
    }, { status: 500 }); // [11]
  }
}