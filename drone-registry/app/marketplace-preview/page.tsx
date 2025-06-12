'use client';

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { Loader2 } from 'lucide-react';

// Define the interface for a FlightRecord, including Story Protocol details for marketplace display
interface FlightRecordForMarketplace {
    initialDataHash: string;
    ipfsCid: string | null;
    ipId: string; // Must be tokenized to be listed
    licenseTermsId: number; // Must have license terms attached
    mintedTokenId: string; // Must have an NFT minted
    droneName: string; // From IPFS fetched data
    flightDate: string; // From IPFS fetched data
    isListed?: boolean; // Client-side state for simulated listing
    isSimulatingPayment?: boolean; // Client-side state for simulated payment
}

export default function MarketplacePreviewPage() {
    const { isConnected, address } = useAccount();

    const [listedFlights, setListedFlights] = useState<FlightRecordForMarketplace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [simulatingPaymentFlightId, setSimulatingPaymentFlightId] = useState<string | null>(null);

    useEffect(() => {
        const fetchListedFlights = async () => {
            if (!isConnected || !address) {
                setListedFlights([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch('/api/get-all-user-ip-revenue-details', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ claimerAddress: address }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Failed to fetch marketplace data (Status: ${response.status}).`);
                }

                const result = await response.json();
                if (result.status === 'success' && Array.isArray(result.flights)) {
                    // Filter to only show flights that have been tokenized (have an ipId and mintedTokenId)
                    const tokenizedFlights = result.flights.filter(
                        (flight: any) => flight.ipId && flight.licenseTermsId !== null && flight.mintedTokenId
                    ).map((flight: any) => ({
                        ...flight,
                        isListed: false, // Initialize as not listed
                        isSimulatingPayment: false // Initialize payment simulation status
                    })) as FlightRecordForMarketplace[];
                    setListedFlights(tokenizedFlights);
                } else {
                    throw new Error(result.message || "Received unexpected response format from backend.");
                }

            } catch (error: any) {
                console.error("Error fetching marketplace data:", error);
                toast.error(`Failed to load marketplace data: ${error.message}`);
                setListedFlights([]);
            } finally {
                setIsLoading(false);
            }
        };

        if (isConnected) {
            fetchListedFlights();
        } else {
            setListedFlights([]);
            setIsLoading(false);
        }
    }, [isConnected, address]);

    // Simulated Listing Logic
    const handleListForSale = (dataHash: string) => {
        setListedFlights((prevFlights) =>
            prevFlights.map((flight) =>
                flight.initialDataHash === dataHash ? { ...flight, isListed: true } : flight
            )
        );
        toast.success(`Your DGIP (Data Hash: ${dataHash.substring(0, 10)}...) has been successfully listed on the simulated marketplace!`);

        // Simulate a brief loading period
        setTimeout(() => {
            setListedFlights((prevFlights) =>
                prevFlights.map((flight) =>
                    flight.initialDataHash === dataHash ? { ...flight, isListed: false } : flight
                )
            );
        }, 3000); // Reset "listing" state after 3 seconds for demo purposes
    };

    // Royalty Simulation Functionality (moved from flight-history)
    const handleSimulateRoyalty = async (ipAssetId: string, licenseTermsId: number) => {
        if (!ipAssetId || licenseTermsId === null || typeof licenseTermsId === 'undefined') {
            toast.error("IP Asset ID or License Terms ID is missing for this flight. Please ensure it was tokenized.");
            return;
        }

        setSimulatingPaymentFlightId(ipAssetId); // Set loading state for this specific IP asset
        toast.info(`Simulating royalty payment for IP ID: ${ipAssetId}...`);

        try {
            const response = await fetch('/api/simulate-royalty-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ipId: ipAssetId, licenseTermsId: licenseTermsId }),
            });

            const result = await response.json();

            if (!response.ok || result.status === 'error') {
                const errorMessage = result.message || `Failed to simulate royalty payment (Status: ${response.status}).`;
                toast.error(errorMessage);
                console.error("Royalty simulation error:", result);
            } else {
                const txHashToDisplay = Array.isArray(result.txHash) ? result.txHash : result.txHash;
                toast.success(`Royalty payment simulated! Transaction Hash: ${txHashToDisplay.substring(0, 10)}...${txHashToDisplay.slice(-8)}`);
                console.log("Royalty simulation success:", result);
                // In a real scenario, you'd trigger a re-fetch of claimable revenue or update state
            }
        } catch (error: any) {
            console.error("Error during royalty payment simulation fetch:", error);
            toast.error(`An unexpected error occurred during simulation: ${error.message}`);
        } finally {
            setSimulatingPaymentFlightId(null); // Clear loading state
        }
    };


    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center px-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Connect Wallet to View Marketplace</CardTitle>
                        <CardDescription>
                            Please connect your wallet to see your tokenized IP Assets on the simulated marketplace.
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
                <p className="mt-2 text-muted-foreground">Loading marketplace data...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Your Tokenized DGIP Assets (Marketplace Preview)</CardTitle>
                    <CardDescription>
                        Demonstrating the commercial value and transactional capabilities of your IP Assets.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {listedFlights.length === 0 ? (
                        <p className="text-center text-muted-foreground">No tokenized flights found to list. Register and tokenize a new flight (Step 4) to see it here!</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {listedFlights.map((flight) => (
                                <Card key={flight.initialDataHash} className="p-4">
                                    <CardTitle className="text-xl">
                                        {flight.droneName} DGIP ({flight.flightDate})
                                    </CardTitle>
                                    <CardContent className="mt-2 text-sm space-y-1">
                                        <p><span className="font-semibold">Initial Data Hash:</span> {flight.initialDataHash.substring(0, 10)}...</p>
                                        {flight.ipfsCid && flight.ipfsCid !== "UPLOAD_FAILED" && (
                                            <p>
                                                <span className="font-semibold">DGIP IPFS CID:</span>{" "}
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
                                        <div className="mt-2 border-t pt-2">
                                            <h3 className="font-semibold text-md">Story Protocol Details:</h3>
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
                                            <p><span className="font-semibold">License Terms ID:</span> {flight.licenseTermsId}</p>
                                            <p><span className="font-semibold">Minted NFT Token ID:</span> {flight.mintedTokenId}</p>
                                        </div>

                                        <div className="mt-4 space-y-2">
                                            <Button
                                                onClick={() => handleListForSale(flight.initialDataHash)}
                                                disabled={flight.isListed}
                                                className="w-full"
                                            >
                                                {flight.isListed ? 'Listed (Simulated)' : 'Simulate Listing for Sale'}
                                            </Button>

                                            <Button
                                                onClick={() => handleSimulateRoyalty(flight.ipId, flight.licenseTermsId)}
                                                disabled={simulatingPaymentFlightId === flight.ipId}
                                                className="w-full"
                                            >
                                                {simulatingPaymentFlightId === flight.ipId ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simulating Payment...
                                                    </>
                                                ) : (
                                                    "Simulate Royalty Payment"
                                                )}
                                            </Button>
                                        </div>
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