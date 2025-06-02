import sys
import json
import os
import re
from datetime import datetime, time
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass

# Note: LlamaIndex, OpenAI LLM, etc. imports remain as they are used for AI analysis [21]
from llama_index.core import VectorStoreIndex, Settings
from llama_index.llms.openai import OpenAI
from llama_index.core.tools import QueryEngineTool
from llama_index.core.agent import ReActAgent
from llama_index.readers.llama_parse import LlamaParse

# Note: Web3 and aioipfs imports remain as they are used for hashing and IPFS [21]
from web3 import Web3
import aioipfs
import asyncio
from eth_hash.auto import keccak

# Note: sqlite3 and dotenv imports remain [8]
import sqlite3
from dotenv import load_dotenv

# Import the MCP client integration (which now gets config from env vars) [8]
from mcp_integration.client import OpenAIPClientIntegration

# Load environment variables
load_dotenv()

# Initialize Web3 (used for hashing with keccak) [8]
# w3 = Web3() # While w3 is imported, keccak is used directly [8]
# Set the LLM settings [8]
Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0)

@dataclass
class ValidationState:
    """Data class to hold the current validation state."""
    flight_data: Optional[Dict[str, Any]] = None
    serialized_data: Optional[str] = None
    data_hash: Optional[bytes] = None
    ipfs_cid: Optional[str] = None
    deterministic_results: Optional[Dict[str, List[str]]] = None
    mcp_results: Optional[Dict[str, Any]] = None
    ai_report: Optional[str] = None
    validation_package: Optional[Dict[str, Any]] = None
    is_critically_compliant: bool = False

