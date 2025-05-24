import sys
import json
import os
import re
from datetime import datetime, time
from llama_index.core import VectorStoreIndex, Settings
from llama_index.llms.openai import OpenAI
from llama_index.core.tools import QueryEngineTool
from llama_index.core.agent import ReActAgent
from llama_index.readers.llama_parse import LlamaParse
from web3 import Web3
import aioipfs
import asyncio
from eth_hash.auto import keccak
import sqlite3
from dotenv import load_dotenv
from mcp_integration.client import OpenAIPClientIntegration  # Import the MCP client

# Load environment variables
load_dotenv()

# Initialize Web3
w3 = Web3()

# Set the LLM settings
Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0)

def extract_answer(text):
    """Extracts the answer from the AI's response."""
    match = re.search(r"Answer:\s*(.+)", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()

# Database setup
def setup_database():
    conn = sqlite3.connect('flight_data.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS flight_mappings
        (data_hash TEXT PRIMARY KEY, ipfs_cid TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)
    ''')
    conn.commit()
    return conn

def serialize_flight_data(flight_data: dict) -> str:
    """Serialize flight data in a consistent manner."""
    ordered_data = {
        "droneName": flight_data.get("droneName", ""),
        "droneModel": flight_data.get("droneModel", ""),
        "droneType": flight_data.get("droneType", ""),
        "serialNumber": flight_data.get("serialNumber", ""),
        "weight": flight_data.get("weight", None),
        "flightPurpose": flight_data.get("flightPurpose", ""),
        "flightDescription": flight_data.get("flightDescription", ""),
        "flightDate": flight_data.get("flightDate", ""),
        "startTime": flight_data.get("startTime", ""),
        "endTime": flight_data.get("endTime", ""),
        "flightAreaCenter": flight_data.get("flightAreaCenter", ""),
        "flightAreaRadius": flight_data.get("flightAreaRadius", None),
        "flightAreaMaxHeight": flight_data.get("flightAreaMaxHeight", None),
        "additionalNotes": flight_data.get("additionalNotes", "")
    }
    return json.dumps(ordered_data, sort_keys=True, separators=(',', ':'))

def calculate_hash(serialized_data: str) -> bytes:
    """Calculate keccak256 hash of the serialized data."""
    return keccak(serialized_data.encode('utf-8'))

def store_flight_data(data_hash: str, ipfs_cid: str, conn):
    """Store the mapping between data hash and IPFS CID."""
    c = conn.cursor()
    c.execute('INSERT INTO flight_mappings (data_hash, ipfs_cid) VALUES (?, ?)',
              (data_hash, ipfs_cid))
    conn.commit()

async def validate_flight_data(flight_data: dict) -> dict:
    """Validates flight data against regulations using LlamaIndex."""
    compliance_messages = []
    regulations_path = os.path.join(os.path.dirname(__file__), "regulations.txt")

    print(f"Attempting to load regulations from: {regulations_path}", file=sys.stderr)

    try:
        documents = await LlamaParse(result_type="text", verbose=False).aload_data(regulations_path)
        print("Successfully loaded regulations.", file=sys.stderr)

        # --- Basic Deterministic Checks ---
        print("Performing deterministic checks...", file=sys.stderr)

        # Check flight date
        flight_date_str = flight_data.get("flightDate")
        if flight_date_str:
            try:
                flight_date = datetime.strptime(flight_date_str, "%Y-%m-%d").date()
                if flight_date < datetime.now().date():
                    compliance_messages.append("Flight date is in the past.")
            except ValueError:
                compliance_messages.append(f"Invalid flight date format: {flight_date_str}. Expected YYYY-MM-DD.")
        else:
            compliance_messages.append("Flight date is missing.")

        # Check start and end times
        start_time_str = flight_data.get("startTime")
        end_time_str = flight_data.get("endTime")
        if start_time_str and end_time_str:
            try:
                start_time = datetime.strptime(start_time_str, "%H:%M").time()
                end_time = datetime.strptime(end_time_str, "%H:%M").time()
                if start_time >= end_time:
                    compliance_messages.append("Start time must be before end time.")
            except ValueError:
                compliance_messages.append(f"Invalid time format: {start_time_str} or {end_time_str}. Expected HH:MM.")
        else:
            if not start_time_str:
                compliance_messages.append("Start time is missing.")
            if not end_time_str:
                compliance_messages.append("End time is missing.")

        # Check drone weight
        weight = flight_data.get("weight")
        if weight is not None:
            try:
                weight_kg = float(weight)
                if weight_kg > 250:
                    compliance_messages.append("Drone weight exceeds 250g. Additional regulations may apply.")
            except ValueError:
                compliance_messages.append(f"Invalid weight format: {weight}. Expected a number.")
        else:
            compliance_messages.append("Drone weight is missing.")

        print("Deterministic checks complete.", file=sys.stderr)

        # --- LLM-based Validation ---
        query_text = f"""
        Validate the following flight data against the provided regulations:
        Drone Name: {flight_data.get('droneName')}
        Drone Model: {flight_data.get('droneModel')}
        Serial Number: {flight_data.get('serialNumber')}
        Weight: {flight_data.get('weight')}g
        Flight Purpose: {flight_data.get('flightPurpose')}
        Flight Description: {flight_data.get('flightDescription')}
        Flight Date: {flight_data.get('flightDate')}
        Start Time: {flight_data.get('startTime')}
        End Time: {flight_data.get('endTime')}
        Flight Area Center: {flight_data.get('flightAreaCenter')}
        Flight Area Radius: {flight_data.get('flightAreaRadius')} meters
        Flight Area Max Height: {flight_data.get('flightAreaMaxHeight')} meters
        Additional Notes: {flight_data.get('additionalNotes')}

        Check specifically for compliance regarding:
        - Time of flight (e.g., day/night restrictions)
        - Altitude restrictions
        - Proximity to restricted areas
        - Weight restrictions
        - Purpose of flight

        Output your response clearly, starting with a summary of compliance issues found, if any. If no issues are found, state that the data appears compliant according to the regulations provided. List specific non-compliance points as bullet points. Structure your final conclusion with 'Answer:' followed by the summary.
        """
        print("Constructed LLM query.", file=sys.stderr)

        print("Starting AI agent process...", file=sys.stderr)
        index = VectorStoreIndex.from_documents(documents)
        query_engine = index.as_query_engine()
        query_tool = QueryEngineTool.from_defaults(
            query_engine,
            name="RegulationValidator",
            description="A tool for validating flight details against the regulations.",
        )
        agent = ReActAgent.from_tools([query_tool], verbose=False)

        print("Agent initialized. Sending chat query...", file=sys.stderr)
        response = agent.chat(query_text)
        print("Agent response received.", file=sys.stderr)

        ai_response_text = str(response)
        llm_compliance_summary = extract_answer(ai_response_text)
        if llm_compliance_summary:
            compliance_messages.append(f"AI Analysis: {llm_compliance_summary}")

        print("LLM-based validation complete.", file=sys.stderr)

        return {"compliance_messages": compliance_messages}

    except FileNotFoundError:
        print(f"Regulations file not found at: {regulations_path}", file=sys.stderr)
        return {"error": f"Regulations file not found at: {regulations_path}"}
    except Exception as e:
        print(f"Error during LlamaIndex/AI processing: {str(e)}", file=sys.stderr)
        compliance_messages.append(f"Error during AI analysis: {str(e)}")
        return {"compliance_messages": compliance_messages, "error": f"AI processing failed: {str(e)}"}

async def validate_and_process_flight_data_async(flight_data: dict) -> dict:
    """Validate flight data and process it for blockchain storage, including async IPFS upload."""
    mcp_client = None
    try:
        print("Connecting to IPFS...", file=sys.stderr)
        async with aioipfs.AsyncIPFS() as ipfs_client:
            print("IPFS client connected.", file=sys.stderr)

            # Initialize MCP client
            print("Initializing MCP client...", file=sys.stderr)
            mcp_client = OpenAIPClientIntegration()

            # Validate flight data with LlamaIndex
            validation_result = await validate_flight_data(flight_data)

            if "error" in validation_result and validation_result["error"].startswith("Regulations file not found"):
                return validation_result

            compliance_messages = validation_result.get("compliance_messages", [])

            # Call MCP validation
            try:
                print("Calling MCP validation...", file=sys.stderr)
                mcp_result = await mcp_client.validate_flight_data(flight_data)
                print("MCP validation complete.", file=sys.stderr)

                # Process MCP validation results
                if mcp_result.get("status") == "error":
                    compliance_messages.append(f"MCP Validation Error: {mcp_result.get('message')}")
                elif mcp_result.get("status") == "success":
                    mcp_validation = mcp_result.get("validationResult", {})
                    if mcp_validation:
                        # Add MCP validation results to compliance messages
                        if isinstance(mcp_validation, dict):
                            for key, value in mcp_validation.items():
                                compliance_messages.append(f"MCP {key}: {value}")
                        else:
                            compliance_messages.append(f"MCP Validation: {mcp_validation}")

            except Exception as mcp_error:
                print(f"MCP validation error: {mcp_error}", file=sys.stderr)
                compliance_messages.append(f"MCP Validation Error: {str(mcp_error)}")

            # Serialize the flight data
            print("Serializing flight data...", file=sys.stderr)
            serialized_data = serialize_flight_data(flight_data)
            print("Data serialized.", file=sys.stderr)

            # Calculate hash
            print("Calculating hash...", file=sys.stderr)
            data_hash = calculate_hash(serialized_data)
            data_hash_hex = data_hash.hex()
            print(f"Data hash calculated: {data_hash_hex}", file=sys.stderr)

            # Upload to IPFS
            print("Uploading data to IPFS...", file=sys.stderr)
            try:
                ipfs_add_result = await ipfs_client.core.add_bytes(serialized_data.encode('utf-8'))
                ipfs_cid = ipfs_add_result['Hash']
                print(f"Data uploaded to IPFS with CID: {ipfs_cid}", file=sys.stderr)

                # Store mapping in database
                print("Storing mapping in database...", file=sys.stderr)
                conn = setup_database()
                store_flight_data(data_hash_hex, ipfs_cid, conn)
                conn.close()
                print("Mapping stored.", file=sys.stderr)

            except Exception as ipfs_e:
                print(f"IPFS or Database Error: {ipfs_e}", file=sys.stderr)
                compliance_messages.append(f"Processing failed: IPFS or database error: {ipfs_e}")
                return {
                    "compliance_messages": compliance_messages,
                    "dataHash": data_hash_hex,
                    "ipfsCid": None,
                    "error": f"IPFS or Database Processing error: {str(ipfs_e)}"
                }

            # Prepare final result
            result = {
                "compliance_messages": compliance_messages,
                "dataHash": data_hash_hex,
                "ipfsCid": ipfs_cid,
            }

            # Add MCP validation result if available
            if mcp_result and mcp_result.get("status") == "success":
                result["mcpValidationResult"] = mcp_result.get("validationResult")

            if "error" in validation_result:
                result["validation_error"] = validation_result["error"]

            return result

    except Exception as e:
        print(f"Unexpected error in async processing: {e}", file=sys.stderr)
        return {"error": f"Unexpected processing error: {str(e)}"}

    finally:
        # Ensure MCP client cleanup
        if mcp_client:
            try:
                await mcp_client.cleanup()
                print("MCP client cleaned up.", file=sys.stderr)
            except Exception as cleanup_error:
                print(f"Error during MCP client cleanup: {cleanup_error}", file=sys.stderr)

if __name__ == "__main__":
    print("Script started.", file=sys.stderr)
    try:
        input_json = sys.stdin.read()
        print(f"Received input JSON: {input_json}", file=sys.stderr)

        if not input_json:
            raise ValueError("No input JSON received.")

        flight_data = json.loads(input_json)
        print("Input JSON parsed successfully.", file=sys.stderr)

        result = asyncio.run(validate_and_process_flight_data_async(flight_data))

        print(json.dumps(result))
        print("Script finished successfully.", file=sys.stderr)

    except json.JSONDecodeError:
        print("Error: Invalid JSON input received.", file=sys.stderr)
        print(json.dumps({"error": "Invalid JSON input received."}))
        sys.exit(1)

    except ValueError as ve:
        print(f"Error: {ve}", file=sys.stderr)
        print(json.dumps({"error": str(ve)}))
        sys.exit(1)

    except Exception as e:
        print(f"An unexpected error occurred in the main execution block: {e}", file=sys.stderr)
        print(json.dumps({"error": f"An unexpected error occurred: {str(e)}"}))
        sys.exit(1)