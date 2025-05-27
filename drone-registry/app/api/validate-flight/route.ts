import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: Request) {
  try {
    const flightData = await request.json();

    // Validate the incoming flight data
    if (!flightData || typeof flightData !== 'object') {
      return NextResponse.json({ error: 'Invalid flight data provided.' }, { status: 400 });
    }

    return new Promise((resolve) => {
      const pythonPath = path.resolve(process.cwd(), "backend/llama_validator.py");
      console.log(`Spawning Python script at: ${pythonPath}`);

      const python = spawn('python', [pythonPath]);

      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (code) => {
        console.log(`Python process exited with code: ${code}`);
        console.log("Raw Python stdout:", output);
        console.error("Raw Python stderr:", errorOutput);

        try {
          if (!output.trim()) {
            if (code === 0) {
              console.error("Python script exited with code 0 but produced no output.");
              return resolve(NextResponse.json({ error: 'Validation script produced no output.' }, { status: 500 }));
            }
            throw new Error("No output from Python script.");
          }

          const parsed = JSON.parse(output);
          console.log("Successfully parsed Python output:", parsed);

          // Check for error in the parsed output
          if (parsed.error) {
            console.error("Python script returned an error:", parsed.error);
            return resolve(NextResponse.json({ error: parsed.error }, { status: 500 }));
          }

          // Validate the structure of the parsed output
          if (!parsed.compliance_messages || !Array.isArray(parsed.compliance_messages)) {
            console.error("Invalid compliance messages format:", parsed);
            return resolve(NextResponse.json({ error: 'Invalid compliance messages format' }, { status: 500 }));
          }

          // Transform the Python output to match the expected frontend format
          const transformedResponse = {
            result: {
              complianceMessages: parsed.compliance_messages,
              dataHash: parsed.dataHash || null,
              ipfsCid: parsed.ipfsCid || null
            }
          };

          // Log the transformed response for debugging
          console.log("Transformed response:", transformedResponse);

          return resolve(NextResponse.json(transformedResponse));

        } catch (e) {
          console.error("Error processing Python output:", e);
          return resolve(NextResponse.json({ 
            error: `Failed to process validation results: ${e instanceof Error ? e.message : String(e)}` 
          }, { status: 500 }));
        }
      });

      // Send flight data to Python script
      python.stdin.write(JSON.stringify(flightData));
      python.stdin.end();
    });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return NextResponse.json({ 
      error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}