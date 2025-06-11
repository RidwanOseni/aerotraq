import sys
import json
import os
import re
from datetime import datetime, time
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
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
from mcp_integration.client import OpenAIPClientIntegration

# Load environment variables
load_dotenv()

# Set the LLM settings
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

    # New fields for Story Protocol details
    ip_id: Optional[str] = None
    license_terms_id: Optional[int] = None

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
        db_path = os.getenv("DB_PATH", "flight_data.db")
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        # Update the schema if needed (e.g., add columns for ip_id and license_terms_id)
        try:
            c.execute('''
                CREATE TABLE IF NOT EXISTS flight_mappings (
                    data_hash TEXT PRIMARY KEY,
                    ipfs_cid TEXT,
                    ip_id TEXT,
                    license_terms_id INTEGER
                )
            ''')
            conn.commit()
        except Exception as e:
            # In a real application, you would use a database migration tool
            print(f"Warning: Could not ensure flight_mappings table schema: {e}", file=sys.stderr)
        return conn

    def _reset_state(self) -> None:
        """Reset the validation state."""
        self._state = ValidationState()

    def _validate_state(self, required_state: str) -> None:
        """Validate that the required state is present."""
        if not getattr(self._state, required_state):
            raise RuntimeError(f"Required state '{required_state}' is not available")

    @staticmethod
    def _extract_answer(text: str) -> str:
        """Extract the answer from the AI's response."""
        match = re.search(r"Answer:\s*(.+)", text, re.DOTALL)
        return match.group(1).strip() if match else text.strip()

    def _normalize_string(self, value: Any) -> str:
        """Normalize string values."""
        return str(value).strip() if value is not None else ""

    def _normalize_float(self, value: Any) -> Optional[float]:
        """Normalize float values."""
        try:
            return round(float(value), 6) if value is not None else None
        except (ValueError, TypeError):
            return None

    def _create_validation_package(self, flight_data: Dict[str, Any],
                                   deterministic_results: Dict[str, List[str]],
                                   mcp_results: Dict[str, Any],
                                   ai_report: str) -> Dict[str, Any]:
        """Create a validation package containing all relevant data."""
        flight_area_center_obj = flight_data.get("flightAreaCenter", {})
        normalized_latitude = self._normalize_float(flight_area_center_obj.get("latitude"))
        normalized_longitude = self._normalize_float(flight_area_center_obj.get("longitude"))
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
                "flightAreaCenter": {
                    "latitude": normalized_latitude,
                    "longitude": normalized_longitude
                },
                "flightAreaRadius": self._normalize_float(flight_data.get("flightAreaRadius")),
                "flightAreaMaxHeight": self._normalize_float(flight_data.get("flightAreaMaxHeight")),
                "additionalNotes": self._normalize_string(flight_data.get("additionalNotes"))
            },
            "validation_results": {
                "deterministic_checks": deterministic_results,
                "mcp_validation": mcp_results,
                "ai_report": ai_report
            }
        }
        return package

    def serialize_validation_package(self, validation_package: Dict[str, Any]) -> str:
        """Serialize the validation package in a consistent manner."""
        self._state.validation_package = validation_package
        self._state.serialized_data = json.dumps(validation_package, sort_keys=True, separators=(',', ':'))
        return self._state.serialized_data

    def calculate_hash(self, serialized_data: str) -> bytes:
        """Calculate keccak256 hash of the serialized data."""
        self._state.data_hash = keccak(serialized_data.encode('utf-8'))
        return self._state.data_hash

    def store_flight_data(self, data_hash: str, ipfs_cid: str, ip_id: Optional[str] = None, license_terms_id: Optional[int] = None) -> None:
        """Store the mapping between data hash, IPFS CID, IP ID, and License Terms ID in the database."""
        if not self._db_conn:
            raise RuntimeError("Database connection not initialized")
        c = self._db_conn.cursor()
        # Update the schema if needed (e.g., add columns for ip_id and license_terms_id)
        try:
            c.execute('''
                CREATE TABLE IF NOT EXISTS flight_mappings (
                    data_hash TEXT PRIMARY KEY,
                    ipfs_cid TEXT,
                    ip_id TEXT,
                    license_terms_id INTEGER
                )
            ''')
            self._db_conn.commit()
        except Exception as e:
            # In a real application, handle this more robustly
            print(f"Warning: Could not ensure flight_mappings table schema: {e}", file=sys.stderr)
        c.execute('''
            INSERT OR REPLACE INTO flight_mappings (data_hash, ipfs_cid, ip_id, license_terms_id)
            VALUES (?, ?, ?, ?)
        ''', (data_hash, ipfs_cid, ip_id, license_terms_id))
        self._db_conn.commit()
        print(f"Mapping stored/updated for hash {data_hash}: ipfs_cid={ipfs_cid}, ip_id={ip_id}, license_terms_id={license_terms_id}", file=sys.stderr)
        # Update state to include IP ID and License Terms ID if provided
        if ip_id:
            self._state.ip_id = ip_id
        if license_terms_id is not None:
            self._state.license_terms_id = license_terms_id

    def get_flight_data_by_hash(self, data_hash: str) -> Optional[Dict[str, Any]]:
        """Retrieve flight data including Story Protocol details by data hash."""
        if not self._db_conn:
            raise RuntimeError("Database connection not initialized")
        c = self._db_conn.cursor()
        c.execute('SELECT data_hash, ipfs_cid, ip_id, license_terms_id FROM flight_mappings WHERE data_hash = ?', (data_hash,))
        row = c.fetchone()
        if row:
            return {
                "dataHash": row[0],  # Extract the string data_hash from the tuple
                "ipfsCid": row[1],
                "ipId": row[2],
                "licenseTermsId": row[3],
            }
        return None

    def get_flight_data_by_hashes(self, data_hashes: List[str]) -> List[Dict[str, Any]]:
        """Retrieve flight data including Story Protocol details by a list of data hashes."""
        if not self._db_conn:
            raise RuntimeError("Database connection not initialized")
        c = self._db_conn.cursor()
        if not data_hashes:
            return [] # Return empty list if no hashes are provided
        placeholders = ','.join('?' for _ in data_hashes)
        c.execute(f'SELECT data_hash, ipfs_cid, ip_id, license_terms_id FROM flight_mappings WHERE data_hash IN ({placeholders})', data_hashes)
        rows = c.fetchall()
        results = []
        for row in rows:
            results.append({
                "dataHash": row[0],  # Extract the string data_hash from the tuple
                "ipfsCid": row[1],
                "ipId": row[2],
                "licenseTermsId": row[3],
            })
        return results

    async def update_story_protocol_details(self, data_hash: str, ip_id: str, license_terms_id: int):
        """Update a flight record with Story Protocol IP ID and License Terms ID."""
        print(f"Attempting to update flight record {data_hash} with IP ID {ip_id} and License Terms ID {license_terms_id}", file=sys.stderr)
        # Ensure database connection is initialized for this operation
        if not self._db_conn:
            self._db_conn = self._init_db()
        c = self._db_conn.cursor()
        # First, check if the flight hash exists
        c.execute('SELECT data_hash FROM flight_mappings WHERE data_hash = ?', (data_hash,))
        if c.fetchone() is None:
            raise ValueError(f"Flight hash {data_hash} not found in database.")
        # Update the record
        c.execute('''
            UPDATE flight_mappings
            SET ip_id = ?, license_terms_id = ?
            WHERE data_hash = ?
        ''', (ip_id, license_terms_id, data_hash))
        self._db_conn.commit()
        print(f"Successfully updated flight record {data_hash} with Story Protocol details.", file=sys.stderr)
        return {"status": "success", "message": "Story Protocol details updated successfully."}

    async def perform_deterministic_checks(self) -> Dict[str, List[str]]:
        """Perform basic deterministic checks on flight data."""
        self._validate_state('flight_data')
        check_results = {
            "flight_date": [],
            "flight_times": [],
            "drone_weight": []
        }
        flight_data = self._state.flight_data

        # Check flight date
        flight_date_str = flight_data.get("flightDate")
        if flight_date_str:
            try:
                flight_date = datetime.strptime(flight_date_str + 'T00:00:00', "%Y-%m-%dT%H:%M:%S").date()
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
        operational_start_time = time(9, 0)
        operational_end_time = time(17, 30)

        if start_time_str and end_time_str:
            try:
                start_time_obj = datetime.strptime(start_time_str, "%H:%M").time()
                end_time_obj = datetime.strptime(end_time_str, "%H:%M").time()
                if end_time_obj <= start_time_obj:
                    check_results["flight_times"].append(
                        f"End time {end_time_str} must be after start time {start_time_str}.")
                isStartTimeValid = operational_start_time <= start_time_obj <= operational_end_time
                isEndTimeValid = operational_start_time <= end_time_obj <= operational_end_time
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
        weight = flight_data.get("weight")
        if weight is not None:
            try:
                weight_grams = float(weight)
                if weight_grams > 25000:
                    check_results["drone_weight"].append(
                        f"Drone weight ({weight_grams}g) exceeds 25000g (25kg). Additional regulations may apply.")
                elif weight_grams < 50:
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
        compliance_messages: List[str] = []
        has_critical_errors = False
        try:
            # 1. Initialize state
            self._reset_state()
            self._state.flight_data = flight_data

            # 2. Initialize MCP client
            print("Initializing MCP client...", file=sys.stderr)
            mcp_client = OpenAIPClientIntegration()

            # 3. Perform deterministic checks
            print("Performing deterministic checks...", file=sys.stderr)
            deterministic_results = await self.perform_deterministic_checks()
            has_deterministic_errors = any(len(messages) > 0 for messages in deterministic_results.values())

            # 4. Call MCP validation
            print("Calling MCP validation...", file=sys.stderr)
            mcp_result = {"status": "skipped", "message": "MCP validation skipped or failed to initialize."}
            has_mcp_errors = True
            flight_area_center = flight_data.get('flightAreaCenter')
            if flight_area_center and ( (isinstance(flight_area_center, str) and ',' in flight_area_center) or isinstance(flight_area_center, dict) ):
                try:
                    mcp_result = await mcp_client.validate_flight_data(flight_data)
                    print("MCP validation complete.", file=sys.stderr)
                    self._state.mcp_results = mcp_result
                    has_mcp_errors = mcp_result.get("status") != "success"
                except Exception as mcp_call_error:
                    print(f"MCP tool call or communication error: {mcp_call_error}", file=sys.stderr)
                    mcp_result = {"status": "communication_error", "message": f"MCP tool call or communication error: {str(mcp_call_error)}"}
                    self._state.mcp_results = mcp_result
                    has_mcp_errors = True
            else:
                print("MCP validation skipped: flightAreaCenter is missing or not in expected string/object format.", file=sys.stderr)
                mcp_result = {"status": "skipped", "message": "flightAreaCenter is missing or not in expected string/object format. Cannot perform NFZ validation."}
                self._state.mcp_results = mcp_result
                has_mcp_errors = True

            has_critical_errors = has_deterministic_errors or has_mcp_errors
            self._state.is_critically_compliant = not has_critical_errors

            # 5. Prepare AI prompt with all information
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
            5. Highlights any validation errors or missing information encountered by the validators.

            Structure your response with 'Answer:' followed by the comprehensive report.
            """

            # 6. Call AI agent
            print("Initializing AI agent...", file=sys.stderr)
            ai_report = f"Error during AI analysis: AI agent could not be initialized or failed."
            try:
                regulations_path = os.path.join(os.path.dirname(__file__), "regulations.txt")
                print(f"Loading regulations from: {regulations_path}", file=sys.stderr)
                documents = await LlamaParse(result_type="text", verbose=False).aload_data(regulations_path)
                index = VectorStoreIndex.from_documents(documents)
                query_engine = index.as_query_engine()
                query_tool = QueryEngineTool.from_defaults(
                    query_engine,
                    name="RegulationValidator",
                    description="A tool for validating flight details against the regulations.",
                )
                agent = ReActAgent.from_tools([query_tool], verbose=False)
                print("Sending comprehensive query to AI...", file=sys.stderr)
                response = await agent.achat(comprehensive_prompt)
                print("AI response received.", file=sys.stderr)
                ai_report = self._extract_answer(str(response))
                self._state.ai_report = ai_report
            except Exception as ai_error:
                print(f"AI analysis error: {ai_error}", file=sys.stderr)
                self._state.ai_report = f"Error during AI analysis: {str(ai_error)}"

            # 7. Prepare compliance messages for the frontend
            compliance_messages = [self._state.ai_report]
            if has_critical_errors:
                if has_deterministic_errors:
                    for check_type, messages in deterministic_results.items():
                        if messages:
                            compliance_messages.append(f"Deterministic Check Issue ({check_type}): " + "; ".join(messages))
                mcp_status = mcp_result.get('status', 'unknown')
                mcp_msg = mcp_result.get('message', 'Unknown MCP error details.')
                if mcp_status != 'success':
                    compliance_messages.append(f"MCP Validation Status: {mcp_status}. Details: {mcp_msg}")

            # 8. Only proceed with serialization, hashing, IPFS, and DB if no critical errors
            if self._state.is_critically_compliant:
                print("No critical errors found. Proceeding with serialization and storage.", file=sys.stderr)

                # 9. Gather data into a validation package structure
                validation_package = self._create_validation_package(
                    self._state.flight_data, deterministic_results, mcp_result, self._state.ai_report
                )

                # 10. Serialize the combined data
                print("Serializing validation package...", file=sys.stderr)
                serialized_data = self.serialize_validation_package(validation_package)
                print("Data serialized.", file=sys.stderr)
                print("Validation package content (dict):", json.dumps(self._state.validation_package, indent=2), file=sys.stderr)
                print("Serialized data content (string):", self._state.serialized_data, file=sys.stderr)

                # 11. Calculate hash
                print("Calculating hash...", file=sys.stderr)
                data_hash = self.calculate_hash(serialized_data)
                data_hash_hex = "0x" + data_hash.hex()
                print(f"Data hash calculated: {data_hash_hex}", file=sys.stderr)

                # 12. Upload to IPFS
                print("Uploading data to IPFS...", file=sys.stderr)
                ipfs_cid = None
                try:
                    ipfs_client = aioipfs.AsyncIPFS()
                    async with ipfs_client:
                        ipfs_add_result = await ipfs_client.core.add_bytes(serialized_data.encode('utf-8'))
                        ipfs_cid = ipfs_add_result['Hash']
                    print(f"Data uploaded to IPFS with CID: {ipfs_cid}", file=sys.stderr)
                    self._state.ipfs_cid = ipfs_cid
                except Exception as ipfs_error:
                    sys.stderr.write(f"Warning: Failed to upload data to IPFS: {ipfs_error}\n")
                    print(f"Warning: Failed to upload data to IPFS: {ipfs_error}", file=sys.stderr)
                    ipfs_cid = None

                # 13. Store mapping in database
                if data_hash_hex:
                    print("Storing mapping in database...", file=sys.stderr)
                    try:
                        # Call the modified store_flight_data with None for ip_id and license_terms_id initially
                        self.store_flight_data(data_hash_hex, ipfs_cid if ipfs_cid else "UPLOAD_FAILED", None, None)
                        print("Mapping stored.", file=sys.stderr)
                    except Exception as db_error:
                        sys.stderr.write(f"Error storing mapping in database: {db_error}\n")
                        print(f"Error storing mapping in database: {db_error}", file=sys.stderr)

                # 14. Prepare final success result
                result = {
                    "compliance_messages": compliance_messages,
                    "dataHash": data_hash_hex,
                    "ipfsCid": ipfs_cid,
                    "is_critically_compliant": self._state.is_critically_compliant,
                    "raw_validation_data": {
                        "deterministic_checks": deterministic_results,
                        "mcp_validation": mcp_result
                    }
                }
                return result
            else: # has_critical_errors is True
                print("Critical errors found. Skipping serialization, hashing, IPFS upload, and DB storage.", file=sys.stderr)
                result = {
                    "compliance_messages": compliance_messages,
                    "dataHash": None,
                    "ipfsCid": None,
                    "is_critically_compliant": self._state.is_critically_compliant,
                    "error": "Validation reported critical issues. Data not stored on IPFS or DB.",
                    "raw_validation_data": {
                        "deterministic_checks": deterministic_results,
                        "mcp_validation": mcp_result
                    }
                }
                return result
        except Exception as e:
            print(f"Unexpected error in async processing: {e}", file=sys.stderr)
            final_compliance_messages = [f"Unexpected processing error: {str(e)}"]
            if 'compliance_messages' in locals() and compliance_messages:
                final_compliance_messages.extend(compliance_messages)
            return {
                "compliance_messages": final_compliance_messages,
                "error": f"Unexpected processing error: {str(e)}",
                "dataHash": None,
                "ipfsCid": None,
                "is_critically_compliant": False,
            }
        finally:
            self._is_processing = False
            if mcp_client:
                try:
                    await mcp_client.cleanup()
                    print("MCP client cleaned up.", file=sys.stderr)
                except Exception as cleanup_error:
                    print(f"Error during MCP client cleanup: {cleanup_error}", file=sys.stderr)

    async def main(self):
        """Main entry point for the script. Handles different actions based on input."""
        print("Script started.", file=sys.stderr)
        # Initialize _db_conn at the top level of main to ensure it's closed in finally
        self._db_conn = None
        try:
            input_json = sys.stdin.read()
            print(f"Received input JSON: {input_json}", file=sys.stderr)
            if not input_json:
                raise ValueError("No input JSON received.")
            parsed_input = json.loads(input_json)

            # Check if the input specifies a specific action
            action = parsed_input.get("action")
            if action == "update_story_protocol_details":
                # Handle updating story protocol details
                data_hash = parsed_input.get("dataHash")
                ip_id = parsed_input.get("ipId")
                license_terms_id = parsed_input.get("licenseTermsId")
                if not data_hash or not ip_id or license_terms_id is None:
                    raise ValueError("Missing required parameters for update_story_protocol_details action.")
                # Ensure database connection is initialized for this action
                self._db_conn = self._init_db()
                result = await self.update_story_protocol_details(data_hash, ip_id, license_terms_id)
                print(json.dumps(result)) # Output result to stdout
            elif action == "get_story_protocol_details_by_hash":
                data_hash = parsed_input.get("dataHash")
                if not data_hash:
                    raise ValueError("Missing dataHash for get_story_protocol_details_by_hash action.")
                self._db_conn = self._init_db() # Init DB here
                details = self.get_flight_data_by_hash(data_hash)
                if details:
                    # Ensure licenseTermsId is a standard int for JSON serialization if it came as BigInt.
                    # SQLite stores INTEGER, so it should be fine.
                    if details.get("licenseTermsId") is not None:
                        details["licenseTermsId"] = int(details["licenseTermsId"])
                    print(json.dumps({"status": "success", "details": details}))
                else:
                    print(json.dumps({"status": "error", "message": f"No details found for dataHash: {data_hash}"}))
            elif action == "get_story_protocol_details_by_hashes": # New action to get details for multiple hashes
                data_hashes = parsed_input.get("dataHashes")
                if not data_hashes or not isinstance(data_hashes, list):
                    raise ValueError("Missing or invalid dataHashes for get_story_protocol_details_by_hashes action.")
                self._db_conn = self._init_db()
                details_list = self.get_flight_data_by_hashes(data_hashes)
                # Ensure licenseTermsId is a standard int for JSON serialization if it came as BigInt.
                for details in details_list:
                    if details.get("licenseTermsId") is not None:
                        details["licenseTermsId"] = int(details["licenseTermsId"])
                print(json.dumps({"status": "success", "details": details_list}))
            else:
                # Assume standard validation/processing flow if no action specified
                flight_data = parsed_input # Assume the input is flight data for validation
                # Ensure database connection is initialized for the validation flow as well
                self._db_conn = self._init_db()
                result = await self.validate_and_process_flight_data(flight_data)
                print(json.dumps(result))
            print("Script finished successfully.", file=sys.stderr)
        except (json.JSONDecodeError, ValueError) as e:
            error_response = {"status": "error", "message": f"Input processing error: {str(e)}", "dataHash": None, "ipfsCid": None, "is_critically_compliant": False}
            print(json.dumps(error_response), file=sys.stderr)
            print(json.dumps(error_response))
            sys.exit(1)
        except Exception as main_error:
            print(f"Application error: {str(main_error)}", file=sys.stderr)
            error_response = {"status": "error", "message": f"Application error: {str(main_error)}", "dataHash": None, "ipfsCid": None, "is_critically_compliant": False}
            print(json.dumps(error_response), file=sys.stderr)
            print(json.dumps(error_response))
            sys.exit(1)
        finally:
            # Clean up database connection if it was initialized in main
            if self._db_conn:
                self._db_conn.close()
                self._db_conn = None
            # MCP client cleanup is handled within validate_and_process_flight_data

# The __main__ block remains the same, handling the asyncio run
if __name__ == "__main__":
    asyncio.run(FlightDataValidator().main())