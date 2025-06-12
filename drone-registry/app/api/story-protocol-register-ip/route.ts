import { NextRequest, NextResponse } from 'next/server';
import { storyClient } from '../../../lib/storyClient';
import { toHex, zeroAddress, Address, Hex } from 'viem';
import { LicenseTerms } from '@story-protocol/core-sdk';
import { spawn } from 'child_process';
import path from 'path';
import process from 'process';
import dotenv from "dotenv";

dotenv.config();

const PYTHON_SCRIPT_PATH = path.join(process.cwd(), 'backend', 'llama_validator.py');
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python';

export async function POST(request: NextRequest) {
    try {
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

        const WIP_TOKEN_ADDRESS = "0x1514000000000000000000000000000000000000" as Address;
        const ROYALTY_POLICY_LAP_ADDRESS = "0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E" as Address;

        const commercialRemixTerms: LicenseTerms = {
            transferable: true,
            royaltyPolicy: ROYALTY_POLICY_LAP_ADDRESS,
            defaultMintingFee: 0n,
            expiration: 0n,
            commercialUse: true,
            commercialAttribution: true,
            commercializerChecker: zeroAddress,
            commercializerCheckerData: '0x' as Hex,
            commercialRevShare: 10,
            commercialRevCeiling: 0n,
            derivativesAllowed: true,
            derivativesAttribution: true,
            derivativesApproval: false,
            derivativesReciprocal: true,
            derivativeRevCeiling: 0n,
            currency: WIP_TOKEN_ADDRESS,
            uri: "",
        };

        const registeredTerms = await storyClient.license.registerPILTerms({
            ...commercialRemixTerms,
            txOptions: { waitForTransaction: true },
        });

        const licenseTermsId = registeredTerms.licenseTermsId;
        console.log(`License Terms registered with ID: ${licenseTermsId}`);

        const spgNftContract = process.env.SPG_NFT_CONTRACT_ADDRESS as Address;
        if (!spgNftContract) {
            throw new Error("SPG_NFT_CONTRACT_ADDRESS environment variable is not set. Please create an SPG NFT collection and add its address to your .env file.");
        }

        const ipfsGatewayUrl = finalDgipIpfsCid !== null ? `https://ipfs.io/ipfs/${finalDgipIpfsCid}` : "";
        const ipMetadata = {
            ipMetadataURI: ipfsGatewayUrl,
            ipMetadataHash: dgipDataHash as Hex,
            nftMetadataURI: ipfsGatewayUrl,
            nftMetadataHash: dgipDataHash as Hex,
        };

        const mintAndRegisterResponse = await storyClient.ipAsset.mintAndRegisterIpAssetWithPilTerms({
            spgNftContract: spgNftContract,
            licenseTermsData: [{ terms: commercialRemixTerms }],
            ipMetadata: ipMetadata,
            allowDuplicates: true,
            txOptions: { waitForTransaction: true },
        });

        const newIpId = mintAndRegisterResponse.ipId;
        const mintedTokenId = mintAndRegisterResponse.tokenId;
        console.log(`IP Asset minted and registered with IP ID: ${newIpId}, Token ID: ${mintedTokenId}`);
        console.log(`License Terms ID ${licenseTermsId} attached to IP Asset ${newIpId}`);

        // 3. Store Story Protocol Details in Backend Storage [story-protocol-register-ip-route.txt - 532]
        // Call the Python script to update the database with the newIpId and licenseTermsId,
        // linking them to the initialDataHash.
        const updateData = {
            action: 'update_story_protocol_details',
            dataHash: initialDataHash,
            ipId: newIpId,
            // Convert BigInt to Number before sending it to JSON.stringify
            licenseTermsId: Number(licenseTermsId),
            // Pass mintedTokenId to the Python script for storage
            mintedTokenId: String(mintedTokenId)
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