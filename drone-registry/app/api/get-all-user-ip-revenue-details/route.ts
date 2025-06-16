import { NextRequest, NextResponse } from 'next/server';
import { storyClient } from '../../../lib/storyClient';
import { Address, zeroAddress } from 'viem';
import { createPublicClient, http, defineChain } from 'viem';
import { spawn } from 'child_process';
import path from 'path';
import process from 'process';

const aeneid = defineChain({
  id: 1315,
  name: 'Story Aeneid Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'IP',
    symbol: 'IP',
  },
  rpcUrls: {
    default: {
      http: ['https://aeneid.storyrpc.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Storyscan',
      url: 'https://aeneid.storyscan.io',
    },
  },
});

const publicClient = createPublicClient({
  chain: aeneid,
  transport: http(),
});

const contractAddress = "0x4f3880A15Ea6f0E1A269c59e44855a9963B86949";

const contractABI = [
  {
    "inputs": [{"internalType": "address", "name": "initialOwner", "type": "address"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "bytes32", "name": "initialDataHash", "type": "bytes32"},
      {"indexed": true, "internalType": "bytes32", "name": "dgipDataHash", "type": "bytes32"},
      {"indexed": true, "internalType": "address", "name": "registrant", "type": "address"}
    ],
    "name": "DGIPDataRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "flightId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "registrant", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "initialDataHash", "type": "bytes32"}
    ],
    "name": "FlightRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "previousOwner", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "newOwner", "type": "address"}
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "name": "flightRecords",
    "outputs": [
      {"internalType": "bytes32", "name": "initialDataHash", "type": "bytes32"},
      {"internalType": "address", "name": "registrant", "type": "address"}
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
    "inputs": [{"internalType": "uint256", "name": "flightId", "type": "uint256"}],
    "name": "getFlight",
    "outputs": [
      {"internalType": "bytes32", "name": "", "type": "bytes32"},
      {"internalType": "address", "name": "", "type": "address"}
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
      {"internalType": "address", "name": "newOwner", "type": "address"}
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "", "type": "address"},
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "name": "userFlights",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const WIP_TOKEN_ADDRESS = "0x1514000000000000000000000000000000000000" as Address;

const PYTHON_SCRIPT_PATH = path.join(process.cwd(), 'backend', 'llama_validator.py');
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python';

interface FlightRecordWithRevenue {
  flightId: number;
  initialDataHash: string;
  ipfsCid: string | null;
  ipId: string | null;
  licenseTermsId: number | null;
  mintedTokenId: string | null;
  claimableAmount: string | null;
  droneName?: string;
  flightDate?: string;
}

export async function POST(request: NextRequest) {
  let stderr = '';
  try {
    const { claimerAddress } = await request.json();
    if (!claimerAddress || typeof claimerAddress !== 'string' || !claimerAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid or missing claimer address.' }, { status: 400 });
    }

    console.log(`Fetching all flights for user: ${claimerAddress}`);

    const userFlightIdsBigInt: readonly bigint[] = await publicClient.readContract({
      address: contractAddress,
      abi: contractABI,
      functionName: 'getMyFlights',
      account: claimerAddress as Address,
    });

    const initialDataHashes: string[] = [];
    const flightIdToDataHashMap = new Map();
    const flightDetailsMap = new Map();

    for (const flightIdBigInt of userFlightIdsBigInt) {
      const flightId = Number(flightIdBigInt);
      try {
        const [initialDataHash, registrant] = await publicClient.readContract({
          address: contractAddress,
          abi: contractABI,
          functionName: 'getFlight',
          args: [BigInt(flightId)],
          account: claimerAddress as Address,
        });
        initialDataHashes.push(initialDataHash);
        flightIdToDataHashMap.set(flightId, initialDataHash);
        flightDetailsMap.set(initialDataHash, {
          flightId: flightId,
          initialDataHash: initialDataHash,
          ipfsCid: null,
          ipId: null,
          licenseTermsId: null,
          mintedTokenId: null,
          claimableAmount: null,
          droneName: 'Loading...',
          flightDate: 'Loading...',
        });
      } catch (error: any) {
        console.warn(`Failed to get flight details for flightId ${flightId}: ${error.message}`);
        flightDetailsMap.set(`error-flight-${flightId}`, {
          flightId: flightId,
          initialDataHash: `0x${'0'.repeat(64)}`,
          ipfsCid: null, ipId: null, licenseTermsId: null, mintedTokenId: null, claimableAmount: "0 WIP",
          droneName: 'Error',
          flightDate: 'Error',
        });
      }
    }

    let allIpDetails: { dataHash: string; ipfsCid: string | null; ipId: string | null; licenseTermsId: number | null; mintedTokenId: string | null }[] = [];

    if (initialDataHashes.length > 0) {
      try {
        const pythonProcess = spawn(PYTHON_EXECUTABLE, [PYTHON_SCRIPT_PATH]);
        let stdout = '';
        stderr = '';

        // FIX 2: Corrected syntax for 'data' parameter typing
        pythonProcess.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
        pythonProcess.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

        const inputData = {
          action: 'get_story_protocol_details_by_hashes',
          dataHashes: initialDataHashes,
        };

        pythonProcess.stdin.write(JSON.stringify(inputData));
        pythonProcess.stdin.end();

        const exitCode = await new Promise((resolve) => {
          pythonProcess.on('close', resolve);
        });

        if (exitCode !== 0) {
          throw new Error(`Python script for IP details exited with code ${exitCode}. Stderr: ${stderr || 'None'}`);
        }

        const parsedOutput = JSON.parse(stdout);

        if (parsedOutput.status === 'success' && Array.isArray(parsedOutput.details)) {
          allIpDetails = parsedOutput.details;
        } else if (parsedOutput.error) {
          throw new Error(`Python script returned an error: ${parsedOutput.error}`);
        } else {
          throw new Error(`Unexpected output format from Python script: ${stdout}`);
        }

      } catch (pythonError: any) {
        console.error("Error fetching IP details from Python script:", pythonError.message);
      }
    }

    const finalFlights: FlightRecordWithRevenue[] = [];

    for (const [dataHash, flight] of flightDetailsMap.entries()) {
      const ipDetail = allIpDetails.find(detail => detail.dataHash === dataHash);
      if (ipDetail) {
        flight.ipfsCid = ipDetail.ipfsCid;
        flight.ipId = ipDetail.ipId;
        flight.licenseTermsId = ipDetail.licenseTermsId;
        flight.mintedTokenId = ipDetail.mintedTokenId;
      }

      if (flight.ipfsCid && flight.ipfsCid !== "UPLOAD_FAILED") {
        try {
          const pythonProcess = spawn(PYTHON_EXECUTABLE, [PYTHON_SCRIPT_PATH]);
          let stdoutIpfs = '';
          let stderrIpfs = '';

          // FIX 2: Corrected syntax for 'data' parameter typing
          pythonProcess.stdout.on('data', (data: Buffer) => { stdoutIpfs += data.toString(); });
          pythonProcess.stderr.on('data', (data: Buffer) => { stderrIpfs += data.toString(); });

          const inputDataIpfs = {
            action: 'get_ipfs_content_by_cid',
            ipfsCid: flight.ipfsCid,
          };

          pythonProcess.stdin.write(JSON.stringify(inputDataIpfs));
          pythonProcess.stdin.end();

          const exitCodeIpfs = await new Promise((resolve) => {
            pythonProcess.on('close', resolve);
          });

          if (exitCodeIpfs !== 0) {
            console.error(`Python script for IPFS content exited with code ${exitCodeIpfs}. Stderr: ${stderrIpfs || 'None'}`);
          } else {
            const parsedIpfsOutput = JSON.parse(stdoutIpfs);
            if (parsedIpfsOutput.status === 'success' && parsedIpfsOutput.content && parsedIpfsOutput.content.flight_data) {
              flight.droneName = parsedIpfsOutput.content.flight_data.droneName;
              flight.flightDate = parsedIpfsOutput.content.flight_data.flightDate;
            } else {
              console.warn(`Unexpected IPFS content format for CID ${flight.ipfsCid}:`, parsedIpfsOutput);
            }
          }
        } catch (ipfsError: any) {
          console.error(`Error fetching IPFS content for CID ${flight.ipfsCid}:`, ipfsError.message);
          flight.droneName = 'Error';
          flight.flightDate = 'Error';
        }
      } else {
        flight.droneName = 'N/A';
        flight.flightDate = 'N/A';
      }

      if (flight.ipId) {
        try {
          let royaltyVaultExists = false;
          try {
            const royaltyVaultAddress = await storyClient.royalty.getRoyaltyVaultAddress(flight.ipId as Address);
            if (royaltyVaultAddress !== zeroAddress) {
              royaltyVaultExists = true;
            }
          } catch (vaultCheckError: any) {
            console.warn(`Warning: Could not retrieve royalty vault address for IP ID ${flight.ipId}. Assuming no vault exists for claimable revenue check. Error: ${vaultCheckError.message}`);
          }

          if (royaltyVaultExists) {
            const claimableAmountBigInt: bigint = await storyClient.royalty.claimableRevenue({
              ipId: flight.ipId as Address,
              claimer: flight.ipId as Address,
              token: WIP_TOKEN_ADDRESS,
            });
            flight.claimableAmount = `${parseFloat(claimableAmountBigInt.toString()) / (10**18)} WIP`;
          } else {
            console.log(`No active royalty vault found for IP ID ${flight.ipId}. Claimable amount is 0.`);
            flight.claimableAmount = "0 WIP";
          }
        } catch (claimableError: any) {
          console.warn(`Failed to fetch claimable revenue for IP ID ${flight.ipId}: ${claimableError.message}`);
          flight.claimableAmount = "0 WIP";
        }
      } else {
        flight.claimableAmount = "0 WIP";
      }
      finalFlights.push(flight);
    }

    return NextResponse.json({
      status: 'success',
      flights: finalFlights,
    });

  } catch (error: any) {
    console.error("Error in get-all-user-ip-revenue-details API route:", error);
    return NextResponse.json({
      status: 'error',
      message: error.message || "An unexpected error occurred while fetching revenue details."
    }, { status: 500 });
  }
}