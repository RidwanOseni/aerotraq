import { execFile } from 'child_process'; // Keep execFile
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// Assuming the Python script is in the 'backend' directory at the project root
const PYTHON_SCRIPT_PATH = path.join(process.cwd(), 'backend', 'dgip_simulation.py');
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python'; // Use environment variable or default to 'python'

export async function POST(request: NextRequest) {
  try {
    const flightParams = await request.json();
    console.log('Received flight parameters:', flightParams);

    // Validate incoming parameters (basic check) 
    if (!flightParams || typeof flightParams.flightAreaCenter?.latitude !== 'number' || typeof flightParams.flightAreaCenter?.longitude !== 'number' || typeof flightParams.flightAreaRadius !== 'number' || !flightParams.flightDate || !flightParams.startTime || !flightParams.endTime) {
      return NextResponse.json({ error: 'Invalid flight parameters provided' }, { status: 400 }); [3]
    }

    // Wrap the process execution in a Promise to await it
    const pythonExecutionPromise = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      // Spawn the Python script - ONLY ONCE
      const pythonProcess = execFile(
        PYTHON_EXECUTABLE,
        [PYTHON_SCRIPT_PATH],
        { cwd: process.cwd() }, // Ensure correct working directory 
        // Callback is typically for when the process *finishes*
        // We'll use listeners and the 'close' event more explicitly
      );

      let stdoutData = '';
      let stderrData = '';

      // Capture stdout data [5]
      pythonProcess.stdout?.on('data', (data) => {
        stdoutData += data.toString();
      });

      // Capture stderr data [4, 5]
      pythonProcess.stderr?.on('data', (data) => {
        stderrData += data.toString();
      });

      // Handle process close
      pythonProcess.on('close', (code) => {
        console.log(`Python script exited with code: ${code}`, { stdout: stdoutData, stderr: stderrData });
        if (code !== 0) {
          // If process exited with a non-zero code, consider it an error
          reject(new Error(`Python script exited with code ${code}.\nStderr: ${stderrData}`));
        } else {
          // Resolve with collected stdout and stderr
          resolve({ stdout: stdoutData, stderr: stderrData });
        }
      });

      // Handle potential spawn error (e.g., executable not found)
      pythonProcess.on('error', (err) => {
        console.error('Failed to start Python script:', err);
        reject(err);
      });

      // Send flight data to Python script via stdin [5]
      pythonProcess.stdin?.write(JSON.stringify(flightParams));
      pythonProcess.stdin?.end();
    });

    // Wait for the Python script to finish and get its output
    const { stdout, stderr } = await pythonExecutionPromise;

    // Log stderr if any 
    if (stderr) {
      console.error('Python script stderr:', stderr);
      // Decide if stderr should result in an error response.
      // For simulation, maybe not always, but good to log.
    }

    // Parse the JSON output from the Python script 
    try {
      const simulatedData = JSON.parse(stdout);
      console.log(`Successfully generated ${simulatedData.length} DGIP entries.`); [6]
      return NextResponse.json({ dgipData: simulatedData }); [6]
    } catch (parseError) {
      console.error('Failed to parse Python script output:', parseError); [6]
      console.error('Raw stdout:', stdout); [6]
      return NextResponse.json({ error: 'Failed to process simulation output', details: stdout }, { status: 500 }); [6]
    }

  } catch (error) {
    console.error('API handler error:', error); [7]
    // Catch errors from JSON parsing, subprocess execution, etc.
    return NextResponse.json({ error: `Failed to start DGIP logging simulation: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 }); [7]
  }
}