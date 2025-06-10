import { NextRequest, NextResponse } from 'next/server';
import { storyClient } from '../../../lib/storyClient';
import { Address, zeroAddress } from 'viem';

// Define the $WIP Token Address for Story Protocol Aeneid Testnet
const WIP_TOKEN_ADDRESS = "0x1514000000000000000000000000000000000000" as Address;

export async function POST(request: NextRequest) {
    try {
        const { ipId, claimerAddress } = await request.json();

        if (!ipId || typeof ipId !== 'string' || !ipId.startsWith('0x')) {
            return NextResponse.json({ error: 'Invalid or missing IP ID.' }, { status: 400 });
        }
        if (!claimerAddress || typeof claimerAddress !== 'string' || !claimerAddress.startsWith('0x')) {
            return NextResponse.json({ error: 'Invalid or missing claimer address.' }, { status: 400 });
        }

        console.log(`Checking claimable revenue for IP ID: ${ipId} by claimer: ${claimerAddress}`);

        // FIX: Check if a royalty vault exists for this IP ID before attempting to query claimable revenue.
        // This prevents the SDK from trying to call a function on the zero address if the vault is not deployed.
        let royaltyVaultExists = false;
        try {
            const royaltyVaultAddress = await storyClient.royalty.getRoyaltyVaultAddress(ipId as Address);
            if (royaltyVaultAddress !== zeroAddress) {
                royaltyVaultExists = true;
            }
        } catch (vaultCheckError: any) {
            // Log the error but continue, as the vault might simply not exist for this IP yet.
            // Returning 0 for claimable amount in this case is a graceful fallback.
            console.warn(`Warning: Could not retrieve royalty vault address for IP ID ${ipId}. Assuming no vault exists for claimable revenue check. Error: ${vaultCheckError.message}`);
        }

        // If no royalty vault exists for this IP Asset, return 0 as the claimable amount.
        // This gracefully handles IPs that have not yet had a royalty payment simulated or confirmed.
        if (!royaltyVaultExists) {
            console.log(`No active royalty vault found for IP ID ${ipId}. Claimable amount is 0.`);
            return NextResponse.json({
                status: 'success',
                amount: '0', // Return "0" (as a string) if no vault exists or could not be found
                currency: WIP_TOKEN_ADDRESS,
            });
        }

        // Proceed to get claimable revenue only if a valid royalty vault was confirmed to exist.
        // The Story Protocol SDK's `claimableRevenue` method expects `royaltyVaultIpId` as the IP ID.
        // The SDK internally resolves this to the actual vault address for the contract call.
        const claimableAmountBigInt: bigint = await storyClient.royalty.claimableRevenue({
            royaltyVaultIpId: ipId as Address,
            claimer: claimerAddress as Address,
            token: WIP_TOKEN_ADDRESS,
        });

        console.log(`Claimable amount for IP ID ${ipId}: ${claimableAmountBigInt.toString()}`);

        return NextResponse.json({
            status: 'success',
            amount: claimableAmountBigInt.toString(), // Convert BigInt to string for JSON serialization
            currency: WIP_TOKEN_ADDRESS,
        });
    } catch (error: any) {
        console.error("Error in get-claimable-revenue API route:", error);
        return NextResponse.json({
            status: 'error',
            message: error.message || "An unexpected error occurred while fetching claimable revenue."
        }, { status: 500 });
    }
}