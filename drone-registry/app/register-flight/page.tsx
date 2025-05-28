'use client';

import { useEffect, useState } from "react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from "sonner"; // Used for toast notifications [10]

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ComplianceSuggestions } from "@/components/compliance-suggestions"; // Used to display messages [11]
import { DgipSimulationDisplay } from "@/components/dgip-simulation-display"; // Used to display simulation [12]

import { useAccount, useWriteContract } from "wagmi"; // Wagmi hooks for wallet and contract interaction [13, 14]
import { Loader2 } from 'lucide-react';

import { flightFormSchema, type FlightFormData } from "@/lib/schemas"; // Zod schema for form validation [15]
import FlightDetailsDialog from "@/components/flight-details-dialog"; // Component for flight details form fields [16]

// Define the expected structure for the validation API response [17]
interface ValidationResult {
    complianceMessages: string[]; // Array of strings containing compliance/validation messages
    dataHash: string; // Keccak256 hash of the flight data [18, 19]
    ipfsCid: string | null; // IPFS CID where the data is stored [18, 19]
    error?: string; // Optional error message from the backend API or script
}

// Define the structure for a DGIP log entry [12, 20]
interface DgipLogEntry {
    timestamp: string;
    latitude: number;
    longitude: number;
    altitude: number;
    speed: number;
    heading: number;
    battery: number;
}

// Smart contract details - replace with your actual contract address and ABI [21]
const contractAddress = "0x2e87c81eC65C153c5326EbD05691a6CD830040F3";
const contractABI = [
    {
        "inputs": [{ "internalType": "address", "name": "initialOwner", "type": "address" }],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
        "name": "OwnableInvalidOwner",
        "type": "error"
    },
    {
        "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
        "name": "OwnableUnauthorizedAccount",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "uint256", "name": "flightId", "type": "uint256" },
            { "indexed": true, "internalType": "address", "name": "registrant", "type": "address" },
            { "indexed": true, "internalType": "bytes32", "name": "dataHash", "type": "bytes32" }
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
        "inputs": [{ "internalType": "bytes32", "name": "dataHash", "type": "bytes32" }],
        "name": "registerFlight",
        "outputs": [],
        "stateMutability": "nonpayable",
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
    }
] as const;

