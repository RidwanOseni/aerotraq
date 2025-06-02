import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import process from 'process'; // Import process for accessing current directory

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

            // Use 'python' as the executable command. Consider using process.env.PYTHON_EXECUTABLE
            // for flexibility in different environments, as seen in process-dgip-log-route.txt [4].
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
                        // If code is non-zero and no output, it's likely an execution error
                        throw new Error(`Python script failed with exit code ${code}. Stderr: ${errorOutput || 'None'}`);
                    }

                    const parsed = JSON.parse(output);
                    console.log("Successfully parsed Python output:", parsed);

                    // Check for a top-level error field in the parsed output from Python
                    if (parsed.error) {
                         console.error("Python script returned an error:", parsed.error);
                         // Return the error message from the Python script
                         return resolve(NextResponse.json({ error: parsed.error, is_critically_compliant: parsed.is_critically_compliant ?? false }, { status: 500 }));
                    }


                    // Validate the structure of the parsed output
                    if (!parsed.compliance_messages || !Array.isArray(parsed.compliance_messages)) {
                        console.error("Invalid compliance messages format:", parsed);
                        return resolve(NextResponse.json({ error: 'Invalid compliance messages format received from script.' }, { status: 500 }));
                    }

                     // Validate the structure of the parsed output for is_critically_compliant
                    if (typeof parsed.is_critically_compliant !== 'boolean') {
                         console.error("Invalid is_critically_compliant format:", parsed);
                         // Decide how to handle this - defaulting or erroring
                         // Defaulting to false is safer if format is unexpected but other data is okay
                    }


                    // Transform the Python output to match the expected frontend format
                    const transformedResponse = {
                        result: {
                            complianceMessages: parsed.compliance_messages,
                            dataHash: parsed.dataHash || null, // Handle null/undefined from script
                            ipfsCid: parsed.ipfsCid || null,   // Handle null/undefined from script
                            // Include the is_critically_compliant field from the parsed output
                            is_critically_compliant: parsed.is_critically_compliant ?? false, // Default to false if missing/undefined
                        }
                    };

                    // Log the transformed response for debugging
                    console.log("Transformed response:", transformedResponse);

                    return resolve(NextResponse.json(transformedResponse));

                } catch (e) {
                    console.error("Error processing Python output:", e);
                    // This catch handles errors during JSON parsing or unexpected Python output structure
                    return resolve(NextResponse.json({
                        error: `Failed to process validation results: ${e instanceof Error ? e.message : String(e)}`,
                        details: output, // Include raw output for debugging
                        stderr: errorOutput // Include raw stderr for debugging
                    }, { status: 500 }));
                }
            });

            // Send flight data as JSON to Python script's stdin
            python.stdin.write(JSON.stringify(flightData));
            python.stdin.end();

        });

    } catch (error) {
        console.error("Error in POST handler:", error);
        // This catch handles errors before spawning the Python script (e.g., request.json() fails)
        return NextResponse.json({
            error: `Internal server error during flight validation: ${error instanceof Error ? error.message : String(error)}`
        }, { status: 500 });
    }
}