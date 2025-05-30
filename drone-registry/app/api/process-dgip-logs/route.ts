import { NextResponse } from 'next/server'; // Import NextResponse for handling API responses
import { spawn } from 'child_process'; // Import spawn for running the Python script
import path from 'path'; // Import path for handling file paths
import process from 'process'; // Import process for accessing environment and current directory

// Determine the correct path to the Python script that processes DGIP logs
// Based on source analysis, process-dgip.py.txt reads JSON from stdin [1, 2]
const PYTHON_SCRIPT_PATH = path.join(process.cwd(), 'backend', 'process-dgip.py'); // [1]

// Use environment variable for Python executable, defaulting to 'python'
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python'; //

export async function POST(request: Request) {
  // **FIX:** Declare stderr variable outside the try...catch block
  // This ensures it's defined and accessible in the catch block even if
  // the Python process fails to spawn or throws an early error.
  let stderr = ''; // Initialize stderr in a scope accessible by the catch block

  try {
    // Receive the DGIP data array from the frontend [3]
    const dgipData = await request.json(); //

    // Enhanced Basic validation for incoming DGIP data [3, 4]
    // Ensure it's an array and check the structure of the first entry if available
    if (!Array.isArray(dgipData)) { // [3]
      return NextResponse.json({ error: 'Invalid DGIP data format provided. Expected an array.' }, { status: 400 }); // [3]
    }

    // Note: More detailed validation of array elements (matching DgipLogEntry)
    // could be added here if needed, but the core logic in the source assumes
    // the Python script will handle the data format. [3, 4]

    console.log(`Spawning Python script for DGIP processing at: ${PYTHON_SCRIPT_PATH}`); //

    // Use spawn instead of execFileAsync and manually handle stdin/stdout streams [4]
    const pythonProcess = spawn(PYTHON_EXECUTABLE, [PYTHON_SCRIPT_PATH]); // [4]

    let stdout = ''; // Declared here to be cleared for *this* process run
    // stderr is declared outside the try block

    pythonProcess.stdout.on('data', (data) => { // [4]
      stdout += data.toString(); // [4]
    });

    pythonProcess.stderr.on('data', (data) => { // [5]
      stderr += data.toString(); // Accumulate stderr here [5]
    });

    // Handle process errors (e.g., script not found, permission issues) [5]
    pythonProcess.on('error', (err) => { // [5]
      console.error('Failed to start Python script process:', err); // [5]
      // An error here might mean the 'close' event won't fire, but stderr is still captured.
      // For a production system, a more explicit promise rejection here would be safer.
    });

    // Write the DGIP data as JSON to the Python script's stdin [2]
    pythonProcess.stdin.write(JSON.stringify(dgipData)); // [2]
    pythonProcess.stdin.end(); // Signal end of input to the Python script [2]

    // Wait for the Python process to exit [2]
    const exitCode = await new Promise<number>((resolve) => { // [2]
      pythonProcess.on('close', resolve); // [2]
    });

    console.log(`Python script exited with code: ${exitCode}`); // [6]

    if (stderr) { // [6]
      // Always log stderr from the Python script for debugging [6]
      console.error('Python script stderr:', stderr); // [6]
    }

    console.log("Raw Python stdout:", stdout); // [6]

    try {
      // Check if stdout is empty or only whitespace before parsing [6]
      // Also check if the script exited with a non-zero code, indicating a potential error [6]
      if (!stdout.trim()) { // [6]
        if (exitCode !== 0) { // [6]
          // Script failed and produced no output [6]
          console.error(`Python script failed with exit code ${exitCode} and no output.`); // [6]
          return NextResponse.json({ error: `DGIP processing script failed with exit code ${exitCode}. Stderr: ${stderr || 'None'}` }, { status: 500 }); // [6]
        }

        // Script exited successfully (code 0) but produced no output [6]
        console.warn("Python script exited successfully but produced no output."); // [6]
        // Depending on expected behavior, this might still be an error or a valid case
        // Assuming output is always expected for success:
        return NextResponse.json({ error: 'DGIP processing script produced no output despite successful execution.' }, { status: 500 }); // [6]
      }

      // Attempt to parse the JSON output from stdout [7]
      // Expected format: { dgipDataHash: string | null; ipfsCid: string | null; error: string | null } [7]
      const parsed: { dgipDataHash?: string | null; ipfsCid?: string | null; error?: string | null } = JSON.parse(stdout); // [7]
      console.log("Successfully parsed Python output:", parsed); // [7]

      // Check for a specific error field in the parsed output from Python [7]
      if (parsed.error) { // [7]
        console.error("Python script returned an error:", parsed.error); // [7]
        return NextResponse.json({ error: parsed.error }, { status: 500 }); // [7]
      }

      // Validate the structure and expected values of the parsed output [7]
      if (typeof parsed.dgipDataHash !== 'string' && parsed.dgipDataHash !== null) { // [7]
        console.error("Invalid dgipDataHash format in parsed output:", parsed); // [7]
        return NextResponse.json({ error: 'Invalid DGIP data hash format received from script.' }, { status: 500 }); // [7]
      }

      if (typeof parsed.ipfsCid !== 'string' && parsed.ipfsCid !== null) { // [7]
        console.error("Invalid ipfsCid format in parsed output:", parsed); // [7]
         // Depending on requirements, you might error here or just return null CID
      }

      // Return the hash and CID to the frontend [7]
      return NextResponse.json({ // [7]
        dgipDataHash: parsed.dgipDataHash, // [7]
        ipfsCid: parsed.ipfsCid // [7]
      });

    } catch (parseError) {
      // Handle errors during JSON parsing of the Python script's output [8]
      console.error('Failed to parse Python script output:', parseError); // [8]
      console.error('Raw stdout:', stdout); // Include raw output for debugging [8]
      console.error('Raw stderr:', stderr); // Include raw stderr for debugging [8]
      return NextResponse.json({ // [8]
        error: `Failed to process DGIP script output: ${parseError instanceof Error ? parseError.message : String(parseError)}`, // [8]
        details: stdout // Include raw output for debugging [8]
      }, { status: 500 }); // [8]
    }

  } catch (error) {
    // Handle errors occurring within the Node.js API route itself (e.g., request.json() failure, spawn error) [8]
    console.error("Error in process-dgip-logs POST handler:", error); // [8]

    // Include stderr if available from a failed spawn [9]
    const errorMessage = error instanceof Error ? error.message : String(error); // 
    return NextResponse.json({ // [9]
      error: `Internal server error during DGIP processing: ${errorMessage}`, // [9]
      stderr: stderr || 'N/A' // **FIXED:** stderr is now in scope and included [9]
    }, { status: 500 }); // [9]
  }
}