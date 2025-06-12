'use client';

import { useEffect, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getPublicClient } from 'wagmi/actions';

const contractAddress = "0x4f3880A15Ea6f0E1A269c59e44855a9963B86949";
const contractABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "initialOwner", "type": "address" }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "OwnableInvalidOwner", "type": "error" },
    { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "OwnableUnauthorizedAccount", "type": "error" },
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
    mintedTokenId: string | null; // Added for minted NFT token ID
    claimableAmount: string | null; // Amount of revenue claimable, formatted as string (e.g., "0.5 WIP")
    claimedStatus?: 'unclaimed' | 'claiming' | 'claimed'; // Add new status field
}

export default function RevenuePage() {
    const { isConnected, address } = useAccount();
    const config = useConfig();
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
                    const flightsWithStatus = result.flights.map((flight: FlightRecordWithRevenue) => ({
                        ...flight,
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

        setIsClaimingFlightId(flightId);
        setRevenueFlights(prevFlights =>
            prevFlights.map(flight =>
                flight.flightId === flightId ? { ...flight, claimedStatus: 'claiming' } : flight
            )
        );
        toast.info(`Claiming revenue for IP ID: ${ipId}...`);

        try {
            const response = await fetch('/api/claim-revenue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ipId: ipId, claimerAddress: address }),
            });

            const result = await response.json();

            if (!response.ok || result.status === 'error') {
                const errorMessage = result.message || `Failed to claim revenue (Status: ${response.status}).`;
                toast.error(errorMessage);
                console.error("Claim revenue error:", result);
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
                    displayHashString = txHashToDisplayRaw[0]; // Take the first hash from the array
                } else if (typeof txHashToDisplayRaw === 'string') {
                    displayHashString = txHashToDisplayRaw;
                } else {
                    displayHashString = 'N/A';
                }

                toast.success(`Revenue claimed! Transaction Hash: ${displayHashString.substring(0, 10)}...${displayHashString.slice(-8)}`);
                console.log("Claim revenue success:", result);
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
            setRevenueFlights(prevFlights =>
                prevFlights.map(flight =>
                    flight.flightId === flightId ? { ...flight, claimedStatus: 'unclaimed' } : flight
                )
            );
        } finally {
            setIsClaimingFlightId(null);
        }
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center px-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Connect Wallet to View Revenue</CardTitle>
                        <CardDescription>
                            Please connect your wallet to see your accrued royalties and manage your IP Asset revenue.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center px-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-muted-foreground">Loading revenue data...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Your IP Asset Revenue</CardTitle>
                    <CardDescription>
                        View and claim the royalties generated from your tokenized drone flight data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {revenueFlights.length === 0 ? (
                        <p className="text-center text-muted-foreground">
                            No Tokenized Flights with Revenue Found. Register a new flight and tokenize its IP Asset (Step 4) to start generating revenue.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {revenueFlights.map((flight) => (
                                <Card key={flight.flightId} className="p-4">
                                    <CardTitle className="text-xl">Flight ID: {flight.flightId}</CardTitle>
                                    <CardContent className="mt-2 text-sm space-y-1">
                                        {flight.ipId && (
                                            <p>
                                                <span className="font-semibold">IP Asset ID:</span>{" "}
                                                <a
                                                    href={`https://aeneid.storyscan.io/address/${flight.ipId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-500 hover:underline"
                                                >
                                                    {flight.ipId.substring(0, 8)}...{flight.ipId.slice(-6)} (View on Explorer)
                                                </a>
                                            </p>
                                        )}
                                        <p><span className="font-semibold">Initial Data Hash:</span> {flight.initialDataHash.substring(0, 10)}...</p>
                                        {flight.licenseTermsId !== null && (
                                            <p><span className="font-semibold">License Terms ID:</span> {flight.licenseTermsId}</p>
                                        )}
                                        {flight.mintedTokenId !== null && (
                                            <p><span className="font-semibold">Minted NFT Token ID:</span> {flight.mintedTokenId}</p>
                                        )}
                                        {flight.ipId ? (
                                            <>
                                                <p><span className="font-semibold">Claimable Revenue:</span> {flight.claimableAmount || "0 WIP"}</p>
                                                <Button
                                                    onClick={() => handleClaimRevenue(flight.flightId, flight.ipId!)}
                                                    disabled={
                                                        isClaimingFlightId === flight.flightId ||
                                                        !flight.ipId ||
                                                        (parseFloat(flight.claimableAmount || "0") === 0 && flight.claimedStatus !== 'claiming') ||
                                                        flight.claimedStatus === 'claimed'
                                                    }
                                                    className="w-full mt-3"
                                                >
                                                    {isClaimingFlightId === flight.flightId ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming...
                                                        </>
                                                    ) : (
                                                        flight.claimedStatus === 'claimed' ? 'Claimed' : 'Claim Revenue'
                                                    )}
                                                </Button>
                                            </>
                                        ) : (
                                            <p className="mt-2 text-muted-foreground italic">IP Asset not yet tokenized (Step 4 required).</p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}