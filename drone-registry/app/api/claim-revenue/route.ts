import { NextRequest, NextResponse } from 'next/server';
import { storyClient, account } from '../../../lib/storyClient';

import { Address, zeroAddress } from 'viem';

// Define the $WIP Token Address for Story Protocol Aeneid Testnet

const WIP_TOKEN_ADDRESS = "0x1514000000000000000000000000000000000000" as Address;

// RoyaltyPolicyLAP address from Story Protocol docs

const ROYALTY_POLICY_LAP_ADDRESS = "0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E" as Address;

export async function POST(request: NextRequest) {
  try {
    const { ipId, claimerAddress } = await request.json();

    if (!ipId || typeof ipId !== 'string' || !ipId.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid or missing IP ID.' }, { status: 400 });
    }

    if (!claimerAddress || typeof claimerAddress !== 'string' || !claimerAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid or missing claimer address.' }, { status: 400 });
    }

    console.log(`Initiating revenue claim for IP ID: ${ipId} by claimer: ${claimerAddress}`);

    // Call RoyaltyClient.claimAllRevenue

    // The `ancestorIpId` is the IP Asset ID you are claiming for.
    // The `claimer` is typically the `ancestorIpId` itself if it holds all royalty tokens,
    // or the external wallet address if it holds the royalty tokens directly.
    // Given the payment simulation directly sends to the `receiverIpId` (User A's IP ID),
    // User A's IP ID acts as both the ancestor and the primary claimer.

    const claimRevenueResponse = await storyClient.royalty.claimAllRevenue({
      ancestorIpId: ipId as Address, // User A's IP Asset ID
      claimer: ipId as Address, // Changed to the IP Asset ID as the claimer
      currencyTokens: [WIP_TOKEN_ADDRESS], // The token type to claim (e.g., $WIP)
      childIpIds: [], // Empty array for direct payments to the IP Asset
      // FIX 1: Corrected typo in ROYALTY_POLICY_LAP_ADDRESS
      royaltyPolicies: [ROYALTY_POLICY_LAP_ADDRESS], // Include the default policy address
      claimOptions: {
        autoTransferAllClaimedTokensFromIp: true, // Automatically transfers tokens to the wallet
        autoUnwrapIpTokens: false, // Keep WIP as WIP if desired, or set to true to unwrap to IP
      },
      // txOptions: { waitForTransaction: true },
    });

    console.log(`Revenue claim transaction sent. Transaction Hash: ${claimRevenueResponse.txHashes}`); // Changed to txHashes

    // Process claimedTokens to convert BigInt amounts to strings for JSON serialization
    // FIX 2: Added '|| []' to handle 'claimedTokens' possibly being undefined
    const processedClaimedTokens = (claimRevenueResponse.claimedTokens || []).map(
      (token: { claimer: Address; token: Address; amount: bigint }) => ({
        ...token,
        // Convert the BigInt 'amount' to a string
        amount: String(token.amount),
      })
    );

    console.log(`Claimed tokens:`, processedClaimedTokens);

    return NextResponse.json({
      status: 'success',
      message: `Revenue claimed successfully for IP ID: ${ipId}`,
      txHash: claimRevenueResponse.txHashes, // Changed to txHashes
      claimedTokens: processedClaimedTokens, // Use the processed array
    });

  } catch (error: any) {
    console.error("Error in claim-revenue API route:", error);
    return NextResponse.json({
      status: 'error',
      message: error.message || "An unexpected error occurred during revenue claiming."
    }, { status: 500 });
  }
}