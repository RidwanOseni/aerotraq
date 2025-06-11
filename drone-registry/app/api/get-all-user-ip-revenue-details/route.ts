import { NextRequest, NextResponse } from 'next/server';
import { storyClient } from '../../../lib/storyClient';
import { Address, zeroAddress } from 'viem'; // Import zeroAddress
import { createPublicClient, http, defineChain } from 'viem';
import { spawn } from 'child_process';
import path from 'path';
import process from 'process';

// Define the custom Aeneid Testnet chain
const aeneid = defineChain({
    id: 1315,
    name: 'Story Aeneid Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'IP',
        symbol: 'IP',
    },
    rpcUrls: {
        default: {
            http: ['https://aeneid.storyrpc.io'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Storyscan',
            url: 'https://aeneid.storyscan.io',
        },
    },
});

// Create a Viem public client directly for backend use to interact with the blockchain
const publicClient = createPublicClient({
    chain: aeneid,
    transport: http(),
});

// DroneFlight contract ABI and address (from ABI-smart-contract-new.txt and app-register-flight-page.txt)
const contractAddress = "0x4f3880A15Ea6f0E1A269c59e44855a9963B86949";
const contractABI = [
    {
        "inputs": [{"internalType": "address", "name": "initialOwner", "type": "address"}],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
        "name": "OwnableInvalidOwner",
        "type": "error"
    },
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "OwnableUnauthorizedAccount",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "initialDataHash", "type": "bytes32"},
            {"indexed": true, "internalType": "bytes32", "name": "dgipDataHash", "type": "bytes32"},
            {"indexed": true, "internalType": "address", "name": "registrant", "type": "address"}
        ],
        "name": "DGIPDataRegistered",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "uint256", "name": "flightId", "type": "uint256"},
            {"indexed": true, "internalType": "address", "name": "registrant", "type": "address"},
            {"indexed": true, "internalType": "bytes32", "name": "initialDataHash", "type": "bytes32"}
        ],
        "name": "FlightRegistered",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "address", "name": "previousOwner", "type": "address"},
            {"indexed": true, "internalType": "address", "name": "newOwner", "type": "address"}
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "flightRecords",
        "outputs": [
            {"internalType": "bytes32", "name": "initialDataHash", "type": "bytes32"},
            {"internalType": "address", "name": "registrant", "type": "address"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "initialDataHash", "type": "bytes32"}],
        "name": "getDgipHash",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "flightId", "type": "uint256"}],
        "name": "getFlight",
        "outputs": [
            {"internalType": "bytes32", "name": "", "type": "bytes32"},
            {"internalType": "address", "name": "", "type": "address"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getMyFlights",
        "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "name": "initialDataHashToFlightId",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "name": "initialHashExists",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "name": "initialHashToDgipHash",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nextFlightId",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "initialDataHash", "type": "bytes32"},
            {"internalType": "bytes32", "name": "dgipDataHash", "type": "bytes32"}
        ],
        "name": "registerDGIPData",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "initialDataHash", "type": "bytes32"}],
        "name": "registerFlight",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "newOwner", "type": "address"}
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "", "type": "address"},
            {"internalType": "uint256", "name": "", "type": "uint256"}
        ],
        "name": "userFlights",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

// Define the $WIP Token Address for Story Protocol Aeneid Testnet
const WIP_TOKEN_ADDRESS = "0x1514000000000000000000000000000000000000" as Address;

// Path to the llama_validator.py script
const PYTHON_SCRIPT_PATH = path.join(process.cwd(), 'backend', 'llama_validator.py');
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python';

interface FlightRecordWithRevenue {
    flightId: number;
    initialDataHash: string;
    ipfsCid: string | null;
    ipId: string | null;
    licenseTermsId: number | null;
    claimableAmount: string | null;
}

