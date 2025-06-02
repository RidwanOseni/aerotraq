'use client';

import { useEffect, useState } from "react";

import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';

import { toast } from "sonner";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ComplianceSuggestions } from "@/components/compliance-suggestions";

import { useAccount, useWriteContract, useConfig } from "wagmi"; // Import useConfig

import { Loader2 } from 'lucide-react';

import { isHex, hexToBytes } from 'viem';

import { getPublicClient } from 'wagmi/actions';

// Import the FlightDetailsDialog component containing the form fields
import FlightDetailsDialog from "@/components/flight-details-dialog";

import { DgipSimulationDisplay } from "@/components/dgip-simulation-display";

import { flightFormSchema, type FlightFormData } from "@/lib/schemas";

// Interfaces matching backend validation/processing responses
interface ValidationResult {
  complianceMessages: string[];
  dataHash: string | null;
  ipfsCid: string | null;
  is_critically_compliant: boolean;
  error?: string;
  raw_validation_data?: any;
}

// Interface for a single DGIP log entry, matching the simulation script output
interface DgipLogEntry {
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  battery: number;
}

// Contract address and ABI for the DroneFlight contract
const contractAddress = "0xbf9da8c38e15105f0ada872ea78512991d6a601c";

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
        "internalType": "bytes32",
        "name": "initialDataHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "dgipDataHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "registrant",
        "type": "address"
      }
    ],
    "name": "DGIPDataRegistered",
    "type": "event"
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
        "name": "initialDataHash",
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
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "flightRecords",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "initialDataHash",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "registrant",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "initialDataHash",
        "type": "bytes32"
      }
    ],
    "name": "getDgipHash",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "flightId",
        "type": "uint256"
      }
    ],
    "name": "getFlight",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getMyFlights",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "initialDataHashToFlightId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "initialHashExists",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "initialHashToDgipHash",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextFlightId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "initialDataHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "dgipDataHash",
        "type": "bytes32"
      }
    ],
    "name": "registerDGIPData",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "initialDataHash",
        "type": "bytes32"
      }
    ],
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
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "userFlights",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export default function RegisterFlightPage() {
  // State for initial registration process
  const [isSubmitting, setIsSubmitting] = useState(false);
  // State to show compliance suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Stores initial validation hash/cid and messages
  const [validationResultData, setValidationResultData] = useState<ValidationResult | null>(null);
  // State for validation errors
  const [validationError, setValidationError] = useState<string | null>(null);

  // State for DGIP simulation process
  const [isSimulating, setIsSimulating] = useState(false);
  // Stores simulated DGIP log entries
  const [simulatedDgip, setSimulatedDgip] = useState<DgipLogEntry[]>([]);
  // Tracks current log entry displayed
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  // The log entry currently displayed
  const [displayLog, setDisplayLog] = useState<DgipLogEntry | null>(null);

  // New state for DGIP processing (hashing/uploading/linking)
  const [isProcessingDgip, setIsProcessingDgip] = useState(false);
  // New state for DGIP data hash (Keccak256)
  const [dgipDataHash, setDgipDataHash] = useState<string | null>(null);
  // New state for DGIP IPFS CID
  const [dgipIpfsCid, setDgipIpfsCid] = useState<string | null>(null);
  // New state for DGIP on-chain linking transaction hash
  const [dgipRegistrationTxHash, setDgipRegistrationTxHash] = useState<`0x${string}` | null>(null);

  // Wagmi hooks for wallet connection, contract interaction, and config
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig(); // Get the wagmi config

  // react-hook-form setup
  const form = useForm<FlightFormData>({
    resolver: zodResolver(flightFormSchema),
    defaultValues: {
      droneName: "",
      droneModel: "",
      droneType: "Quadcopter",
      serialNumber: "",
      weight: 0,
      flightPurpose: "Recreational",
      flightDescription: "",
      flightDate: "",
      startTime: "",
      endTime: "",
      dayNightOperation: "day",
      flightAreaCenter: { latitude: 0, longitude: 0 },
      flightAreaRadius: 0,
      flightAreaMaxHeight: 0,
    },
  });

  // Effect to manage DGIP simulation display updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isSimulating && simulatedDgip.length > 0) {
      // This interval drives the simulation display
      intervalId = setInterval(() => {
        setCurrentLogIndex((prevIndex) => {
          if (prevIndex < simulatedDgip.length - 1) {
            return prevIndex + 1;
          } else {
            setIsSimulating(false); // Simulation finished
            clearInterval(intervalId);
            return prevIndex; // Stay on the last index
          }
        });
      }, 100); // Adjust interval speed as needed for simulation pace
    } else if (simulatedDgip.length > 0) {
      // If index is out of bounds after simulation finishes, show the last one
      setDisplayLog(simulatedDgip[simulatedDgip.length - 1]);
    } else {
      // If simulation data is empty or reset, clear display
      setDisplayLog(null);
    }

    // Update the displayed log entry whenever currentLogIndex or simulatedDgip changes
    if (simulatedDgip.length > 0 && currentLogIndex < simulatedDgip.length) {
        setDisplayLog(simulatedDgip[currentLogIndex]);
    }


    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isSimulating, simulatedDgip, currentLogIndex]);

  // Main function to handle initial flight registration submission
  async function onSubmit(values: FlightFormData) {
    setIsSubmitting(true); // Set loading state for initial submission
    setValidationError(null); // Clear previous errors
    setValidationResultData(null); // Clear previous validation results
    setShowSuggestions(false); // Hide suggestions until new validation

    // Reset DGIP specific states for a fresh registration flow
    setIsProcessingDgip(false);
    setDgipDataHash(null);
    setDgipIpfsCid(null);
    setDgipRegistrationTxHash(null);
    setSimulatedDgip([]); // Clear previous simulation data
    setCurrentLogIndex(0);
    setDisplayLog(null);

    // Ensure wallet is connected before proceeding
    if (!isConnected) {
      toast("Please connect your wallet first to register the flight.");
      setIsSubmitting(false);
      return;
    }

    try {
      // Call the backend API for flight data validation, hashing, and initial IPFS upload
      const validationResponse = await fetch('/api/validate-flight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      // Expecting { result?: ValidationResult; error?: string } from backend
      const validationData: { result?: ValidationResult; error?: string } = await validationResponse.json();

      // Handle API errors (non-2xx status) or backend-detected top-level errors
      if (!validationResponse.ok || validationData.error) {
        const errorMessage = validationData.error || `Validation failed with server error (Status: ${validationResponse.status}).`;
        setValidationError(errorMessage);
        toast.error(errorMessage);
        setIsSubmitting(false);
        return; // Stop here if the backend indicated a failure
      }

      // Process successful response from backend (Status: 200, no top-level error)
      // Now check the backend's explicit compliance flag and the presence of dataHash
      if (validationData.result && Array.isArray(validationData.result.complianceMessages)) {
        // Always show compliance suggestions regardless of critical status
        setValidationResultData(validationData.result); // Store validation results
        setShowSuggestions(true); // Show compliance suggestions

        // Check the backend's critical compliance flag
        if (!validationData.result.is_critically_compliant || !validationData.result.dataHash) {
          // If backend says not compliant OR did not provide a dataHash
          const errorMessage = validationData.result.error || "Flight plan did not pass critical validation checks. Blockchain registration halted.";
          console.warn("Backend reported critical validation issues or missing hash.");
          setValidationError(errorMessage); // Set error message
          toast.error(errorMessage);
          setIsSubmitting(false);
          // Halt the process *before* the blockchain transaction
          return;
        }

        console.log("Backend reported critical compliance. Proceeding with blockchain registration.");
        const initialDataHash = validationData.result.dataHash; // Use the data hash from the backend

        // --- Proceed to Initial Flight Registration On-Chain ---
        try {
          // Ensure 0x prefix and correct length (66 chars total)
          const finalDataHash = initialDataHash.startsWith('0x') ? initialDataHash : `0x${initialDataHash}`;

          // Optional Validation Tip: More robust check using viem utils
          // Ensure the string is a valid hex string and represents exactly 32 bytes.
          if (!isHex(finalDataHash) || hexToBytes(finalDataHash).length !== 32) {
            throw new Error("Invalid initial data hash format or length for bytes32.");
          }

          // Implement the check from duplicate-debug.txt BEFORE calling the contract
          const client = getPublicClient(config); // Pass the config to getPublicClient

          if (!client) {
            // This should not happen if Wagmi is configured correctly
            throw new Error("Viem public client is not available.");
          }

          // Use readContract to query the initialHashExists mapping on the smart contract
          const hashExists = await client.readContract({
            address: contractAddress,
            abi: contractABI,
            functionName: 'initialHashExists',
            args: [finalDataHash as `0x${string}`], // Pass the bytes32 hash as the argument
          });

          if (hashExists) {
            // If the hash already exists on the contract, show an error and stop the process
            const registrationError = "Flight plan with this hash is already registered on-chain. Please use a new flight plan or hash.";
            setValidationError(registrationError);
            toast.error(registrationError);
            setIsSubmitting(false);
            console.warn("Hash already exists on-chain, skipping blockchain registration.");
            return; // Halt the process as the flight is a duplicate
          }

          // Only proceed with the transaction if the hash does NOT exist
          // Call the smart contract function to register the initial flight plan hash
          const txResult = await writeContractAsync({ // Use wagmi hook to interact with contract
            address: contractAddress,
            abi: contractABI,
            functionName: 'registerFlight', // Call the initial registration function
            args: [finalDataHash as `0x${string}`], // Pass the correctly formatted bytes32 value
          });

          toast(`Initial flight registration transaction sent: ${txResult}. Awaiting confirmation...`); // Notify user
        } catch (writeError: any) {
          // Handle blockchain transaction errors
          const txErrorMessage = writeError.message || "Failed to send transaction.";
          setValidationError(`Blockchain Registration Failed: ${txErrorMessage}`);
          toast.error(`Failed to register initial flight plan on-chain: ${txErrorMessage}`);
          setIsSubmitting(false); // Ensure loading state is turned off on error
          return; // Stop here if on-chain registration fails
        }

        setIsSubmitting(false); // Initial submission process complete successfully
      } else {
        // Handle unexpected successful response structure from backend
        const errorMessage = "Received unexpected successful response format from validation API.";
        setValidationError(errorMessage);
        toast.error(errorMessage);
        setIsSubmitting(false);
      }

    } catch (error: any) {
      // Handle general errors during the fetch call or unexpected issues
      const genericErrorMessage = error.message || "An unexpected error occurred during initial registration.";
      console.error("Error in onSubmit fetch or processing:", error); // Log error for debugging
      setValidationError(genericErrorMessage);
      toast.error(genericErrorMessage);
      setIsSubmitting(false);
    }
  }

  // Function to start the DGIP simulation by calling the backend route
  const handleStartSimulation = async () => {
    setIsSimulating(true); // Set simulation loading state

    // Reset DGIP simulation and processing states
    setSimulatedDgip([]);
    setCurrentLogIndex(0);
    setDisplayLog(null);
    setValidationError(null); // Clear any previous errors
    setIsProcessingDgip(false);
    setDgipDataHash(null);
    setDgipIpfsCid(null);
    setDgipRegistrationTxHash(null);

    try {
      const flightData = form.getValues(); // Get current form values for simulation parameters

      // Call the backend endpoint to generate simulated DGIP logs
      const response = await fetch('/api/start-dgip-logging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flightData), // Send flight parameters to backend
      });

      if (!response.ok) { // Handle backend errors
        const errorData = await response.json(); // Assuming backend sends JSON on error
        throw new Error(errorData.error || `Failed to start simulation (Status: ${response.status}).`); // Use backend error or default
      }

      const data: { dgipData: DgipLogEntry[] } = await response.json(); // Expecting { dgipData: [...] }

      if (!Array.isArray(data.dgipData)) { // Basic validation of received data structure
        throw new Error("Received invalid data format for simulation logs.");
      }

      setSimulatedDgip(data.dgipData); // Store the simulated logs
      // Simulation display effect will start automatically once simulatedDgip is set

    } catch (error: any) {
      // Handle general errors during the fetch call or simulation process
      const simulationErrorMessage = error.message || "There was an error starting the DGIP simulation.";
      console.error("Error in handleStartSimulation fetch or processing:", error); // Log error for debugging
      setValidationError(simulationErrorMessage);
      toast.error(simulationErrorMessage);
      setIsSimulating(false); // Stop simulation loading state on error
    }
  };

  // Function to handle processing and uploading DGIP logs after simulation is complete
  const handleProcessAndUploadDgip = async () => {
    // Ensure simulation data exists and initial registration was successful (needed for linking)
    if (!simulatedDgip || simulatedDgip.length === 0) {
      toast.warning("No DGIP data to process.");
      return;
    }

    // The initialDataHash is needed to link the DGIP data on-chain.
    // This hash should have been successfully generated and stored after the initial validation/registration step.
    if (!validationResultData?.dataHash) {
      toast.warning("Initial flight registration hash is missing. Cannot link DGIP data on-chain.");
      return;
    }

    setIsProcessingDgip(true); // Set loading state for DGIP processing
    setValidationError(null); // Clear previous errors
    setDgipRegistrationTxHash(null); // Clear previous linking transaction hash

    try {
      // Call the new backend endpoint to process DGIP data (hashing, IPFS upload)
      const processResponse = await fetch('/api/process-dgip-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulatedDgip), // Send the full simulated DGIP array to backend
      });

      // Expected format: { dgipDataHash?: string | null; ipfsCid?: string | null; error?: string | null } from backend
      const processResult: { dgipDataHash?: string | null; ipfsCid?: string | null; error?: string | null } = await processResponse.json();

      // Handle backend errors (non-2xx status) or backend-detected errors
      if (!processResponse.ok || processResult.error) {
        const errorMessage = processResult.error || `Failed to process DGIP logs server-side (Status: ${processResponse.status}).`;
        setValidationError(errorMessage);
        toast.error(errorMessage);
        setIsProcessingDgip(false);
        return; // Stop here if backend processing fails
      }

      const newDgipDataHash = processResult.dgipDataHash;
      const newDgipIpfsCid = processResult.ipfsCid!; // Can be null if IPFS upload failed

      // Ensure a valid DGIP hash was received from the backend
      // The backend is expected to return the hash with "0x" prefix now
      if (!newDgipDataHash || newDgipDataHash.length !== 66 || !newDgipDataHash.startsWith('0x')) {
        const errorMessage = "Invalid DGIP data hash format received from backend processing script. Expected 66 chars (0x + 64).";
        setValidationError(errorMessage);
        toast.error(errorMessage);
        setIsProcessingDgip(false);
        return; // Stop here if DGIP hash format is invalid
      }

      // Optional Validation Tip: More robust check using viem utils
      // Ensure the string is a valid hex string and represents exactly 32 bytes.
      // This check was already performed for newDgipDataHash above, but is repeated here for safety before the contract call.
      if (!isHex(newDgipDataHash) || hexToBytes(newDgipDataHash).length !== 32) {
        throw new Error("Invalid DGIP data hash format or length for bytes32 during linking.");
      }

      // Note: If IPFS upload failed, the backend sets ipfsCid to null.
      // The frontend handles this by displaying a warning but proceeds with linking the hash.
      if (newDgipIpfsCid === null) {
        const errorMessage = "Failed to upload DGIP data to IPFS. The hash will still be linked on-chain.";
        toast.warning(errorMessage);
      } else {
        toast("DGIP data processed and uploaded to IPFS.");
      }

      // Store the resulting DGIP hash and CID in state
      setDgipDataHash(newDgipDataHash);
      setDgipIpfsCid(newDgipIpfsCid); // Store null if upload failed

      // --- Proceed to Link DGIP Hash On-Chain ---
      const initialDataHashForLinking = validationResultData.dataHash; // Get the initial hash stored after the first step
      try {
        // Ensure 0x prefix and correct length (66 chars total) for both hashes.
        // Ensure initialDataHashForLinking has 0x prefix and correct length
        const finalInitialDataHashForLinking = initialDataHashForLinking.startsWith('0x') ? initialDataHashForLinking : `0x${initialDataHashForLinking}`;
        if (finalInitialDataHashForLinking.length !== 66) {
          throw new Error(`Invalid initial flight plan hash length for linking. Must be 66 chars (0x + 64), got ${finalInitialDataHashForLinking.length}`);
        }
        // Optional Validation Tip: More robust check using viem utils
        // Ensure the string is a valid hex string and represents exactly 32 bytes.
        if (!isHex(finalInitialDataHashForLinking) || hexToBytes(finalInitialDataHashForLinking).length !== 32) {
          throw new Error("Invalid initial flight plan hash format or length for bytes32 during linking.");
        }

        // Ensure newDgipDataHash has 0x prefix and correct length (already checked above, but re-checked for safety before contract call)
        const finalNewDgipDataHash = newDgipDataHash.startsWith('0x') ? newDgipDataHash : `0x${newDgipDataHash}`;
        if (finalNewDgipDataHash.length !== 66) {
          throw new Error(`Invalid DGIP data hash length for linking. Must be 66 chars (0x + 64), got ${finalNewDgipDataHash.length}`);
        }
        // Optional Validation Tip: More robust check using viem utils
        // Ensure the string is a valid hex string and represents exactly 32 bytes.
        // This check was already performed for newDgipDataHash above, but is repeated here for safety before the contract call.
        if (!isHex(finalNewDgipDataHash) || hexToBytes(finalNewDgipDataHash).length !== 32) {
          throw new Error("Invalid DGIP data hash format or length for bytes32 during linking.");
        }


        // Call the smart contract function to link the DGIP hash to the initial registration
        const txResult = await writeContractAsync({ // Use wagmi hook to interact with contract
          address: contractAddress,
          abi: contractABI,
          functionName: 'registerDGIPData', // Call the linking function
          args: [finalInitialDataHashForLinking as `0x${string}`, finalNewDgipDataHash as `0x${string}`], // Pass the correctly formatted bytes32 values
        });

        setDgipRegistrationTxHash(txResult); // Store the linking transaction hash
        toast(`DGIP data linking transaction sent: ${txResult}. Awaiting confirmation...`);

      } catch (writeError: any) {
        // Handle blockchain transaction errors for linking
        const txErrorMessage = writeError.message || "Failed to send transaction.";
        setValidationError(`On-Chain DGIP Linking Failed: ${txErrorMessage}`);
        toast.error(`Failed to link DGIP data on-chain: ${txErrorMessage}`);
        // Note: We don't return here, as the IPFS results are still displayed even if the linking fails.
      }

    } catch (error: any) {
      // Handle general errors during the DGIP processing fetch call or unexpected issues
      const genericErrorMessage = error.message || "An unexpected error occurred during DGIP processing.";
      console.error("Error in handleProcessAndUploadDgip fetch or processing:", error); // Log error for debugging
      setValidationError(genericErrorMessage);
      toast.error(genericErrorMessage);
    } finally {
      setIsProcessingDgip(false); // Ensure loading state is turned off
    }
  };


  // Determine button states and texts based on current process
  const submitButtonText = isSubmitting
    ? "Registering & Validating..."
    : isConnected ? "Submit Flight Details & Register" : "Connect Wallet to Register";

  const startSimulationButtonText = isSimulating
    ? "Simulating DGIP..."
    : "Start Logging DGIP";

  const processDgipButtonText = isProcessingDgip
    ? "Processing & Uploading DGIP..."
    : "Process & Upload DGIP Logs";

  // Conditions to control button visibility and state flow
  // Initial registration/validation must be complete (validationResultData exists and isCriticallyCompliant is true)
  // DGIP data must not have been processed yet (dgipDataHash is null)
  const showStartSimulationButton = validationResultData?.is_critically_compliant === true
    && validationResultData?.dataHash !== null
    && !isSimulating
    && simulatedDgip.length === 0;

  // Initial registration/validation must be complete and compliant (validationResultData exists and isCriticallyCompliant is true)
  // Simulation must be complete (!isSimulating)
  // Simulation must have produced logs (simulatedDgip.length > 0)
  // DGIP data must not have been processed yet (dgipDataHash is null)
  const showProcessDgipButton = validationResultData?.is_critically_compliant === true
    && validationResultData?.dataHash !== null
    && !isSimulating
    && simulatedDgip.length > 0
    && dgipDataHash === null; // DGIP data hasn't been processed


  // Show DGIP display if simulating or simulation is complete and logs exist
  const showDgipDisplay = isSimulating || (simulatedDgip.length > 0 && !isSimulating);

  // Conditions for Registration Details Card visibility
  const showRegistrationDetails = validationResultData?.dataHash !== null
    || validationResultData?.ipfsCid !== null
    || dgipDataHash !== null
    || dgipIpfsCid !== null
    || dgipRegistrationTxHash !== null;

  return (
    <>
      <div className="container mx-auto py-10"> {/* Adjust width and center as needed */}
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Register Flight</CardTitle>
            <CardDescription>
              Register your drone flight details for compliance, validation, and DGIP generation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}> {/* Pass the form context */}
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6"> {/* Handle form submission */}
                {/* Render the FlightDetailsDialog component here, containing the form fields */}
                <FlightDetailsDialog form={form} /> {/* Pass the form object to the dialog component */}

                {/* Display validation errors if any */}
                {validationError && (
                  <Alert variant="destructive">
                    <AlertTitle>Validation Error</AlertTitle>
                    <AlertDescription>{validationError}</AlertDescription>
                  </Alert>
                )}

                {/* Display compliance suggestions if available */}
                {/* Ensure suggestions are shown regardless of critical status, as the user needs to see them */}
                {showSuggestions && validationResultData?.complianceMessages && validationResultData.complianceMessages.length > 0 && (
                  <ComplianceSuggestions suggestions={validationResultData.complianceMessages} />
                )}

                {/* Submit Button for initial registration */}
                {/* Only show this button if initial validation result is not yet available OR it was not compliant */}
                {(!validationResultData || !validationResultData.is_critically_compliant) && (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || !isConnected} // Disable while submitting or wallet not connected
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {submitButtonText} {/* Display dynamic button text */}
                  </Button>
                )}
              </form>
            </Form> {/* End form */}

            {/* Button to Start DGIP Simulation - appears after initial registration is complete and compliant */}
            {showStartSimulationButton && (
              <>
                <div className="py-4"></div> {/* Add some spacing */}
                <Button
                  onClick={handleStartSimulation} // Call the simulation handler
                  disabled={isSimulating} // Disable while simulating
                  className="w-full"
                >
                  {isSimulating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {startSimulationButtonText} {/* Display dynamic button text */}
                </Button>
              </>
            )}

            {/* Display for DGIP Simulation */}
            {showDgipDisplay && (
              <>
                 <div className="py-4"></div> {/* Add some spacing */}
                <DgipSimulationDisplay
                  displayLog={displayLog}
                  currentLogIndex={currentLogIndex}
                  totalLogs={simulatedDgip.length}
                  isSimulating={isSimulating}
                />
              </>
            )}

            {/* Button to Process & Upload DGIP Logs - appears after simulation finishes and logs exist */}
            {showProcessDgipButton && (
              <>
                 <div className="py-4"></div> {/* Add some spacing */}
                <Button
                  onClick={handleProcessAndUploadDgip} // Call the DGIP processing handler
                  disabled={isProcessingDgip} // Disable while processing
                  className="w-full"
                >
                  {isProcessingDgip && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {processDgipButtonText} {/* Display dynamic button text */}
                </Button>
              </>
            )}

            {/* Display Registration Details (Initial and DGIP) */}
            {showRegistrationDetails && (
              <>
                <div className="py-4"></div> {/* Add some spacing */}
                <Card>
                  <CardHeader>
                    <CardTitle>Registration Details</CardTitle>
                    <CardDescription>
                      On-chain and IPFS data for this flight.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {/* break-all to prevent overflow */}
                      {/* Display Initial Registration Details */}
                      {validationResultData?.dataHash && (
                        <p className="break-all">
                          <b>Initial Flight Plan Hash (Keccak256):</b>{" "}
                          {validationResultData.dataHash}
                        </p>
                      )}
                      {/* IPFS CID for the initial flight plan data is not used downstream for linking in the current flow,
                          but is kept here for visibility as it was part of the original validation step output structure */}
                      {validationResultData?.ipfsCid && (
                         <p className="break-all">
                           <b>Initial Flight Plan IPFS CID:</b>{" "}
                           {validationResultData.ipfsCid}
                         </p>
                       )}

                      {/* Display DGIP Processing Details */}
                      {dgipDataHash && (
                        <p className="break-all">
                          <b>DGIP Log Data Hash (Keccak256):</b> {dgipDataHash}
                        </p>
                      )}
                      {dgipIpfsCid && (
                        <p className="break-all">
                          <b>DGIP Log IPFS CID:</b> {dgipIpfsCid}
                        </p>
                      )}
                      {dgipRegistrationTxHash && (
                        <p className="break-all">
                          <b>DGIP On-Chain Linking Tx Hash:</b>{" "}
                          <a href={`https://sepolia.etherscan.io/tx/${dgipRegistrationTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                           {dgipRegistrationTxHash}
                          </a>
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}