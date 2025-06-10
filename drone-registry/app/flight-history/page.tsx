'use client';

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { Loader2 } from 'lucide-react';

// Define the interface for a FlightRecord, including Story Protocol details
interface FlightRecord {
    dataHash: string; // The Keccak256 hash of the initial flight data
    ipfsCid: string | null; // IPFS CID of the initial flight data
    ipId: string | null; // Story Protocol IP Asset ID
    licenseTermsId: number | null; // Story Protocol License Terms ID
    droneName: string; // Add other relevant flight details you might want to display from your initial flight data
    flightDate: string;
}

export default function FlightHistoryPage() {
    const { isConnected, address } = useAccount(); // Get wallet connection status and address

    // Explicitly type the state variables to resolve 'never' errors
    const [flights, setFlights] = useState<FlightRecord[]>([]); // FIX: Explicitly typed as FlightRecord[]
    const [isLoading, setIsLoading] = useState(true);
    // FIX: Explicitly typed as string | null to allow storing dataHash
    const [isSimulatingPayment, setIsSimulatingPayment] = useState<string | null>(null);

    useEffect(() => {
        // Function to fetch flight data from the backend
        const fetchFlights = async () => {
            setIsLoading(true); // Set loading state to true
            try {
                // --- IMPORTANT: Placeholder for fetching actual flight data ---
                // In a real application, you would fetch all flights associated with the connected user's
                // wallet address from your database. This would likely involve a new backend API route
                // (e.g., `/api/get-user-flights`) that queries your SQLite DB for records in
                // `flight_mappings` that belong to the user.
                // For this MVP, we will simulate fetching a single successful flight.
                // FIX: Initialize with an empty string, allowing the check for replacement
                const exampleDataHash = "0xccb837f19fb751f0c853261d4f5bf3d3335ba959aba73e3e5c6b74122d6e2a5f"; // <<< REPLACE WITH AN ACTUAL dataHash from your `flight_data.db` (e.g., "0xc33ed0e8d3aa5fc702164de4cbc2b9095908fe22172d14ec1312e76cb8e6e2d4")

                // FIX: Modified the check to be more robust for an empty string placeholder
                if (!exampleDataHash) {
                    console.warn("Please replace the empty string in app/flight-history/page.tsx with a valid dataHash from your database to see IP Asset details.");
                    setFlights([]); // No example flight to show
                    return;
                }

                // Call the new API route to fetch Story Protocol IP details for the example dataHash
                const ipDetailsResponse = await fetch('/api/get-story-ip-details', { // MODIFIED LINE
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataHash: exampleDataHash }),
                  });

                if (!ipDetailsResponse.ok) {
                    const errorData = await ipDetailsResponse.json();
                    throw new Error(errorData.error || `Failed to fetch IP details (Status: ${ipDetailsResponse.status}).`);
                }

                const ipDetails = await ipDetailsResponse.json();
                console.log("Fetched IP details:", ipDetails);

                // Construct a mock FlightRecord. In a real app, you'd fetch full flight details
                // and then augment them with IP details if available.
                if (ipDetails.ipId && ipDetails.licenseTermsId !== null) {
                    setFlights([{
                        dataHash: exampleDataHash,
                        ipfsCid: "mock_ipfs_cid_from_db", // This would typically also come from your DB query
                        ipId: ipDetails.ipId,
                        licenseTermsId: ipDetails.licenseTermsId,
                        droneName: "DGIP Flight 001", // Mocked drone name for display
                        flightDate: "2024-07-20", // Mocked flight date for display
                    }]);
                } else {
                    console.warn(`No Story Protocol IP details found for dataHash: ${exampleDataHash}. Make sure Step 4 was completed successfully for this flight.`);
                    // You might still add the flight but mark it as 'IP Asset not tokenized'
                    setFlights([{
                        dataHash: exampleDataHash,
                        ipfsCid: "mock_ipfs_cid_from_db",
                        ipId: null,
                        licenseTermsId: null,
                        droneName: "DGIP Flight 001",
                        flightDate: "2024-07-20",
                    }]);
                }

            } catch (error: any) {
                console.error("Error fetching flight history:", error);
                toast.error(`Failed to load flight history: ${error.message}`);
                setFlights([]); // Clear flights on error
            } finally {
                setIsLoading(false); // Set loading state to false once data is fetched or error occurs
            }
        };

        // Only fetch flights if the wallet is connected
        if (isConnected) {
            fetchFlights();
        } else {
            setFlights([]); // Clear flights if wallet is disconnected
            setIsLoading(false); // Stop loading
        }
    }, [isConnected, address]); // Re-run effect when wallet connection status changes

    // Function to handle the "Simulate Royalty Payment" button click
    const handleSimulateRoyalty = async (flightDataHash: string, ipAssetId: string, licenseTermsId: number) => {
        // Ensure IP Asset ID and License Terms ID are available before proceeding
        if (!ipAssetId) {
            toast.error("IP Asset ID is missing for this flight. Please ensure it was tokenized in Step 4.");
            return;
        }
        if (licenseTermsId === null || typeof licenseTermsId === 'undefined') {
            toast.error("License Terms ID is missing for this flight. Please ensure it was tokenized in Step 4.");
            return;
        }

        setIsSimulatingPayment(flightDataHash); // Set loading state for this specific flight card
        toast.info(`Simulating royalty payment for flight (IP ID: ${ipAssetId})...`);

        try {
            // Call your new backend API route for royalty payment simulation
            const response = await fetch('/api/simulate-royalty-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ipId: ipAssetId, licenseTermsId: licenseTermsId }), // Pass the IP Asset ID and License Terms ID to the backend
            });

            const result = await response.json(); // Parse the JSON response from the backend

            // Check for success or error based on the backend's response structure
            if (!response.ok || result.status === 'error') {
                const errorMessage = result.message || `Failed to simulate royalty payment (Status: ${response.status}).`;
                toast.error(errorMessage);
                console.error("Royalty simulation error:", result);
            } else {
                toast.success(`Royalty payment simulated! Transaction Hash: ${result.txHash.substring(0, 10)}...${result.txHash.slice(-8)}`);
                console.log("Royalty simulation success:", result);
                // You might want to refresh claimable revenue for User A here in a real scenario (Step 6)
            }

        } catch (error: any) {
            console.error("Error during royalty payment simulation fetch:", error);
            toast.error(`An unexpected error occurred during simulation: ${error.message}`);
        } finally {
            setIsSimulatingPayment(null); // Clear loading state for the current flight
        }
    };

    // Render content based on wallet connection and loading status
    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Connect Wallet to View Flight History</CardTitle>
                        <CardDescription>
                            Please connect your wallet to see your registered drone flights and manage your IP Assets.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Assuming WalletConnect component is available and handles connection */}
                        {/* You will need to import WalletConnect if it's not already */}
                        {/* <WalletConnect /> */}
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-lg">Loading flight history...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h2 className="text-3xl font-bold mb-6 text-center">Your Flight History & IP Assets</h2>
            {flights.length === 0 ? (
                <Card className="w-full max-w-2xl mx-auto text-center py-8">
                    <CardContent>
                        <p className="text-lg text-muted-foreground">No flights found. Register a new flight to get started!</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {flights.map((flight) => (
                        <Card key={flight.dataHash}>
                            <CardHeader>
                                <CardTitle>{flight.droneName} Flight on {flight.flightDate}</CardTitle>
                                <CardDescription>
                                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                                        <li>*Data Hash:* {flight.dataHash}</li>
                                        {/* Display IPFS CID if available */}
                                        {flight.ipfsCid && (
                                            <li>
                                                *IPFS CID:*{" "}
                                                <a href={`https://ipfs.io/ipfs/${flight.ipfsCid}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                    {flight.ipfsCid}
                                                </a>
                                            </li>
                                        )}
                                    </ul>
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {flight.ipId ? (
                                    <div className="space-y-2">
                                        <p className="font-semibold text-lg">Story Protocol IP Asset Details:</p>
                                        <ul className="text-sm space-y-1">
                                            <li>
                                                *IP Asset ID:*{" "}
                                                <a href={`https://aeneid.explorer.story.foundation/ip/${flight.ipId}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                    {flight.ipId}
                                                </a>
                                            </li>
                                            <li>*License Terms ID:* {flight.licenseTermsId}</li>
                                        </ul>
                                        {/* Button to simulate royalty payment */}
                                        <Button
                                            onClick={() => handleSimulateRoyalty(flight.dataHash, flight.ipId!, flight.licenseTermsId!)}
                                            disabled={isSimulatingPayment === flight.dataHash} // Disable if this flight is simulating
                                            className="mt-4 w-full"
                                        >
                                            {isSimulatingPayment === flight.dataHash ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Simulating Payment...
                                                </>
                                            ) : (
                                                "Simulate Royalty Payment"
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    // Message if IP Asset is not tokenized (Step 4 not completed for this flight)
                                    <p className="text-red-500">IP Asset not yet tokenized for this flight (Step 4 required).</p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}