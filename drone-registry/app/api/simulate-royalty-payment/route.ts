import { NextRequest, NextResponse } from 'next/server';
import { storyClient, account } from '../../../lib/storyClient'; // MODIFIED LINE: Imported 'account'
import { Address, parseEther, zeroAddress } from 'viem';

// Define the $WIP Token Address for Story Protocol Aeneid Testnet
// This is the native token used for royalty payments on Story Protocol's testnet
const WIP_TOKEN_ADDRESS = "0x1514000000000000000000000000000000000000" as Address;

export async function POST(request: NextRequest) {
  try {
    // Step 1: Input Validation
    // The API expects two critical pieces of information:
    // - ipId: The Story Protocol IP Asset ID that will receive the royalty payment
    // - licenseTermsId: The ID of the licensing terms that govern this IP's revenue sharing
    const { ipId, licenseTermsId } = await request.json();

    // Basic validation for the incoming IP ID
    if (!ipId || typeof ipId !== 'string' || !ipId.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid or missing IP ID.' }, { status: 400 }); // [4]
    }

    // Validate licenseTermsId as well
    if (licenseTermsId === null || typeof licenseTermsId !== 'number' || licenseTermsId < 0) {
      return NextResponse.json({ error: 'Invalid or missing License Terms ID.' }, { status: 400 });
    }

    console.log(`Initiating royalty payment simulation for IP ID: ${ipId}`);

    // Step 2: Royalty Vault Verification
    // Before making a royalty payment, we need to ensure a royalty vault exists
    // The vault is a smart contract that holds and distributes royalty payments
    let royaltyVaultAddress: Address = zeroAddress;
    try {
      // Check if a royalty vault already exists for this IP
      royaltyVaultAddress = await storyClient.royalty.getRoyaltyVaultAddress(ipId as Address);
      console.log(`Current Royalty Vault Address for ${ipId}: ${royaltyVaultAddress}`);
    } catch (vaultCheckError) {
      console.warn(`Could not retrieve royalty vault address initially: ${vaultCheckError}`);
    }

    // Step 3: Royalty Vault Deployment (if needed)
    // If no vault exists, we need to trigger its deployment by minting a license token
    // This is a requirement of Story Protocol's architecture
    if (royaltyVaultAddress === zeroAddress) {
      console.log(`Royalty vault not found for IP ID ${ipId}. Attempting to mint a license token to trigger vault deployment...`);

      try {
        // Mint a license token to trigger vault deployment
        // This is a prerequisite for receiving royalty payments
        const mintLicenseResponse = await storyClient.license.mintLicenseTokens({
          licensorIpId: ipId as Address, // The IP asset that will receive royalties
          licenseTermsId: licenseTermsId, // The terms governing revenue sharing
          amount: 1, // Mint one license token to trigger vault deployment
          maxMintingFee: 0n,
          maxRevenueShare: 100, // Maximum revenue share percentage
          receiver: account.address, // The address that will hold the license token
          txOptions: { waitForTransaction: true },
        });

        console.log(`Successfully minted license token. Transaction Hash: ${mintLicenseResponse.txHash}`);

        // Verify vault deployment after minting
        royaltyVaultAddress = await storyClient.royalty.getRoyaltyVaultAddress(ipId as Address);
        if (royaltyVaultAddress === zeroAddress) {
          throw new Error("Vault still not deployed after attempting to mint license token. Royalty payment will likely fail.");
        }
        console.log(`Royalty vault successfully deployed/found at: ${royaltyVaultAddress}`);

      } catch (mintError: any) {
        console.error(`Failed to mint license token to deploy royalty vault: ${mintError.message}`);
        return NextResponse.json({
          status: 'error',
          message: `Failed to prepare IP for royalty payment (minting license token failed): ${mintError.message}`
        }, { status: 500 });
      }
    } else {
      console.log(`Royalty vault already exists for IP ID ${ipId}. Proceeding with payment.`);
    }

    // Step 4: Simulate Royalty Payment
    // Using Story Protocol's SDK to simulate a royalty payment
    // This demonstrates how IP owners can earn revenue from their assets
    const paymentAmount = parseEther("0.1"); // Simulate a payment of 0.1 $WIP tokens
    const payRoyaltyResponse = await storyClient.royalty.payRoyaltyOnBehalf({
      receiverIpId: ipId as Address, // The IP asset receiving the royalty payment
      payerIpId: zeroAddress, // In this simulation, we're using a zero address as the payer
      token: WIP_TOKEN_ADDRESS, // The $WIP token used for the payment
      amount: paymentAmount, // The amount of $WIP tokens to pay
      txOptions: { waitForTransaction: true }, // Wait for transaction confirmation
    });

    console.log(`Royalty payment transaction sent. Transaction Hash: ${payRoyaltyResponse.txHash}`);

    // Step 5: Return Success Response
    // Provide the transaction details to the frontend for confirmation
    return NextResponse.json({
      status: 'success',
      message: `Royalty payment simulated successfully for IP ID: ${ipId}`,
      txHash: payRoyaltyResponse.txHash,
    });

  } catch (error: any) {
    // Handle any errors that occur during the process
    console.error("Error in simulate-royalty-payment API route:", error);
    return NextResponse.json({
      status: 'error',
      message: error.message || "An unexpected error occurred during royalty payment simulation."
    }, { status: 500 });
  }
}