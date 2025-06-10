'use client';

import { useEffect, useState } from "react";
// FIX: Import useConfig hook as it is used
import { useAccount, useConfig } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { Loader2 } from 'lucide-react';
import { getPublicClient } from 'wagmi/actions';

// FIX: Import Alert components as they are used in the JSX structure
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


// Contract address and ABI for the DroneFlight contract
// NOTE: This should be your DroneFlight contract address deployed on Story Aeneid Testnet.
// It is the same one used in app-register-flight-page.txt
const contractAddress = "0x4f3880A15Ea6f0E1A269c59e44855a9963B86949";
const contractABI = [
    // Constructor
    {
        "inputs": [
            { "internalType": "address", "name": "initialOwner", "type": "address" }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    // Errors
    { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "OwnableInvalidOwner", "type": "error" },
    { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "OwnableUnauthorizedAccount", "type": "error" },
    // Events
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "bytes32", "name": "initialDataHash", "type": "bytes32" },
            { "indexed": true, "internalType": "bytes32", "name": "dgipDataHash", "type": "bytes32" },
            { "indexed": true, "internalType": "address", "name": "registrant", "type": "address" }
        ],
        "name": "DGIPDataRegistered",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "uint256", "name": "flightId", "type": "uint256" },
            { "indexed": true, "internalType": "address", "name": "registrant", "type": "address" },
            { "indexed": true, "internalType": "bytes32", "name": "initialDataHash", "type": "bytes32" }
        ],
        "name": "FlightRegistered",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
            { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    // Functions
    {
        "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "name": "flightRecords",
        "outputs": [
            { "internalType": "bytes32", "name": "initialDataHash", "type": "bytes32" },
            { "internalType": "address", "name": "registrant", "type": "address" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "bytes32", "name": "initialDataHash", "type": "bytes32" }],
        "name": "getDgipHash",
        "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "flightId", "type": "uint256" }],
        "name": "getFlight",
        "outputs": [
            { "internalType": "bytes32", "name": "", "type": "bytes32" },
            { "internalType": "address", "name": "", "type": "address" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getMyFlights",
        "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
        "name": "initialDataHashToFlightId",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
        "name": "initialHashExists",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
        "name": "initialHashToDgipHash",
        "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nextFlightId",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "bytes32", "name": "initialDataHash", "type": "bytes32" },
            { "internalType": "bytes32", "name": "dgipDataHash", "type": "bytes32" }
        ],
        "name": "registerDGIPData",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "bytes32", "name": "initialDataHash", "type": "bytes32" }],
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
            { "internalType": "address", "name": "newOwner", "type": "address" }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "", "type": "address" },
            { "internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "name": "userFlights",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

// Interface for a FlightRecord, including Story Protocol details and claimable revenue
interface FlightRecordWithRevenue {
    flightId: number;
    initialDataHash: string; // The Keccak256 hash of the initial flight data
    ipId: string | null; // Story Protocol IP Asset ID
    licenseTermsId: number | null; // Story Protocol License Terms ID
    claimableAmount: string | null; // Amount of revenue claimable, formatted as string (e.g., "0.5 WIP")
    // Add other relevant flight details you might want to display from your initial flight data,
    // potentially by fetching full flight details from your backend based on initialDataHash
    // For this MVP, we'll keep it simple for display.
}

export default function RevenuePage() {
    const { isConnected, address } = useAccount();
    const config = useConfig();
    // FIX: Explicitly type the state variables
    const [revenueFlights, setRevenueFlights] = useState<FlightRecordWithRevenue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isClaimingFlightId, setIsClaimingFlightId] = useState<number | null>(null);

    useEffect(() => {
        const fetchRevenueData = async () => {
            if (!isConnected || !address) {
                setRevenueFlights([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            try {
                const publicClient = getPublicClient(config);
                if (!publicClient) {
                    throw new Error("Viem public client not available.");
                }

                // 1. Get all flight IDs for the connected user from the smart contract [2]
                const userFlightIds: readonly bigint[] = await publicClient.readContract({
                    address: contractAddress,
                    abi: contractABI,
                    functionName: 'getMyFlights',
                    account: address,
                });

                const fetchedFlights: FlightRecordWithRevenue[] = [];

                for (const flightIdBigInt of userFlightIds) {
                    const flightId = Number(flightIdBigInt); // Convert BigInt to Number

                    // 2. For each flightId, get the initialDataHash from the smart contract [3]
                    const [initialDataHash, registrant] = await publicClient.readContract({
                        address: contractAddress,
                        abi: contractABI,
                        functionName: 'getFlight',
                        args: [BigInt(flightId)],
                        account: address, // Or use a static address if the function doesn't require msg.sender
                    });

                    // 3. Call backend API to get Story Protocol IP details (ipId, licenseTermsId)
                    // This uses the existing `get_story_protocol_details_by_hash` action in llama_validator.py [3-5]
                    const ipDetailsResponse = await fetch('/api/get-story-ip-details', { // MODIFIED LINE
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dataHash: initialDataHash }),
                      });

                    if (!ipDetailsResponse.ok) {
                        console.warn(`Failed to fetch IP details for initialDataHash ${initialDataHash}: ${ipDetailsResponse.status}`);
                        continue; // Skip to the next flight if IP details can't be fetched
                    }

                    const ipDetails = await ipDetailsResponse.json();

                    let ipId: string | null = null;
                    let licenseTermsId: number | null = null;

                    if (ipDetails.ipId && ipDetails.licenseTermsId !== null) {
                        ipId = ipDetails.ipId;
                        licenseTermsId = ipDetails.licenseTermsId;
                    } else {
                        console.warn(`No Story Protocol IP details found for dataHash: ${initialDataHash}.`);
                    }

                    let claimableAmount: string | null = null;
                    if (ipId) {
                        // 4. Call backend API to get claimable revenue for this IP Asset [5]
                        const claimableResponse = await fetch('/api/get-claimable-revenue', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ipId: ipId, claimerAddress: address }),
                        });

                        if (claimableResponse.ok) {
                            const claimableData = await claimableResponse.json();
                            if (claimableData.amount !== null && claimableData.amount !== undefined) {
                                // Assuming WIP token is 18 decimals, format as string
                                claimableAmount = `${parseFloat(claimableData.amount) / (10**18)} WIP`;
                            }
                        } else {
                            console.warn(`Failed to fetch claimable revenue for IP ID ${ipId}: ${claimableResponse.status}`);
                        }
                    }

                    fetchedFlights.push({
                        flightId,
                        initialDataHash,
                        ipId,
                        licenseTermsId,
                        claimableAmount,
                    });
                }

                setRevenueFlights(fetchedFlights);

            } catch (error: any) {
                console.error("Error fetching revenue data:", error);
                toast.error(`Failed to load revenue data: ${error.message}`);
                setRevenueFlights([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRevenueData();
    }, [isConnected, address, config]); // Re-run effect when wallet connection/address changes

    const handleClaimRevenue = async (flightId: number, ipId: string) => {
        if (!ipId || !address) {
            toast.error("IP Asset ID or wallet address is missing. Cannot claim revenue.");
            return;
        }

        setIsClaimingFlightId(flightId); // Set loading state for this specific flight
        toast.info(`Claiming revenue for IP ID: ${ipId}...`);

        try {
            // Call your new backend API route for claiming revenue [6]
            const response = await fetch('/api/claim-revenue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ipId: ipId, claimerAddress: address }), // Pass IP ID and claimer's address
            });

            const result = await response.json();

            if (!response.ok || result.status === 'error') {
                const errorMessage = result.message || `Failed to claim revenue (Status: ${response.status}).`;
                toast.error(errorMessage);
                console.error("Claim revenue error:", result);
            } else {
                toast.success(`Revenue claimed! Transaction Hash: ${result.txHash.substring(0, 10)}...${result.txHash.slice(-8)}`);
                console.log("Claim revenue success:", result);
                // After successful claim, re-fetch data to update claimable amount [7]
                // (You might trigger a full re-fetch or selectively update the specific flight's claimable amount)
                window.location.reload(); // Simple reload for MVP to reflect changes
            }

        } catch (error: any) {
            console.error("Error during claim revenue fetch:", error);
            toast.error(`An unexpected error occurred during claiming: ${error.message}`);
        } finally {
            setIsClaimingFlightId(null); // Clear loading state
        }
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Connect Wallet to View Revenue</CardTitle>
                        <CardDescription>
                            Please connect your wallet to see your accrued royalties and manage your IP Asset revenue.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        {/* Assuming WalletConnect component is available in your Navbar or elsewhere */}
                        {/* <WalletConnect /> */}
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Loading revenue data...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold">Your IP Asset Revenue</CardTitle>
                    <CardDescription>
                        View and claim the royalties generated from your tokenized drone flight data.
                    </CardDescription>
                </CardHeader>
            </Card>

            {revenueFlights.length === 0 ? (
                // FIX: Used Alert components here to display the message when no flights are found.
                <Alert>
                    <AlertTitle>No Tokenized Flights with Revenue Found</AlertTitle>
                    <AlertDescription>
                        Register a new flight and tokenize its IP Asset (Step 4) to start generating revenue.
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {revenueFlights.map((flight) => (
                        <Card key={flight.flightId}>
                            <CardHeader>
                                <CardTitle className="text-xl">Flight ID: {flight.flightId}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {flight.ipId && (
                                    <p>
                                        <span className="font-medium">IP Asset ID:</span>{" "}
                                        {flight.ipId.substring(0, 8)}...{flight.ipId.slice(-6)}{" "}
                                        <a
                                            href={`https://aeneid.explorer.story.foundation/ip/${flight.ipId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline"
                                        >
                                            (View on Explorer)
                                        </a>
                                    </p>
                                )}
                                <p><span className="font-medium">Initial Data Hash:</span>{" "}{flight.initialDataHash.substring(0, 10)}...</p>
                                {flight.licenseTermsId !== null && (
                                    <p><span className="font-medium">License Terms ID:</span> {flight.licenseTermsId}</p>
                                )}
                                {flight.ipId ? (
                                    <>
                                        <p><span className="font-medium">Claimable Revenue:</span>{" "}{flight.claimableAmount || "0 WIP"}</p>
                                        <Button
                                            onClick={() => handleClaimRevenue(flight.flightId, flight.ipId!)}
                                            disabled={isClaimingFlightId === flight.flightId || !flight.ipId || parseFloat(flight.claimableAmount || "0") === 0} // Disable if 0 WIP
                                            className="w-full mt-3"
                                        >
                                            {isClaimingFlightId === flight.flightId ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Claiming...
                                                </>
                                            ) : (
                                                "Claim Revenue"
                                            )}
                                        </Button>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">IP Asset not yet tokenized (Step 4 required).</p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
