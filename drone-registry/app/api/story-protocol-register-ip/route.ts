import { NextRequest, NextResponse } from 'next/server';
import { storyClient } from '../../../lib/storyClient';
import { toHex, zeroAddress, Address, Hex } from 'viem';
import { LicenseTerms } from '@story-protocol/core-sdk';
import { spawn } from 'child_process';
import path from 'path';
import process from 'process';
import dotenv from "dotenv";

dotenv.config();

// Path to the Python script for updating the database
const PYTHON_SCRIPT_PATH = path.join(process.cwd(), 'backend', 'llama_validator.py');
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python';

export async function POST(request: NextRequest) {
    try {
        // This route expects to receive the initial flight dataHash,
        // the DGIP log dataHash, and the DGIP IPFS CID from the frontend.
        const { dataHash: initialDataHash, dgipDataHash, dgipIpfsCid: finalDgipIpfsCid } = await request.json();

        if (!initialDataHash || typeof initialDataHash !== 'string' || !initialDataHash.startsWith('0x') || initialDataHash.length !== 66) {
            return NextResponse.json({ error: 'Invalid or missing initial flight dataHash.' }, { status: 400 });
        }

        if (!dgipDataHash || typeof dgipDataHash !== 'string' || !dgipDataHash.startsWith('0x') || dgipDataHash.length !== 66) {
            return NextResponse.json({ error: 'Invalid or missing DGIP dataHash.' }, { status: 400 });
        }

        if (finalDgipIpfsCid !== null && typeof finalDgipIpfsCid !== 'string') {
            return NextResponse.json({ error: 'Invalid dgipIpfsCid format.' }, { status: 400 });
        }

        // **1. Define/Register License Terms** [story-protocol-register-ip-route.txt - 526]

        // Using example Commercial Remix PIL terms. Adjust parameters as needed for your project.

        const WIP_TOKEN_ADDRESS = "0x1514000000000000000000000000000000000000" as Address; // Example $WIP address from Story Protocol docs [story-protocol-register-ip-route.txt - 526]
        const ROYALTY_POLICY_LAP_ADDRESS = "0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E" as Address; // Example RoyaltyPolicyLAP address from Story Protocol docs [story-protocol-register-ip-route.txt - 526]

        const commercialRemixTerms: LicenseTerms = {
            transferable: true,
            royaltyPolicy: ROYALTY_POLICY_LAP_ADDRESS,
            defaultMintingFee: 0n, // Example: Free to mint licenses [story-protocol-register-ip-route.txt - 527]
            expiration: 0n, // Example: No expiration [story-protocol-register-ip-route.txt - 527]
            commercialUse: true, // Allowed for commercial use [story-protocol-register-ip-route.txt - 527]
            commercialAttribution: true, // Attribution required for commercial use [story-protocol-register-ip-route.txt - 527]
            commercializerChecker: zeroAddress, // No specific checker contract
            commercializerCheckerData: '0x' as Hex,
            commercialRevShare: 10, // Example: 10% revenue share to licensor [story-protocol-register-ip-route.txt - 527]
            commercialRevCeiling: 0n, // No revenue ceiling
            derivativesAllowed: true, // Derivatives are allowed [story-protocol-register-ip-route.txt - 528]
            derivativesAttribution: true, // Attribution required for derivatives
            derivativesApproval: false, // No explicit approval needed for derivatives
            derivativesReciprocal: true, // Derivative licenses must also be reciprocal
            derivativeRevCeiling: 0n, // No derivative revenue ceiling
            currency: WIP_TOKEN_ADDRESS, // Currency for fees/revenue share [story-protocol-register-ip-route.txt - 528]
            uri: "", // Optional: URI for license terms metadata
        };

        // Register the license terms on Story Protocol.
        // If these exact terms were already registered, the protocol would return the existing ID [story-protocol-register-ip-route.txt - 529].
        const registeredTerms = await storyClient.license.registerPILTerms({
            ...commercialRemixTerms,
            txOptions: { waitForTransaction: true },
        });

        const licenseTermsId = registeredTerms.licenseTermsId;
        console.log(`License Terms registered with ID: ${licenseTermsId}`);

        // **2. Mint IP Asset and Attach License Terms** [story-protocol-register-ip-route.txt - 529]

        // This combines minting an SPG NFT, registering it as an IP Asset, attaching metadata,
        // and attaching license terms in one call [story-protocol-register-ip-route.txt - 530].

        const spgNftContract = process.env.SPG_NFT_CONTRACT_ADDRESS as Address;
        if (!spgNftContract) {
            throw new Error("SPG_NFT_CONTRACT_ADDRESS environment variable is not set. Please create an SPG NFT collection and add its address to your .env file.");
        }

        // The IP metadata should link back to the DGIP data on IPFS [story-protocol-register-ip-route.txt - 530].
        // The dgipDataHash (Keccak256 hash of the serialized DGIP log) will be used for metadata hashes.
        const ipfsGatewayUrl = finalDgipIpfsCid !== null ? `https://ipfs.io/ipfs/${finalDgipIpfsCid}` : "";

        const ipMetadata = {
            ipMetadataURI: ipfsGatewayUrl, // Link to IPFS if CID available [story-protocol-register-ip-route.txt - 531]
            ipMetadataHash: dgipDataHash as Hex, // Use the hash of the DGIP data [story-protocol-register-ip-route.txt - 531]
            nftMetadataURI: ipfsGatewayUrl, // NFT metadata can also link to IPFS
            nftMetadataHash: dgipDataHash as Hex, // Use the hash of the DGIP data
        };

        const mintAndRegisterResponse = await storyClient.ipAsset.mintAndRegisterIpAssetWithPilTerms({
            spgNftContract: spgNftContract,
            licenseTermsData: [{ terms: commercialRemixTerms }], // Attach the terms we just defined/registered [story-protocol-register-ip-route.txt - 531]
            ipMetadata: ipMetadata, // Attach the metadata linking to DGIP [story-protocol-register-ip-route.txt - 532]
            allowDuplicates: true, // Set based on your requirement [story-protocol-register-ip-route.txt - 532]
            txOptions: { waitForTransaction: true }, // Wait for the transaction
        });

        const newIpId = mintAndRegisterResponse.ipId;
        const mintedTokenId = mintAndRegisterResponse.tokenId;

        console.log(`IP Asset minted and registered with IP ID: ${newIpId}, Token ID: ${mintedTokenId}`);
        console.log(`License Terms ID ${licenseTermsId} attached to IP Asset ${newIpId}`);

        // **3. Store Story Protocol Details in Backend Storage** [story-protocol-register-ip-route.txt - 532]

        // Call the Python script to update the database with the newIpId and licenseTermsId,
        // linking them to the initialDataHash.

        const updateData = {
            action: 'update_story_protocol_details',
            dataHash: initialDataHash,
            ipId: newIpId,
            // Convert BigInt to Number before sending it to JSON.stringify
            licenseTermsId: Number(licenseTermsId)
        };

        console.log("Sending update data to Python script:", updateData);

        const pythonProcess = spawn(PYTHON_EXECUTABLE, [PYTHON_SCRIPT_PATH]);
        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.stdin.write(JSON.stringify(updateData));
        pythonProcess.stdin.end();

        const exitCode = await new Promise((resolve) => {
            pythonProcess.on('close', resolve);
        });

        console.log(`Python script for DB update exited with code: ${exitCode}`);

        if (stderr) {
            console.error('Python script stderr for DB update:', stderr);
        }

        console.log('Python script stdout for DB update:', stdout);

        let dbUpdateSuccess = false;
        let dbUpdateMessage = "Unknown database update status.";

        try {
            const parsedOutput = JSON.parse(stdout);
            if (parsedOutput.status === 'success') {
                dbUpdateSuccess = true;
                dbUpdateMessage = parsedOutput.message;
            } else if (parsedOutput.error) {
                dbUpdateMessage = `DB Update Script Error: ${parsedOutput.error}`;
            } else {
                dbUpdateMessage = `DB Update Script Unexpected Output: ${stdout}`;
            }
        } catch (parseError) {
            dbUpdateMessage = `DB Update Script Output Parse Error: ${parseError instanceof Error ? parseError.message : String(parseError)}. Raw Output: ${stdout}`;
        }

        if (!dbUpdateSuccess) {
            console.error(dbUpdateMessage);
            // Decide if a DB update failure should fail the entire Story Protocol registration
            // For this flow, the on-chain part succeeded, so it might just be a warning.
        }

        // Return success response to the frontend, including the new identifiers
        return NextResponse.json({
            ipId: newIpId,
            // Convert licenseTermsId to a Number here for JSON serialization
            licenseTermsId: Number(licenseTermsId),
            // Convert mintedTokenId to a String here for JSON serialization to prevent BigInt error
            mintedTokenId: String(mintedTokenId),
            dbUpdateMessage: dbUpdateMessage,
        });

    } catch (error: any) {
        console.error("Error in Story Protocol registration API route:", error);
        return NextResponse.json({ error: error.message || "An unexpected error occurred during Story Protocol registration." }, { status: 500 });
    }
}