class FlightDataValidator:
    def __init__(self):
        self._state = ValidationState()
        self._db_conn: Optional[sqlite3.Connection] = None
        self._is_processing: bool = False # State to prevent concurrent processing

    # Context manager methods for database connection
    def __enter__(self):
        self._db_conn = self._init_db()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._db_conn:
            self._db_conn.close()
            self._db_conn = None

    def _init_db(self) -> sqlite3.Connection:
        """Initialize SQLite database connection and table."""
        # Define database path using environment variable or default
        db_path = os.getenv("DB_PATH", "flight_data.db") # Use DB_PATH from .env [22]
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS flight_mappings (
                data_hash TEXT PRIMARY KEY,
                ipfs_cid TEXT
            )
        ''')
        conn.commit()
        return conn

    def _reset_state(self) -> None:
        """Reset the validation state."""
        self._state = ValidationState()
        # _is_processing is handled separately in the main validation function

    def _validate_state(self, required_state: str) -> None:
        """Validate that the required state is present."""
        if not getattr(self._state, required_state):
            raise RuntimeError(f"Required state '{required_state}' is not available")

    @staticmethod
    def _extract_answer(text: str) -> str:
        """Extract the answer from the AI's response."""
        # The AI prompt asks for "Answer:" followed by the report [23]
        match = re.search(r"Answer:\s*(.+)", text, re.DOTALL)
        return match.group(1).strip() if match else text.strip()

    def _normalize_string(self, value: Any) -> str:
        """Normalize string values."""
        # Handles None, strings, numbers by converting to string and stripping [23]
        return str(value).strip() if value is not None else ""

    def _normalize_float(self, value: Any) -> Optional[float]:
        """Normalize float values."""
        try:
            # Attempt to convert to float and round, return None if conversion fails [23]
            return round(float(value), 6) if value is not None else None
        except (ValueError, TypeError):
            return None

    def _create_validation_package(self, flight_data: Dict[str, Any],
                                deterministic_results: Dict[str, List[str]],
                                mcp_results: Dict[str, Any],
                                ai_report: str) -> Dict[str, Any]:
        """Create a validation package containing all relevant data."""
        # Extract lat/lng from the flightAreaCenter object for the package [24]
        flight_area_center_obj = flight_data.get("flightAreaCenter", {})
        normalized_latitude = self._normalize_float(flight_area_center_obj.get("latitude"))
        normalized_longitude = self._normalize_float(flight_area_center_obj.get("longitude"))

        # Structure the package based on requirements, including necessary fields [25]
        package = {
            "flight_data": {
                "droneName": self._normalize_string(flight_data.get("droneName")),
                "droneModel": self._normalize_string(flight_data.get("droneModel")),
                "droneType": self._normalize_string(flight_data.get("droneType")),
                "serialNumber": self._normalize_string(flight_data.get("serialNumber")),
                "weight": self._normalize_float(flight_data.get("weight")),
                "flightPurpose": self._normalize_string(flight_data.get("flightPurpose")),
                "flightDescription": self._normalize_string(flight_data.get("flightDescription")),
                "flightDate": self._normalize_string(flight_data.get("flightDate")),
                "startTime": self._normalize_string(flight_data.get("startTime")),
                "endTime": self._normalize_string(flight_data.get("endTime")),
                "dayNightOperation": self._normalize_string(flight_data.get("dayNightOperation")),
                "flightAreaCenter": { # Use normalized lat/lng in the package
                    "latitude": normalized_latitude,
                    "longitude": normalized_longitude
                },
                "flightAreaRadius": self._normalize_float(flight_data.get("flightAreaRadius")),
                "flightAreaMaxHeight": self._normalize_float(flight_data.get("flightAreaMaxHeight")),
                "additionalNotes": self._normalize_string(flight_data.get("additionalNotes"))
            },
            "validation_results": { # Include validation results in the package [26]
                "deterministic_checks": deterministic_results,
                "mcp_validation": mcp_results,
                "ai_report": ai_report
            }
        }
        return package

    def serialize_validation_package(self, validation_package: Dict[str, Any]) -> str:
        """Serialize the validation package in a consistent manner."""
        # Use sort_keys and separators for deterministic output regardless of Python dict order [27]
        # Store package and serialized data in state [26]
        self._state.validation_package = validation_package
        self._state.serialized_data = json.dumps(validation_package, sort_keys=True, separators=(',', ':'))
        return self._state.serialized_data

    def calculate_hash(self, serialized_data: str) -> bytes:
        """Calculate keccak256 hash of the serialized data."""
        self._state.data_hash = keccak(serialized_data.encode('utf-8')) # Use keccak from eth_hash [27]
        return self._state.data_hash

    def store_flight_data(self, data_hash: str, ipfs_cid: str) -> None:
        """Store the mapping between data hash and IPFS CID in the database."""
        if not self._db_conn:
            raise RuntimeError("Database connection not initialized")
        c = self._db_conn.cursor()
        # Use INSERT OR IGNORE to avoid errors if hash already exists (e.g., duplicate submission) [28]
        c.execute('INSERT OR IGNORE INTO flight_mappings (data_hash, ipfs_cid) VALUES (?, ?)',
                (data_hash, ipfs_cid))
        self._db_conn.commit()
        self._state.ipfs_cid = ipfs_cid # Store CID in state after successful DB operation [28]


    async def perform_deterministic_checks(self) -> Dict[str, List[str]]:
        """Perform basic deterministic checks on flight data."""
        self._validate_state('flight_data') # Ensure flight_data is loaded into state [29]
        check_results = {
            "flight_date": [],
            "flight_times": [],
            "drone_weight": []
        }
        flight_data = self._state.flight_data # Get data from state [29]

        # Check flight date
        flight_date_str = flight_data.get("flightDate")
        if flight_date_str:
            try:
                # Parse date as date object for comparison
                # Include 'T00:00:00' to avoid timezone issues with date parsing alone [29]
                flight_date = datetime.strptime(flight_date_str + 'T00:00:00', "%Y-%m-%dT%H:%M:%S").date()
                # Check if date is in the future
                if flight_date < datetime.now().date():
                    check_results["flight_date"].append(
                        f"Flight date {flight_date_str} is in the past.")
            except ValueError:
                check_results["flight_date"].append(
                    f"Invalid date format: {flight_date_str}. Expected YYYY-MM-DD.")
        else:
            check_results["flight_date"].append("Flight date is missing.")

        # Check flight times
        start_time_str = flight_data.get("startTime")
        end_time_str = flight_data.get("endTime")
        # Schema specifies time format HH:MM and range 09:00 to 17:30 [30, 31]
        operational_start_time = time(9, 0)
        operational_end_time = time(17, 30) # 5:30 PM

        if start_time_str and end_time_str:
            try:
                start_time_obj = datetime.strptime(start_time_str, "%H:%M").time()
                end_time_obj = datetime.strptime(end_time_str, "%H:%M").time()

                # Check if end time is after start time (already done by frontend schema refine [32])
                # Adding here for server-side robustness
                if end_time_obj <= start_time_obj:
                     check_results["flight_times"].append(
                         f"End time {end_time_str} must be after start time {start_time_str}.")

                # Check if times are within operational hours [30, 31]
                isStartTimeValid = operational_start_time <= start_time_obj <= operational_end_time
                isEndTimeValid = operational_start_time <= end_time_obj <= operational_end_time

                # The flight must be entirely within the operational hours. [31]
                if not isStartTimeValid or not isEndTimeValid:
                    check_results["flight_times"].append(
                        f"Flight times ({start_time_str} - {end_time_str}) must be between 09:00 and 17:30.")

            except ValueError:
                check_results["flight_times"].append(
                    f"Invalid time format. Expected HH:MM for both start and end times.")
        else:
            if not start_time_str:
                check_results["flight_times"].append("Start time is missing.")
            if not end_time_str:
                check_results["flight_times"].append("End time is missing.")

        # Check drone weight
        # Schema defines weight as min 50g, max 25000g [33]
        # Frontend description mentions max 25kg (25000g) without special auth [17]
        # Let's stick to the 25000g limit as per schema for critical check
        weight = flight_data.get("weight")
        if weight is not None:
            try:
                weight_grams = float(weight)
                if weight_grams > 25000:
                    check_results["drone_weight"].append(
                        f"Drone weight ({weight_grams}g) exceeds 25000g (25kg). Additional regulations may apply.")
                elif weight_grams < 50: # Also check minimum as per schema [33]
                    check_results["drone_weight"].append(
                        f"Drone weight ({weight_grams}g) is below minimum allowed (50g).")
            except ValueError:
                check_results["drone_weight"].append(
                    f"Invalid weight format: {weight}. Expected a number.")
        else:
            check_results["drone_weight"].append("Drone weight is missing.")

        self._state.deterministic_results = check_results
        return check_results

    async def validate_and_process_flight_data(self, flight_data: Dict[str, Any]) -> Dict[str, Any]:
        """Main validation and processing function."""
        if self._is_processing:
            raise RuntimeError("Another validation process is already in progress")

        self._is_processing = True
        mcp_client = None
        ipfs_client = None
        compliance_messages: List[str] = [] # Initialize compliance messages list
        has_critical_errors = False # Assume no critical errors initially

        try:
            # 1. Initialize state
            self._reset_state()
            self._state.flight_data = flight_data

            # 2. Initialize MCP client
            print("Initializing MCP client...", file=sys.stderr)
            mcp_client = OpenAIPClientIntegration() # MCP client gets config from env vars

            # 3. Perform deterministic checks
            print("Performing deterministic checks...", file=sys.stderr)
            deterministic_results = await self.perform_deterministic_checks()
            # Check if deterministic checks contain any errors (considered potentially critical by backend)
            has_deterministic_errors = any(len(messages) > 0 for messages in deterministic_results.values())

            # 4. Call MCP validation
            print("Calling MCP validation...", file=sys.stderr)
            # Default MCP result in case of failure or skipping
            mcp_result = {"status": "skipped", "message": "MCP validation skipped or failed to initialize."}
            has_mcp_errors = True # Default assumes failure or skip

            # MCP validation requires flightAreaCenter to be non-empty and parsable into lat/lng floats [34]
            flight_area_center = flight_data.get('flightAreaCenter')
            # Basic check for center data presence before attempting MCP call
            if flight_area_center and ( (isinstance(flight_area_center, str) and ',' in flight_area_center) or isinstance(flight_area_center, dict) ):
                 try:
                     # validate_flight_data now handles the transformation internally
                     mcp_result = await mcp_client.validate_flight_data(flight_data)
                     print("MCP validation complete.", file=sys.stderr)
                     self._state.mcp_results = mcp_result

                     # MCP status "success" means no issues found by the tool [18, 35]
                     # Status could be "tool_error" or "communication_error" on failure [36]
                     has_mcp_errors = mcp_result.get("status") != "success"

                 except Exception as mcp_call_error:
                     print(f"MCP tool call or communication error: {mcp_call_error}", file=sys.stderr)
                     mcp_result = {"status": "communication_error", "message": f"MCP tool call or communication error: {str(mcp_call_error)}"}
                     self._state.mcp_results = mcp_result
                     has_mcp_errors = True # Any error during the call is critical

            else:
                print("MCP validation skipped: flightAreaCenter is missing or not in expected string/object format.", file=sys.stderr)
                mcp_result = {"status": "skipped", "message": "flightAreaCenter is missing or not in expected string/object format. Cannot perform NFZ validation."}
                self._state.mcp_results = mcp_result
                has_mcp_errors = True # Missing/invalid center is considered critical for NFZ validation

            # Determine overall critical errors based on deterministic and MCP results
            # If deterministic checks found errors *or* MCP validation failed/skipped/errored
            has_critical_errors = has_deterministic_errors or has_mcp_errors
            self._state.is_critically_compliant = not has_critical_errors # Set the new state field [37]

            # 5. Prepare AI prompt with all information (regardless of errors for AI analysis) [38]
            # The AI agent is intended to synthesize and report, not necessarily be the critical gate.
            # We run it even if there are deterministic/MCP errors to provide a comprehensive report.

            comprehensive_prompt = f"""
Given the following flight details, deterministic check results, and No-Fly Zone validation findings,
synthesize a comprehensive report detailing all potential compliance issues.
Present the findings as a single list of bullet points.
If no critical issues are found based on the deterministic and NFZ validation information, state that the flight appears compliant.

Flight Details:
{json.dumps(self._state.flight_data, indent=2)}

Deterministic Check Results:
{json.dumps(deterministic_results, indent=2)}

MCP No-Fly Zone Validation Results:
{json.dumps(mcp_result, indent=2)}

Please analyze all the above information and provide a comprehensive compliance report that:
1. Incorporates findings from all validation sources
2. Prioritizes critical safety and regulatory issues
3. Provides clear, actionable recommendations (if any issues)
4. Notes any conflicting or ambiguous findings
5. Highlights any validation errors or missing information encountered by the *validators*.

Structure your response with 'Answer:' followed by the comprehensive report.
"""

            # 6. Call AI agent
            print("Initializing AI agent...", file=sys.stderr)
            # Default AI report in case of failure
            ai_report = f"Error during AI analysis: AI agent could not be initialized or failed."
            try:
                # Load regulations for AI analysis [39]
                regulations_path = os.path.join(os.path.dirname(__file__), "regulations.txt")
                print(f"Loading regulations from: {regulations_path}", file=sys.stderr)

                # LlamaParse needs to be awaited.
                documents = await LlamaParse(result_type="text", verbose=False).aload_data(regulations_path)
                index = VectorStoreIndex.from_documents(documents)
                query_engine = index.as_query_engine()
                query_tool = QueryEngineTool.from_defaults(
                    query_engine,
                    name="RegulationValidator",
                    description="A tool for validating flight details against the regulations.",
                )
                # Use agent.achat for async interaction [40]
                agent = ReActAgent.from_tools([query_tool], verbose=False)
                print("Sending comprehensive query to AI...", file=sys.stderr)
                response = await agent.achat(comprehensive_prompt) # Use achat for async [40]
                print("AI response received.", file=sys.stderr)

                # 7. Process AI response [37]
                ai_report = self._extract_answer(str(response))
                self._state.ai_report = ai_report

            except Exception as ai_error:
                print(f"AI analysis error: {ai_error}", file=sys.stderr)
                self._state.ai_report = f"Error during AI analysis: {str(ai_error)}"


            # 8. Prepare compliance messages for the frontend [41]
            # Always include the AI report if available, plus any specific errors from validators
            compliance_messages = [self._state.ai_report] # Start with AI report

            # Add specific error messages from validators if critical errors were detected [41]
            if has_critical_errors:
                if has_deterministic_errors:
                    # Include specific messages from deterministic checks
                    for check_type, messages in deterministic_results.items():
                        if messages:
                            compliance_messages.append(f"Deterministic Check Issue ({check_type}): " + "; ".join(messages))

                # Append the specific MCP message regardless of whether the call was attempted,
                # as the message itself indicates the reason for failure/skip. [42]
                # Use the message field from the mcp_result dictionary
                mcp_status = mcp_result.get('status', 'unknown')
                mcp_msg = mcp_result.get('message', 'Unknown MCP error details.')
                if mcp_status != 'success': # Only add explicit MCP message if it wasn't successful
                    compliance_messages.append(f"MCP Validation Status: {mcp_status}. Details: {mcp_msg}")

            # 9. Only proceed with serialization, hashing, IPFS, and DB if no critical errors [42]
            if self._state.is_critically_compliant:
                print("No critical errors found. Proceeding with serialization and storage.", file=sys.stderr)

                # 10. Gather data into a validation package structure [42]
                validation_package = self._create_validation_package(
                    self._state.flight_data, deterministic_results, mcp_result, self._state.ai_report
                )

                # 11. Serialize the combined data [43]
                print("Serializing validation package...", file=sys.stderr)
                serialized_data = self.serialize_validation_package(validation_package)
                print("Data serialized.", file=sys.stderr)

                # 12. Calculate hash [43]
                print("Validation package content (dict):", json.dumps(self._state.validation_package, indent=2), file=sys.stderr) # Added logging here
                print("Serialized data content (string):", self._state.serialized_data, file=sys.stderr) # Added logging here
                print("Calculating hash...", file=sys.stderr)
                data_hash = self.calculate_hash(serialized_data)
                # Format hash as 0x prefixed hex string [44]
                data_hash_hex = "0x" + data_hash.hex()
                print(f"Data hash calculated: {data_hash_hex}", file=sys.stderr)

                # 13. Upload to IPFS [45]
                print("Uploading data to IPFS...", file=sys.stderr)
                ipfs_cid = None
                try:
                    # Ensure IPFS client is used within an async context [45]
                    ipfs_client = aioipfs.AsyncIPFS()
                    async with ipfs_client:
                        ipfs_add_result = await ipfs_client.core.add_bytes(serialized_data.encode('utf-8'))
                        ipfs_cid = ipfs_add_result['Hash']
                        print(f"Data uploaded to IPFS with CID: {ipfs_cid}", file=sys.stderr)
                        self._state.ipfs_cid = ipfs_cid # Store CID in state only on success [46]

                except Exception as ipfs_error:
                    # It's okay to proceed if IPFS upload fails for the MVP, but report the warning [46]
                    sys.stderr.write(f"Warning: Failed to upload data to IPFS: {ipfs_error}\n")
                    print(f"Warning: Failed to upload data to IPFS: {ipfs_error}", file=sys.stderr)
                    # ipfs_cid remains None

                # 14. Store mapping in database [47]
                # Store hash regardless of IPFS success, as hash represents content identity [47]
                # Only attempt database storage if dataHash was successfully calculated
                if data_hash_hex:
                     print("Storing mapping in database...", file=sys.stderr)
                     try:
                         self.store_flight_data(data_hash_hex, ipfs_cid if ipfs_cid else "UPLOAD_FAILED") # Store placeholder CID if upload failed [47]
                         print("Mapping stored.", file=sys.stderr)
                     except Exception as db_error:
                         sys.stderr.write(f"Error storing mapping in database: {db_error}\n")
                         print(f"Error storing mapping in database: {db_error}", file=sys.stderr)
                         # Database error is potentially critical, but might allow returning hash/cid if generated


                # 15. Prepare final success result [48]
                result = {
                    "compliance_messages": compliance_messages,
                    "dataHash": data_hash_hex, # Include hash if generated
                    "ipfsCid": ipfs_cid, # Include CID (might be None)
                    "is_critically_compliant": self._state.is_critically_compliant, # This will be True
                    "raw_validation_data": { # Include raw data for debugging
                        "deterministic_checks": deterministic_results,
                        "mcp_validation": mcp_result
                    }
                }
                return result

            else: # has_critical_errors is True
                print("Critical errors found. Skipping serialization, hashing, IPFS upload, and DB storage.", file=sys.stderr) [48]
                # Return results *without* hash/cid indicating failure [49]
                result = {
                    "compliance_messages": compliance_messages, # Includes AI report and specific errors
                    "dataHash": None, # Indicate no data hash generated due to errors [49]
                    "ipfsCid": None, # Indicate no IPFS CID generated due to errors [49]
                    "is_critically_compliant": self._state.is_critically_compliant, # This will be False [49]
                    "error": "Validation reported critical issues. Data not stored on IPFS or DB.", # Top-level error for frontend [49]
                    "raw_validation_data": { # Include raw data for debugging [50]
                        "deterministic_checks": deterministic_results,
                        "mcp_validation": mcp_result
                    }
                }
                return result

        except Exception as e:
            # Handle any unexpected exceptions during the process [50]
            print(f"Unexpected error in async processing: {e}", file=sys.stderr)
            # Ensure compliance_messages is defined even if an early error occurred [50]
            final_compliance_messages = [f"Unexpected processing error: {str(e)}"]
            if 'compliance_messages' in locals() and compliance_messages:
                final_compliance_messages.extend(compliance_messages)

            return {
                "compliance_messages": final_compliance_messages,
                "error": f"Unexpected processing error: {str(e)}",
                "dataHash": None, # Indicate no data hash generated [51]
                "ipfsCid": None, # Indicate no IPFS CID generated [51]
                "is_critically_compliant": False, # Unexpected errors mean not compliant [51]
                # raw_validation_data might not be available on unexpected early errors [51]
            }

        finally:
            self._is_processing = False
            # Clean up MCP client if it was initialized [51]
            if mcp_client:
                try:
                    await mcp_client.cleanup()
                    print("MCP client cleaned up.", file=sys.stderr) # [52]
                except Exception as cleanup_error:
                    print(f"Error during MCP client cleanup: {cleanup_error}", file=sys.stderr)
            # IPFS client is handled by the async with block if it was initialized within the try block [52]

    async def main(self):
        """Main entry point for the script."""
        print("Script started.", file=sys.stderr) # [52]
        try:
            input_json = sys.stdin.read()
            print(f"Received input JSON: {input_json}", file=sys.stderr) # [52]
            if not input_json:
                raise ValueError("No input JSON received.") # [52]

            flight_data = json.loads(input_json)
            print("Input JSON parsed successfully.", file=sys.stderr) # [53]

            # Use the context manager for the validator to ensure database connection is closed [53]
            # The main async logic is now within the context manager [53]
            with FlightDataValidator() as validator:
                result = await validator.validate_and_process_flight_data(flight_data)

            # Output the result as JSON to stdout [53]
            print(json.dumps(result))
            print("Script finished successfully.", file=sys.stderr) # [53]

        except json.JSONDecodeError:
            error_response = {"status": "error", "message": "Invalid JSON input received from stdin.", "dataHash": None, "ipfsCid": None, "is_critically_compliant": False} # [53]
            # Output error as JSON to stderr and stdout for route handler to catch [54]
            print(json.dumps(error_response), file=sys.stderr)
            print(json.dumps(error_response)) # Also print to stdout for the route handler [54]
            sys.exit(1) # [54]

        except Exception as main_error:
            # Catch any other exceptions that occur before or after the validator context [54]
            error_response = {"status": "error", "message": f"Application error: {str(main_error)}", "dataHash": None, "ipfsCid": None, "is_critically_compliant": False} # [54]
            # Output error as JSON to stderr and stdout for route handler to catch [20]
            print(json.dumps(error_response), file=sys.stderr)
            print(json.dumps(error_response)) # Also print to stdout for the route handler [20]
            sys.exit(1) # [20]


# The __main__ block is present below, handling the asyncio run [20]
if __name__ == "__main__":
    # The Next.js API route expects the Python script to be run via `spawn` [6]
    # and communicate via stdin/stdout [6].
    # The __main__ block should handle reading from stdin, running the async main function,
    # and printing the final JSON result to stdout. [20]

    # Async entry point
    # The FlightDataValidator class now initializes the OpenAIPClientIntegration internally [9]
    # This structure is consistent with the original source [20]
    asyncio.run(FlightDataValidator().main())