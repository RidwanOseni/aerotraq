"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ComplianceSuggestions } from "@/components/compliance-suggestions";
import { useAccount } from "wagmi"; // Keep useAccount from wagmi
import { useWriteContract } from 'wagmi'; // Import hook
import { flightFormSchema, type FlightFormData } from "@/lib/schemas";
import FlightDetailsDialog from "@/components/flight-details-dialog";
import { ethers } from "ethers";
import type { Hex } from 'viem'; // Import Hex type from viem

// Define the expected structure of the successful validation response result
interface ValidationResult {
  complianceMessages: string[];
  dataHash: string; // Assuming this is a hex string representation of bytes32
  ipfsCid: string;
}

const contractAddress = "0x2e87c81eC65C153c5326EbD05691a6CD830040F3"; // As per source [1]

// Your contract ABI as per sources [1-5]
const contractABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "initialOwner",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }
        ],
        "name": "OwnableInvalidOwner",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "OwnableUnauthorizedAccount",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "flightId",
                "type": "uint256"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "registrant",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "dataHash",
                "type": "bytes32"
            }
        ],
        "name": "FlightRegistered",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "dataHash",
                "type": "bytes32"
            }
        ],
        "name": "registerFlight",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    // ... other ABI entries ...
] as const; // Use 'as const' for better type inference

export default function RegisterFlightPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [validationResultData, setValidationResultData] = useState<ValidationResult | null>(null); // Added type annotation based on interface
  const [validationError, setValidationError] = useState<string | null>(null); // Added type annotation
  const { isConnected } = useAccount();

  const form = useForm<FlightFormData>({ // Added type annotation
    resolver: zodResolver(flightFormSchema),
    defaultValues: { 
      droneName: "",
      droneModel: "",
      serialNumber: "",
      weight: 0,
      flightDescription: "",
      startTime: "",
      endTime: "",
      flightDate: "",
      dayNightOperation: "",
      flightAreaCenter: "",
      flightAreaRadius: 0,
      flightAreaMaxHeight: 0,
      flightPurpose: "Recreational"
    },
  });

  // Use useWriteContract but remove the onSuccess/onError callbacks from HERE
  // Use writeContractAsync from the returned object
  const { writeContractAsync } = useWriteContract(); // Changed from { writeContract }

  async function onSubmit(values: FlightFormData) {
    setIsSubmitting(true);
    setValidationError(null);
    setValidationResultData(null);
    setShowSuggestions(false);
    console.log("Form Values:", values);

    if (!isConnected) {
      alert("Please connect your wallet first.");
      setIsSubmitting(false);
      return;
    }

    try {
      const validationResponse = await fetch('/api/validate-flight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const validationData: { result?: ValidationResult; error?: string } = await validationResponse.json();
      console.log("Validation Data:", validationData);

      if (!validationResponse.ok) {
        const errorMessage = validationData.error || 'Validation failed with server error.';
        setValidationError(errorMessage);
        setIsSubmitting(false);
        return; // Stop execution
      }

      // Check if validationData.result is not null/undefined and has complianceMessages and dataHash
      if (validationData.result && Array.isArray(validationData.result.complianceMessages) && validationData.result.dataHash) {
        setValidationResultData(validationData.result);
        setShowSuggestions(true);
        setValidationError(null); // Clear previous validation errors if successful

        // Ensure the dataHash is a non-empty hex string before proceeding
        const dataHashHex = validationData.result.dataHash;
        if (!dataHashHex || dataHashHex.length !== 64) { // Keccak256 hex is 64 chars
           throw new Error("Invalid data hash received from validation API.");
        }

        // Corrected call to writeContract
        // Pass the hex string directly with the 0x prefix.
        await writeContractAsync({
          address: contractAddress,
          abi: contractABI,
          functionName: 'registerFlight',
          args: [`0x${dataHashHex}`], // Pass the hex string with 0x prefix
        });

        // Reset form and state on successful transaction
        form.reset();
        setValidationResultData(null);
        setShowSuggestions(false);
        setIsSubmitting(false); // Stop submitting on success

      } else if (validationData.error) {
        setValidationError(validationData.error);
        setIsSubmitting(false); // Stop submitting if validation returned error
      } else {
        const errorMessage = "Received unexpected response format from validation API.";
        setValidationError(errorMessage);
        console.error(errorMessage, validationData);
        setIsSubmitting(false); // Stop submitting on unexpected format
      }

    } catch (error) {
      console.error("Error in onSubmit:", error);
      setValidationError(error instanceof Error ? error.message : String(error));
      setIsSubmitting(false); // Stop submitting on catch error
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto"> 
      <CardHeader>
        <CardTitle>Register Flight</CardTitle>
        <CardDescription>Register your drone flight details for compliance and insurance purposes</CardDescription>
      </CardHeader>
      <CardContent>
        {validationError && (
          <Alert variant="destructive">
            <AlertTitle>Validation Error</AlertTitle>
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}
        <FlightDetailsDialog onSubmit={onSubmit} />
        {showSuggestions && validationResultData?.complianceMessages && validationResultData.complianceMessages.length > 0 && (
          <ComplianceSuggestions suggestions={validationResultData.complianceMessages} />
        )}
      </CardContent>
      <CardFooter>
        {/* Additional footer content if needed */}
      </CardFooter>
    </Card>
  );
}