// Replace the original import line with this:
import * as storyModule from '../lib/storyClient.js';
// Note the '.js' extension is crucial for explicit specifier resolution.

import { Address } from 'viem';

async function checkWipBalance() {
    const walletAddress = "0xa1435d712053582D4E8B8d8c93d51985F08F95A9" as Address;

    console.log(`Starting $WIP balance check for ${walletAddress}...`); // Added log

    try {
        console.log("Attempting to fetch balance from storyClient.wipClient..."); // Added log
        const wipBalance = await storyModule.storyClient.wipClient.balanceOf(walletAddress);
        console.log("Successfully fetched WIP balance."); // Added log
        console.log(`Current $WIP balance for ${walletAddress}: ${wipBalance / 10n**18n} $WIP`);
    } catch (error) {
        console.error("Error checking $WIP balance:", error);
        // Add more detailed error logging if `error` object provides it
        if (error instanceof Error) {
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
    }
    console.log("Finished $WIP balance check function."); // Added log
}

checkWipBalance();