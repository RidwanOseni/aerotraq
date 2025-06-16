'use client';

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { Loader2 } from 'lucide-react';
import { useTomoWalletServices } from '@/hooks/useTomoWalletServices';

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
    const { openOnRamp, openSwap } = useTomoWalletServices();
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
        // Removed setTimeout to make the 'isListed' status persist until explicitly unlisted (if unlisting is implemented later).
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
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-xl">Connect Wallet to View Marketplace</CardTitle>
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
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                <p className="mt-4 text-gray-600">Loading marketplace data...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <Card className="w-full max-w-3xl mx-auto mb-6">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Your Tokenized DGIP Assets (Marketplace Preview)</CardTitle>
                    <CardDescription className="mb-4">
                        Need $WIP for royalty payments? Acquire it here seamlessly.
                    </CardDescription>
                    <div className="flex gap-4 mb-8">
                        <Button
                            onClick={openOnRamp}
                            disabled={!isConnected}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                            Buy $WIP (On-Ramp)
                        </Button>
                        <Button
                            onClick={openSwap}
                            disabled={!isConnected}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            Swap for $WIP
                        </Button>
                    </div>
                    <CardDescription>
                        Demonstrating the commercial value and transactional capabilities of your IP Assets.
                    </CardDescription>
                </CardHeader>
            </Card>

            {listedFlights.length === 0 ? (
                <Card className="w-full max-w-3xl mx-auto">
                    <CardContent className="p-6 text-center text-gray-600">
                        No tokenized flights found to list. Register and tokenize a new flight (Step 4) to see it here!
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listedFlights.map((flight) => (
                        <Card key={flight.initialDataHash} className="flex flex-col justify-between">
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    {flight.droneName} DGIP ({flight.flightDate})
                                </CardTitle>
                                <CardDescription className="text-sm text-gray-500">
                                    Initial Data Hash: {flight.initialDataHash.substring(0, 10)}...
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm text-gray-700">
                                {flight.ipfsCid && flight.ipfsCid !== "UPLOAD_FAILED" && (
                                    <p className="text-sm text-gray-500 mt-1">
                                        DGIP IPFS CID:{" "}
                                        <a
                                            href={`https://ipfs.io/ipfs/${flight.ipfsCid}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline break-all" // Added break-all here for text wrapping
                                        >
                                            {flight.ipfsCid}
                                        </a>
                                    </p>
                                )}
                                <p className="font-semibold">Story Protocol Details:</p>
                                <p>
                                    IP Asset ID:{" "}
                                    <a
                                        href={`https://aeneid.explorer.story.foundation/ip/${flight.ipId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:underline break-all" // Added break-all here for text wrapping
                                    >
                                        {flight.ipId.substring(0, 8)}...{flight.ipId.slice(-6)} (View on Explorer)
                                    </a>
                                </p>
                                <p>License Terms ID: {flight.licenseTermsId}</p>
                                <p>Minted NFT Token ID: {flight.mintedTokenId}</p>
                            </CardContent>
                            <CardContent className="mt-4 flex flex-col gap-2">
                                <Button
                                    onClick={() => handleListForSale(flight.initialDataHash)}
                                    disabled={flight.isListed}
                                    className={`w-full ${flight.isListed ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`} // Enhanced button styling
                                >
                                    {flight.isListed ? 'Listed (Simulated)' : 'Simulate Listing for Sale'}
                                </Button>
                                <Button
                                    onClick={() => handleSimulateRoyalty(flight.ipId, flight.licenseTermsId)}
                                    disabled={simulatingPaymentFlightId === flight.ipId}
                                    className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                                >
                                    {simulatingPaymentFlightId === flight.ipId ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Simulating Payment...
                                        </>
                                    ) : (
                                        "Simulate Royalty Payment"
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}