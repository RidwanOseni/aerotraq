'use client';

import { useEffect, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getPublicClient } from 'wagmi/actions';

// Contract address and ABI for the DroneFlight contract
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
"inputs": [{"internalType": "bytes32", "name": "initialDataHash", "type": "bytes32"}],
"name": "getDgipHash",
"outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
"stateMutability": "view",
"type": "function"
},
{
"inputs": [{"internalType": "uint256", "name": "flightId", "type": "uint256" }],
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
"outputs": [{"internalType": "uint256", "name": "", "type": "uint256" }],
"stateMutability": "view",
"type": "function"
}
] as const;

interface FlightRecordWithRevenue {
    flightId: number;
    initialDataHash: string; // The Keccak256 hash of the initial flight data
    ipId: string | null; // Story Protocol IP Asset ID
    licenseTermsId: number | null; // Story Protocol License Terms ID
    claimableAmount: string | null; // Amount of revenue claimable, formatted as string (e.g., "0.5 WIP")
    claimedStatus?: 'unclaimed' | 'claiming' | 'claimed'; // Add new status field
}

export default function RevenuePage() {
    const { isConnected, address } = useAccount();
    const config = useConfig();
    const [revenueFlights, setRevenueFlights] = useState<FlightRecordWithRevenue[]>([]); // Explicitly type useState
    const [isLoading, setIsLoading] = useState(true);
    const [isClaimingFlightId, setIsClaimingFlightId] = useState<number | null>(null); // Explicitly type useState

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

                // Call the new single, optimized backend API route to fetch all revenue data
                const response = await fetch('/api/get-all-user-ip-revenue-details', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ claimerAddress: address }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Failed to fetch revenue data (Status: ${response.status}).`);
                }

                const result = await response.json();

                if (result.status === 'success' && Array.isArray(result.flights)) {
                    // Initialize claimedStatus for all fetched flights
                    const flightsWithStatus = result.flights.map((flight: FlightRecordWithRevenue) => ({
                        ...flight,
                        // If claimableAmount is > 0, set as 'unclaimed', otherwise 'claimed' (0 indicates already claimed or no revenue)
                        claimedStatus: (flight.claimableAmount && parseFloat(flight.claimableAmount) > 0) ? 'unclaimed' : 'claimed'
                    }));
                    setRevenueFlights(flightsWithStatus);
                } else {
                    throw new Error(result.message || "Received unexpected response format from backend.");
                }

            } catch (error: any) {
                console.error("Error fetching revenue data:", error);
                toast.error(`Failed to load revenue data: ${error.message}`);
                setRevenueFlights([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRevenueData();
    }, [isConnected, address, config]);

    const handleClaimRevenue = async (flightId: number, ipId: string) => {
        if (!ipId || !address) {
            toast.error("IP Asset ID or wallet address is missing. Cannot claim revenue.");
            return;
        }

        setIsClaimingFlightId(flightId); // Set loading state for this specific flight

        // Optimistically update the status to 'claiming'
        setRevenueFlights(prevFlights =>
            prevFlights.map(flight =>
                flight.flightId === flightId ? { ...flight, claimedStatus: 'claiming' } : flight
            )
        );

        toast.info(`Claiming revenue for IP ID: ${ipId}...`);

        try {
            // Call your existing backend API route for claiming revenue
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

                // Revert status on error
                setRevenueFlights(prevFlights =>
                    prevFlights.map(flight =>
                        flight.flightId === flightId ? { ...flight, claimedStatus: 'unclaimed' } : flight
                    )
                );

            } else {
                // FIX: Ensure txHashToDisplay is a string before calling substring
                const txHashToDisplayRaw = result.txHash;
                let displayHashString: string;
                if (Array.isArray(txHashToDisplayRaw) && txHashToDisplayRaw.length > 0) {
                    // If it's an array, take the first element (assuming it's an array of strings)
                    displayHashString = txHashToDisplayRaw[0];
                } else if (typeof txHashToDisplayRaw === 'string') {
                    displayHashString = txHashToDisplayRaw;
                } else {
                    displayHashString = 'N/A';
                }

                toast.success(`Revenue claimed! Transaction Hash: ${displayHashString.substring(0, 10)}...${displayHashString.slice(-8)}`);
                console.log("Claim revenue success:", result);

                // Update local state for claimableAmount to 0 and status to 'claimed'
                // FIX: Removed window.location.reload() to allow state updates to persist
                setRevenueFlights(prevFlights =>
                    prevFlights.map(flight =>
                        flight.flightId === flightId
                            ? { ...flight, claimableAmount: "0 WIP", claimedStatus: 'claimed' }
                            : flight
                    )
                );
            }
        } catch (error: any) {
            console.error("Error during claim revenue fetch:", error);
            toast.error(`An unexpected error occurred during claiming: ${error.message}`);

            // Revert status on error
            setRevenueFlights(prevFlights =>
                prevFlights.map(flight =>
                    flight.flightId === flightId ? { ...flight, claimedStatus: 'unclaimed' } : flight
                )
            );
        } finally {
            setIsClaimingFlightId(null); // Clear loading state
        }
    };

    if (!isConnected) {
        return (
            <Card className="w-full max-w-2xl mx-auto mt-8">
                <CardHeader>
                    <CardTitle className="text-2xl">Connect Wallet to View Revenue</CardTitle>
                    <CardDescription>
                        Please connect your wallet to see your accrued royalties and manage your IP Asset revenue.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Assuming WalletConnect component is available in your Navbar or elsewhere */}
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-lg text-muted-foreground">Loading revenue data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold text-center">Your IP Asset Revenue</h1>
            <p className="text-center text-muted-foreground mb-8">
                View and claim the royalties generated from your tokenized drone flight data.
            </p>

            {revenueFlights.length === 0 ? (
                <Alert>
                    <AlertTitle>No Tokenized Flights with Revenue Found</AlertTitle>
                    <AlertDescription>
                        Register a new flight and tokenize its IP Asset (Step 4) to start generating revenue.
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid gap-6">
                    {revenueFlights.map((flight) => (
                        <Card key={flight.flightId} className="p-6">
                            <CardTitle className="mb-2">Flight ID: {flight.flightId}</CardTitle>
                            <CardDescription className="space-y-1">
                                {flight.ipId && (
                                    <p>
                                        <b>IP Asset ID:</b>{" "}
                                        {flight.ipId.substring(0, 8)}...{flight.ipId.slice(-6)}{" "}
                                        <a
                                            href={`https://aeneid.storyscan.io/address/${flight.ipId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline"
                                        >
                                            (View on Explorer)
                                        </a>
                                    </p>
                                )}
                                <p>
                                    <b>Initial Data Hash:</b>{" "}
                                    {flight.initialDataHash.substring(0, 10)}...
                                </p>
                                {flight.licenseTermsId !== null && (
                                    <p>
                                        <b>License Terms ID:</b>{" "}
                                        {flight.licenseTermsId}
                                    </p>
                                )}

                                {flight.ipId ? (
                                    <>
                                        <p>
                                            <b>Claimable Revenue:</b>{" "}
                                            {flight.claimableAmount || "0 WIP"}
                                        </p>
                                        <Button
                                            onClick={() => handleClaimRevenue(flight.flightId, flight.ipId!)}
                                            disabled={
                                                isClaimingFlightId === flight.flightId ||
                                                !flight.ipId ||
                                                // Disable if amount is 0 and not currently claiming, or already claimed
                                                (parseFloat(flight.claimableAmount || "0") === 0 && flight.claimedStatus !== 'claiming') ||
                                                flight.claimedStatus === 'claimed'
                                            }
                                            className="w-full mt-3"
                                        >
                                            {isClaimingFlightId === flight.flightId ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Claiming...
                                                </>
                                            ) : (
                                                flight.claimedStatus === 'claimed' ? 'Claimed' : 'Claim Revenue'
                                            )}
                                        </Button>
                                    </>
                                ) : (
                                    <p className="text-red-500">
                                        IP Asset not yet tokenized (Step 4 required).
                                    </p>
                                )}
                            </CardDescription>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}