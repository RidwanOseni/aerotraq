'use client';

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from "sonner";
import { Loader2 } from 'lucide-react';

// Define the interface for a FlightRecord, including Story Protocol details
interface FlightRecord {
    initialDataHash: string; // The Keccak256 hash of the initial flight data
    ipfsCid: string | null; // IPFS CID of the initial flight data
    ipId: string | null; // Story Protocol IP Asset ID
    licenseTermsId: number | null; // Story Protocol License Terms ID
    mintedTokenId: string | null; // Added for minted NFT token ID
    droneName: string; // Dynamically fetched
    flightDate: string; // Dynamically fetched
    claimableAmount: string | null; // From the consolidated API
}

export default function FlightHistoryPage() {
    const { isConnected, address } = useAccount();

    const [flights, setFlights] = useState<FlightRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchFlights = async () => {
            if (!isConnected || !address) {
                setFlights([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                // Call the new single, optimized backend API route to fetch all user flights
                const response = await fetch('/api/get-all-user-ip-revenue-details', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ claimerAddress: address }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Failed to fetch flight history (Status: ${response.status}).`);
                }

                const result = await response.json();
                if (result.status === 'success' && Array.isArray(result.flights)) {
                    setFlights(result.flights);
                } else {
                    throw new Error(result.message || "Received unexpected response format from backend.");
                }

            } catch (error: any) {
                console.error("Error fetching flight history:", error);
                toast.error(`Failed to load flight history: ${error.message}`);
                setFlights([]);
            } finally {
                setIsLoading(false);
            }
        };

        if (isConnected) {
            fetchFlights();
        } else {
            setFlights([]);
            setIsLoading(false);
        }
    }, [isConnected, address]);

    // Removed handleSimulateRoyalty function

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center px-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Connect Wallet to View Flight History</CardTitle>
                        <CardDescription>
                            Please connect your wallet to see your registered drone flights and manage your IP Assets.
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
                <p className="mt-2 text-muted-foreground">Loading flight history...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Your Flight History & IP Assets</CardTitle>
                    <CardDescription>
                        A chronological record of your drone flights and their associated digital intellectual property.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {flights.length === 0 ? (
                        <p className="text-center text-muted-foreground">No flights found. Register a new flight to get started!</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {flights.map((flight) => (
                                <Card key={flight.initialDataHash} className="p-4">
                                    <CardTitle className="text-xl">
                                        {flight.droneName} Flight on {flight.flightDate}
                                    </CardTitle>
                                    <CardContent className="mt-2 text-sm space-y-1">
                                        <p><span className="font-semibold">Data Hash:</span> {flight.initialDataHash}</p>
                                        {flight.ipfsCid && flight.ipfsCid !== "UPLOAD_FAILED" && (
                                            <p>
                                                <span className="font-semibold">IPFS CID:</span>{" "}
                                                <a
                                                    href={`https://ipfs.io/ipfs/${flight.ipfsCid}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-500 hover:underline"
                                                >
                                                    {flight.ipfsCid}
                                                </a>
                                            </p>
                                        )}
                                        {flight.ipId ? (
                                            <div className="mt-2 border-t pt-2">
                                                <h3 className="font-semibold text-md">Story Protocol IP Asset Details:</h3>
                                                <p>
                                                    <span className="font-semibold">IP Asset ID:</span>{" "}
                                                    <a
                                                        href={`https://aeneid.explorer.story.foundation/ip/${flight.ipId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 hover:underline"
                                                    >
                                                        {flight.ipId.substring(0, 8)}...{flight.ipId.slice(-6)} (View on Explorer)
                                                    </a>
                                                </p>
                                                {flight.licenseTermsId !== null && (
                                                    <p><span className="font-semibold">License Terms ID:</span> {flight.licenseTermsId}</p>
                                                )}
                                                {flight.mintedTokenId !== null && (
                                                    <p><span className="font-semibold">Minted NFT Token ID:</span> {flight.mintedTokenId}</p>
                                                )}
                                                {flight.claimableAmount !== null && (
                                                    <p><span className="font-semibold">Accrued Revenue:</span> {flight.claimableAmount}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="mt-2 text-muted-foreground italic">IP Asset not yet tokenized for this flight.</p>
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