export default function RegisterFlightPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false); // State to control visibility of compliance suggestions
    const [validationResultData, setValidationResultData] = useState<ValidationResult | null>(null); // State to store validation results [22]
    const [validationError, setValidationError] = useState<string | null>(null); // State to display validation errors [13]

    // State for DGIP simulation [13]
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulatedDgip, setSimulatedDgip] = useState<DgipLogEntry[]>([]);
    const [currentLogIndex, setCurrentLogIndex] = useState(0);
    const [displayLog, setDisplayLog] = useState<DgipLogEntry | null>(null);

    const { isConnected } = useAccount(); // Wagmi hook to check wallet connection [13]
    const { writeContractAsync } = useWriteContract(); // Wagmi hook to interact with smart contract [13]

    const form = useForm<FlightFormData>({
        resolver: zodResolver(flightFormSchema), // Zod for form validation [15]
        defaultValues: {
            droneName: "",
            droneModel: "",
            droneType: "Quadcopter",
            serialNumber: "",
            weight: 0,
            flightPurpose: "Recreational",
            flightDescription: "",
            startTime: "",
            endTime: "",
            flightDate: "",
            dayNightOperation: "day",
            flightAreaCenter: { latitude: 0, longitude: 0 }, // Default for the object structure [1]
            flightAreaRadius: 0,
            flightAreaMaxHeight: 0,
        },
    });

    // Effect hook to manage DGIP simulation display interval [23]
    useEffect(() => {
        let intervalId: NodeJS.Timeout | undefined;
        if (isSimulating && simulatedDgip.length > 0) {
            intervalId = setInterval(() => {
                setCurrentLogIndex(prevIndex => {
                    if (prevIndex < simulatedDgip.length) {
                        setDisplayLog(simulatedDgip[prevIndex]);
                        return prevIndex + 1;
                    } else {
                        clearInterval(intervalId);
                        setIsSimulating(false);
                        toast("DGIP simulation finished."); // Toast notification [24]
                        return prevIndex;
                    }
                });
            }, 500); // Interval in milliseconds

            // Cleanup function to clear the interval
            return () => {
                if (intervalId) {
                    clearInterval(intervalId);
                }
            };
        }
         // Cleanup function if isSimulating becomes false before the loop finishes
        return () => {
            if (intervalId) {
                 clearInterval(intervalId);
            }
        };
    }, [isSimulating, simulatedDgip]); // Dependencies for the effect

    // Function to check if any compliance message indicates a critical error
    const hasCriticalErrors = (messages: string[]): boolean => {
        // Define keywords that indicate a critical error or non-compliance preventing registration
        // Based on the sample error message [25], we can look for "Error" and "non-compliance".
        const criticalErrorKeywords = ["Error", "non-compliance", "Failed"];

        for (const message of messages) {
            // Convert message to lowercase for case-insensitive check
            const lowerMessage = message.toLowerCase();
            for (const keyword of criticalErrorKeywords) {
                if (lowerMessage.includes(keyword.toLowerCase())) {
                    return true; // Found a critical error keyword
                }
            }
        }
        return false; // No critical error keywords found
    };

    // Main function to handle form submission and flight registration
    async function onSubmit(values: FlightFormData) {
        setIsSubmitting(true);
        setValidationError(null);
        setValidationResultData(null);
        setShowSuggestions(false);
        setDisplayLog(null); // Clear previous simulation display

        if (!isConnected) {
            toast("Please connect your wallet first to register the flight.");
            setIsSubmitting(false);
            return;
        }

        try {
            // Step 1: Send flight data to the backend API for validation
            const validationResponse = await fetch('/api/validate-flight', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            // Parse the JSON response from the backend
            const validationData: { result?: ValidationResult; error?: string } = await validationResponse.json();

            // Check if the API call itself failed or returned a top-level error [26]
            if (!validationResponse.ok || validationData.error) {
                const errorMessage = validationData.error || 'Validation failed with a server error.';
                console.error("Validation API Error:", errorMessage);
                setValidationError(errorMessage);
                toast(errorMessage); // Show toast notification for API errors
                setIsSubmitting(false);
                return;
            }

            // Step 2: Process the validation results
            // Ensure the expected result structure is present [27]
            if (validationData.result && Array.isArray(validationData.result.complianceMessages) && validationData.result.dataHash) {
                setValidationResultData(validationData.result); // Store the validation result data
                setShowSuggestions(true); // Show compliance suggestions section
                setValidationError(null); // Clear any previous validation errors

                // Step 3: Check for critical errors in compliance messages BEFORE blockchain registration
                if (hasCriticalErrors(validationData.result.complianceMessages)) {
                     const errorMessage = "Validation reported critical errors. Cannot proceed with blockchain registration.";
                     console.warn("Critical Validation Errors Detected:", validationData.result.complianceMessages);
                     setValidationError(errorMessage); // Set error message for critical errors
                     toast.error(errorMessage); // Use toast.error for critical issues
                     setIsSubmitting(false);
                     // Do NOT proceed with writeContractAsync if critical errors exist
                     return;
                }

                // Proceed with blockchain registration ONLY if no critical errors were found
                const dataHashHex = validationData.result.dataHash.replace(/^0x/, ''); // Remove 0x prefix if present

                // Basic check for data hash format before sending to contract [27]
                if (!dataHashHex || dataHashHex.length !== 64) {
                    const errorMessage = "Invalid data hash format received from validation API.";
                    console.error("Invalid Data Hash:", validationData.result.dataHash);
                    setValidationError(errorMessage);
                    toast.error(errorMessage); // Use toast.error for data hash format issue
                    setIsSubmitting(false);
                    return;
                }

                // Step 4: Register the data hash on the blockchain via smart contract
                try {
                    console.log("Proceeding with blockchain registration...");
                    const txResult = await writeContractAsync({ // Calls the smart contract function [28]
                        address: contractAddress,
                        abi: contractABI,
                        functionName: 'registerFlight', // Name of the function on your contract [29]
                        args: [`0x${dataHashHex}`], // Arguments for the function, dataHash as bytes32 [29]
                    });

                    console.log("Blockchain transaction sent:", txResult);
                    toast("Flight registration transaction sent. Awaiting confirmation..."); // Notify user transaction is sent [28]

                    // Note: For a production app, you would typically use useWaitForTransactionReceipt
                    // or similar logic here to wait for the transaction to be mined and confirmed
                    // before showing a final success message or enabling subsequent steps.
                    // For this example, we proceed after the transaction is sent.

                } catch (writeError: any) {
                    // Handle errors during the blockchain transaction call [28]
                    const txErrorMessage = writeError.message || "Failed to send transaction.";
                    console.error("Blockchain Registration Failed:", writeError);
                    setValidationError(`Blockchain Registration Failed: ${txErrorMessage}`);
                    toast.error(`Failed to register flight on-chain: ${txErrorMessage}`); // Use toast.error for transaction failures
                    setIsSubmitting(false);
                    return; // Stop the process after transaction failure
                }

                // If validation was successful and transaction was sent, clear submitting state
                setIsSubmitting(false);
                // At this point, validation was successful and tx was sent.
                // The user can now proceed to simulate DGIP if desired.

            } else {
                // Handle unexpected response format from the validation API [30]
                const errorMessage = "Received unexpected response format from validation API.";
                 console.error("Unexpected API Response Format:", validationData);
                setValidationError(errorMessage);
                toast.error(errorMessage); // Use toast.error for unexpected API response
                setIsSubmitting(false);
            }

        } catch (error: any) {
            // Handle any general errors during the fetch call or initial processing [30]
            const genericErrorMessage = error.message || "An unexpected error occurred during registration.";
             console.error("Unexpected Error during onSubmit:", error);
            setValidationError(genericErrorMessage);
            toast.error(`An unexpected error occurred: ${genericErrorMessage}`); // Use toast.error for general errors
            setIsSubmitting(false);
        }
    }

    // Function to trigger DGIP simulation [30]
    const handleStartSimulation = async () => {
        setIsSimulating(true);
        setSimulatedDgip([]);
        setCurrentLogIndex(0);
        setDisplayLog(null);
        setValidationError(null); // Clear any previous errors before simulating

        try {
            const flightData = form.getValues(); // Get the current flight data from the form [31]

            // Call the backend API route to start DGIP logging simulation [31]
            const response = await fetch('/api/start-dgip-logging', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(flightData),
            });

            // Check if the API call was successful [31]
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to start simulation');
            }

            // Parse the result and check if data was generated [32]
            const result = await response.json();
            const generatedDgip = result.dgipData as DgipLogEntry[];

            if (!Array.isArray(generatedDgip) || generatedDgip.length === 0) {
                throw new Error("Simulation generated no log entries.");
            }

            setSimulatedDgip(generatedDgip); // Store the generated DGIP data
            console.log("Simulated DGIP data received:", generatedDgip);

        } catch (error: any) {
            // Handle errors during the simulation API call [32]
            const simulationErrorMessage = error.message || "There was an error starting the DGIP simulation.";
            console.error("Simulation Error:", error);
            setValidationError(simulationErrorMessage);
            toast.error(`Simulation Failed: ${simulationErrorMessage}`); // Use toast.error for simulation failures
            setIsSimulating(false); // Stop simulation state on error
        }
        // Note: isSimulating state is set to false in the useEffect when simulation finishes
    };

    return (
        <Card className="w-full max-w-2xl mx-auto my-8">
            <CardHeader>
                <CardTitle>Register Flight</CardTitle>
                <CardDescription>Register your drone flight details for compliance, validation, and DGIP generation.</CardDescription>
            </CardHeader>
            <CardContent>
                {/* Display validation errors if any [33] */}
                {validationError && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTitle>Validation Error</AlertTitle>
                        <AlertDescription>{validationError}</AlertDescription>
                    </Alert>
                )}

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                         {/* Flight Details Form component renders the actual form fields [16] */}
                        <FlightDetailsDialog form={form} />

                        {/* Submit button for the form [33] */}
                        <Button type="submit" className="w-full" disabled={isSubmitting || !isConnected}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Registering & Validating...
                                </>
                            ) : (
                                isConnected ? "Submit Flight Details & Register" : "Connect Wallet to Register"
                            )}
                        </Button>
                    </form>
                </Form>

                {/* Display compliance suggestions if available after validation [33] */}
                {/* Ensure suggestions are shown even if there are critical errors, as the user needs to see them */}
                {showSuggestions && validationResultData?.complianceMessages && validationResultData.complianceMessages.length > 0 && (
                    <div className="mt-6">
                        <ComplianceSuggestions suggestions={validationResultData.complianceMessages} />
                    </div>
                )}

                 {/* Button to start DGIP simulation - only show after validation result is received and not submitting */}
                {validationResultData && !isSubmitting && (
                    <div className="mt-6 text-center">
                         <Button
                            onClick={handleStartSimulation}
                            disabled={isSimulating} // Disable if already simulating
                        >
                            {isSimulating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Simulating DGIP...
                                </>
                            ) : (
                                "Start Logging DGIP"
                            )}
                        </Button>
                    </div>
                )}


                {/* Display area for the live DGIP simulation logs [33] */}
                 {(displayLog || isSimulating) && (
                    <div className="mt-6">
                        <DgipSimulationDisplay
                            displayLog={displayLog}
                            currentLogIndex={currentLogIndex}
                            totalLogs={simulatedDgip.length}
                            isSimulating={isSimulating}
                        />
                    </div>
                )}

                {/* Display registration details (Data Hash, IPFS CID) after validation [34] */}
                 {/* This section shows even if registration failed on-chain, as the data hash and CID were still generated */}
                {validationResultData && (
                    <div className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Registration Details</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm">
                                {validationResultData.dataHash && (
                                    <p><strong>Data Hash (Keccak256):</strong> {validationResultData.dataHash}</p>
                                )}
                                {validationResultData.ipfsCid && (
                                     <p><strong>IPFS CID:</strong> {validationResultData.ipfsCid}</p>
                                )}
                                {!validationResultData.dataHash && !validationResultData.ipfsCid && (
                                    <p>No on-chain or IPFS data available yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}


            </CardContent>
        </Card>
    );
}