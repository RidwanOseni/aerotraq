import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import process from 'process';

// Define the path to your llama_validator.py script
const PYTHON_SCRIPT_PATH = path.join(process.cwd(), 'backend', 'llama_validator.py');
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python';

export async function POST(request: NextRequest) {
  let stderr = ''; 
  try {
    const { dataHash } = await request.json();

    if (!dataHash || typeof dataHash !== 'string' || !dataHash.startsWith('0x') || dataHash.length !== 66) {
      return NextResponse.json({ error: 'Invalid or missing dataHash.' }, { status: 400 });
    }

    console.log(`Spawning Python script for IP details retrieval for dataHash: ${dataHash}`);

    // Spawn a Python process to interact with Story Protocol
    // This script handles the communication with Story Protocol to retrieve IP metadata
    // including IP ID and license terms ID associated with the given data hash
    const pythonProcess = spawn(PYTHON_EXECUTABLE, [PYTHON_SCRIPT_PATH]);
    let stdout = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python script process for IP details retrieval:', err);
    });

    // Prepare the input for the Python script
    // The 'get_story_protocol_details_by_hash' action retrieves Story Protocol metadata
    // This includes the IP ID (unique identifier for the IP asset) and license terms ID
    // These details are essential for tracking and managing IP assets on Story Protocol
    const inputData = {
      action: 'get_story_protocol_details_by_hash',
      dataHash: dataHash,
    };

    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();

    const exitCode = await new Promise((resolve) => {
      pythonProcess.on('close', resolve);
    });

    console.log(`Python script for IP details exited with code: ${exitCode}`);
    if (stderr) { console.error('Python script stderr for IP details:', stderr); }
    console.log("Raw Python stdout for IP details:", stdout);

    try {
      if (!stdout.trim()) {
        if (exitCode !== 0) {
          console.error(`Python script for IP details failed with exit code ${exitCode} and no output.`);
          return NextResponse.json({ error: `Failed to retrieve IP details (script failed with exit code ${exitCode}). Stderr: ${stderr || 'None'}` }, { status: 500 });
        }
        console.warn("Python script for IP details exited successfully but produced no output.");
        return NextResponse.json({ error: 'IP details retrieval script produced no output despite successful execution.' }, { status: 500 });
      }

      const parsed: { status: string; details?: { ipId: string; licenseTermsId: number; }; error?: string; } = JSON.parse(stdout);

      if (parsed.status === 'success' && parsed.details) {
        return NextResponse.json({ ipId: parsed.details.ipId, licenseTermsId: parsed.details.licenseTermsId });
      } else if (parsed.status === 'error' && parsed.error) {
        console.error("Python script for IP details returned an error:", parsed.error);
        return NextResponse.json({ error: parsed.error }, { status: 500 });
      } else {
        console.error("Unexpected output format from Python script for IP details:", parsed);
        return NextResponse.json({ error: 'Unexpected output format from IP details script.' }, { status: 500 });
      }

    } catch (parseError) {
      console.error('Failed to parse Python script output for IP details:', parseError);
      console.error('Raw stdout:', stdout);
      console.error('Raw stderr:', stderr);
      return NextResponse.json({
        error: `Failed to process IP details script output: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        details: stdout
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Error in get-story-ip-details POST handler:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      error: `Internal server error during IP details retrieval: ${errorMessage}`,
      stderr: stderr || 'N/A'
    }, { status: 500 });
  }
}