export async function POST(request: NextRequest) {
    let stderr = ''; // Variable to capture stderr from Python processes
    try {
        const { claimerAddress } = await request.json();
        if (!claimerAddress || typeof claimerAddress !== 'string' || !claimerAddress.startsWith('0x')) {
            return NextResponse.json({ error: 'Invalid or missing claimer address.' }, { status: 400 });
        }

        console.log(`Fetching all flights for user: ${claimerAddress}`);

        // 1. Get all flight IDs for the connected user from the smart contract
        const userFlightIdsBigInt: readonly bigint[] = await publicClient.readContract({
            address: contractAddress,
            abi: contractABI,
            functionName: 'getMyFlights',
            account: claimerAddress as Address,
        });

        const initialDataHashes: string[] = [];
        const flightIdToDataHashMap = new Map();
        const flightDetailsMap = new Map();

        // 2. For each flightId, get the initialDataHash from the smart contract
        for (const flightIdBigInt of userFlightIdsBigInt) {
            const flightId = Number(flightIdBigInt);
            try {
                const [initialDataHash, registrant] = await publicClient.readContract({
                    address: contractAddress,
                    abi: contractABI,
                    functionName: 'getFlight',
                    args: [BigInt(flightId)],
                    account: claimerAddress as Address,
                });
                initialDataHashes.push(initialDataHash);
                flightIdToDataHashMap.set(flightId, initialDataHash);
                flightDetailsMap.set(initialDataHash, {
                    flightId: flightId,
                    initialDataHash: initialDataHash,
                    ipfsCid: null,
                    ipId: null,
                    licenseTermsId: null,
                    claimableAmount: null,
                });
            } catch (error: any) {
                console.warn(`Failed to get flight details for flightId ${flightId}: ${error.message}`);
                // Add placeholder for failed flights
                flightDetailsMap.set(`error-flight-${flightId}`, {
                    flightId: flightId,
                    initialDataHash: `0x${'0'.repeat(64)}`, // Placeholder hash
                    ipfsCid: null, ipId: null, licenseTermsId: null, claimableAmount: "0 WIP",
                });
            }
        }

        // 3. Call backend Python script once to get Story Protocol IP details for all initialDataHashes
        let allIpDetails: { dataHash: string; ipfsCid: string | null; ipId: string | null; licenseTermsId: number | null; }[] = [];
        if (initialDataHashes.length > 0) {
            try {
                const pythonProcess = spawn(PYTHON_EXECUTABLE, [PYTHON_SCRIPT_PATH]);
                let stdout = '';
                stderr = ''; // Reset stderr for this specific spawn
                pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
                pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });
                const inputData = {
                    action: 'get_story_protocol_details_by_hashes',
                    dataHashes: initialDataHashes,
                };
                pythonProcess.stdin.write(JSON.stringify(inputData));
                pythonProcess.stdin.end();
                const exitCode = await new Promise((resolve) => {
                    pythonProcess.on('close', resolve);
                });
                if (exitCode !== 0) {
                    throw new Error(`Python script for IP details exited with code ${exitCode}. Stderr: ${stderr || 'None'}`);
                }
                const parsedOutput = JSON.parse(stdout);
                if (parsedOutput.status === 'success' && Array.isArray(parsedOutput.details)) {
                    allIpDetails = parsedOutput.details;
                } else if (parsedOutput.error) {
                    throw new Error(`Python script returned an error: ${parsedOutput.error}`);
                } else {
                    throw new Error(`Unexpected output format from Python script: ${stdout}`);
                }
            } catch (pythonError: any) {
                console.error("Error fetching IP details from Python script:", pythonError.message);
                // Continue even if Python script fails, some details might be missing
            }
        }

        // Merge IP details into flightDetailsMap and fetch claimable revenue
        const finalFlights: FlightRecordWithRevenue[] = [];
        for (const [dataHash, flight] of flightDetailsMap.entries()) {
            // Find the corresponding IP details from the batch fetch
            const ipDetail = allIpDetails.find(detail => detail.dataHash === dataHash);
            if (ipDetail) {
                flight.ipfsCid = ipDetail.ipfsCid;
                flight.ipId = ipDetail.ipId;
                flight.licenseTermsId = ipDetail.licenseTermsId;
            }

            if (flight.ipId) {
                try {
                    // Check if a royalty vault exists for this IP ID before attempting to query claimable revenue.
                    let royaltyVaultExists = false;
                    try {
                        const royaltyVaultAddress = await storyClient.royalty.getRoyaltyVaultAddress(flight.ipId as Address);
                        if (royaltyVaultAddress !== zeroAddress) {
                            royaltyVaultExists = true;
                        }
                    } catch (vaultCheckError: any) {
                        // Log the error but continue, as the vault might simply not exist for this IP yet.
                        // Returning 0 for claimable amount in this case is a graceful fallback.
                        console.warn(`Warning: Could not retrieve royalty vault address for IP ID ${flight.ipId}. Assuming no vault exists for claimable revenue check. Error: ${vaultCheckError.message}`);
                    }

                    // If no royalty vault exists for this IP Asset, return 0 as the claimable amount.
                    if (royaltyVaultExists) {
                        // Call Story Protocol SDK to get claimable revenue for each IP Asset
                        const claimableAmountBigInt: bigint = await storyClient.royalty.claimableRevenue({
                            royaltyVaultIpId: flight.ipId as Address,
                            claimer: flight.ipId as Address,
                            token: WIP_TOKEN_ADDRESS,
                        });
                        // Convert BigInt to string and format to WIP units (10^18 for WIP)
                        flight.claimableAmount = `${parseFloat(claimableAmountBigInt.toString()) / (10**18)} WIP`;
                    } else {
                        console.log(`No active royalty vault found for IP ID ${flight.ipId}. Claimable amount is 0.`);
                        flight.claimableAmount = "0 WIP"; // Default to 0 if no vault exists
                    }
                } catch (claimableError: any) {
                    console.warn(`Failed to fetch claimable revenue for IP ID ${flight.ipId}: ${claimableError.message}`);
                    flight.claimableAmount = "0 WIP"; // Default to 0 if an error occurs
                }
            } else {
                flight.claimableAmount = "0 WIP"; // No IP ID, no claimable revenue
            }
            finalFlights.push(flight);
        }

        return NextResponse.json({
            status: 'success',
            flights: finalFlights,
        });

    } catch (error: any) {
        console.error("Error in get-all-user-ip-revenue-details API route:", error);
        return NextResponse.json({
            status: 'error',
            message: error.message || "An unexpected error occurred while fetching revenue details."
        }, { status: 500 });
    }
}