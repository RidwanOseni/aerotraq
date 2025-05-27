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

# Initialize Web3
w3 = Web3()

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

class FlightDataValidator:
    def __init__(self):
        self._state = ValidationState()
        self._db_conn: Optional[sqlite3.Connection] = None
        self._is_processing: bool = False

    def __enter__(self):
        self._db_conn = self._setup_database()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._db_conn:
            self._db_conn.close()
            self._db_conn = None

    @staticmethod
    def _setup_database() -> sqlite3.Connection:
        """Initialize database connection and schema."""
        conn = sqlite3.connect('flight_data.db')
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS flight_mappings
            (data_hash TEXT PRIMARY KEY, ipfs_cid TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)
        ''')
        conn.commit()
        return conn

    def _reset_state(self) -> None:
        """Reset the validation state."""
        self._state = ValidationState()
        self._is_processing = False

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
                                 mcp_results: Dict[str, Any]) -> Dict[str, Any]:
        """Create a validation package containing all relevant data."""
        return {
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
                "flightAreaCenter": self._normalize_string(flight_data.get("flightAreaCenter")),
                "flightAreaRadius": self._normalize_float(flight_data.get("flightAreaRadius")),
                "flightAreaMaxHeight": self._normalize_float(flight_data.get("flightAreaMaxHeight")),
                "additionalNotes": self._normalize_string(flight_data.get("additionalNotes"))
            },
            "validation_results": {
                "deterministic_checks": deterministic_results,
                "mcp_validation": mcp_results
            }
        }

    def serialize_validation_package(self, validation_package: Dict[str, Any]) -> str:
        """Serialize the validation package in a consistent manner."""
        if self._is_processing:
            raise RuntimeError("Another validation process is already in progress")
        
        self._state.validation_package = validation_package
        self._state.serialized_data = json.dumps(validation_package, sort_keys=True, separators=(',', ':'))
        return self._state.serialized_data

    def calculate_hash(self, serialized_data: str) -> bytes:
        """Calculate keccak256 hash of the serialized data."""
        self._state.data_hash = keccak(serialized_data.encode('utf-8'))
        return self._state.data_hash

    def store_flight_data(self, data_hash: str, ipfs_cid: str) -> None:
        """Store the mapping between data hash and IPFS CID."""
        if not self._db_conn:
            raise RuntimeError("Database connection not initialized")
        
        c = self._db_conn.cursor()
        c.execute('INSERT INTO flight_mappings (data_hash, ipfs_cid) VALUES (?, ?)',
                 (data_hash, ipfs_cid))
        self._db_conn.commit()
        self._state.ipfs_cid = ipfs_cid

    async def perform_deterministic_checks(self) -> Dict[str, List[str]]:
        """Perform basic deterministic checks on flight data."""
        self._validate_state('flight_data')

        check_results = {
            "flight_date": [],
            "flight_times": [],
            "drone_weight": []
        }

        # Check flight date
        flight_date_str = self._state.flight_data.get("flightDate")
        if flight_date_str:
            try:
                flight_date = datetime.strptime(flight_date_str, "%Y-%m-%d").date()
                if flight_date < datetime.now().date():
                    check_results["flight_date"].append("Flight date is in the past.")
            except ValueError:
                check_results["flight_date"].append(
                    f"Invalid flight date format: {flight_date_str}. Expected YYYY-MM-DD.")
        else:
            check_results["flight_date"].append("Flight date is missing.")

        # Check flight times
        start_time_str = self._state.flight_data.get("startTime")
        end_time_str = self._state.flight_data.get("endTime")
        
        if start_time_str and end_time_str:
            try:
                start_time = datetime.strptime(start_time_str, "%H:%M").time()
                end_time = datetime.strptime(end_time_str, "%H:%M").time()
                if start_time >= end_time:
                    check_results["flight_times"].append("Start time must be before end time.")
            except ValueError:
                check_results["flight_times"].append(
                    f"Invalid time format. Expected HH:MM for both start and end times.")
        else:
            if not start_time_str:
                check_results["flight_times"].append("Start time is missing.")
            if not end_time_str:
                check_results["flight_times"].append("End time is missing.")

        # Check drone weight
        weight = self._state.flight_data.get("weight")
        if weight is not None:
            try:
                weight_kg = float(weight)
                if weight_kg > 250:
                    check_results["drone_weight"].append(
                        "Drone weight exceeds 250g. Additional regulations may apply.")
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
        
        try:
            # 1. Initialize state
            self._reset_state()
            self._state.flight_data = flight_data

            # 2. Connect to IPFS
            print("Connecting to IPFS...", file=sys.stderr)
            async with aioipfs.AsyncIPFS() as ipfs_client:
                print("IPFS client connected.", file=sys.stderr)

                # 3. Initialize MCP client
                print("Initializing MCP client...", file=sys.stderr)
                mcp_client = OpenAIPClientIntegration()

                # 4. Perform deterministic checks
                print("Performing deterministic checks...", file=sys.stderr)
                deterministic_results = await self.perform_deterministic_checks()

                # 5. Call MCP validation
                print("Calling MCP validation...", file=sys.stderr)
                try:
                    mcp_result = await mcp_client.validate_flight_data(flight_data)
                    print("MCP validation complete.", file=sys.stderr)
                    self._state.mcp_results = mcp_result
                except Exception as mcp_error:
                    print(f"MCP validation error: {mcp_error}", file=sys.stderr)
                    mcp_result = {"status": "error", "message": str(mcp_error)}
                    self._state.mcp_results = mcp_result

                # 6. Gather raw flight data, deterministic results, and MCP results
                validation_package = self._create_validation_package(
                    flight_data, deterministic_results, mcp_result
                )

                # 7. Serialize the combined data
                print("Serializing validation package...", file=sys.stderr)
                serialized_data = self.serialize_validation_package(validation_package)
                print("Data serialized.", file=sys.stderr)

                # 8. Calculate hash
                print("Calculating hash...", file=sys.stderr)
                data_hash = self.calculate_hash(serialized_data)
                data_hash_hex = data_hash.hex()
                print(f"Data hash calculated: {data_hash_hex}", file=sys.stderr)

                # 9. Store hash in state (already done in calculate_hash)

                # 10. Prepare AI prompt with all information including hash
                comprehensive_prompt = f"""
                Given the following flight details, applicable regulations, deterministic check results, No-Fly Zone validation findings,
                and the calculated data hash, synthesize a comprehensive report detailing all potential compliance issues.
                Present the findings as a single list of bullet points.
                If no issues are found based on all provided information, state that the flight appears compliant.

                Flight Details:
                {json.dumps(flight_data, indent=2)}

                Deterministic Check Results:
                {json.dumps(deterministic_results, indent=2)}

                MCP No-Fly Zone Validation Results:
                {json.dumps(mcp_result, indent=2)}

                Data Hash:
                {data_hash_hex}

                Please analyze all the above information and provide a comprehensive compliance report that:
                1. Incorporates findings from all validation sources
                2. Prioritizes critical safety and regulatory issues
                3. Provides clear, actionable recommendations
                4. Notes any conflicting or ambiguous findings
                5. Highlights any validation errors or missing information

                Structure your response with 'Answer:' followed by the comprehensive report.
                """

                # 11. Call AI agent
                print("Initializing AI agent...", file=sys.stderr)
                try:
                    # Load regulations for AI analysis
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
                    response = agent.chat(comprehensive_prompt)
                    print("AI response received.", file=sys.stderr)

                    # 12. Process AI response
                    self._state.ai_report = self._extract_answer(str(response))
                except Exception as ai_error:
                    print(f"AI analysis error: {ai_error}", file=sys.stderr)
                    self._state.ai_report = f"Error during AI analysis: {str(ai_error)}"

                # 13. Upload to IPFS
                print("Uploading data to IPFS...", file=sys.stderr)
                try:
                    ipfs_add_result = await ipfs_client.core.add_bytes(serialized_data.encode('utf-8'))
                    ipfs_cid = ipfs_add_result['Hash']
                    print(f"Data uploaded to IPFS with CID: {ipfs_cid}", file=sys.stderr)

                    # 14. Store mapping in database
                    print("Storing mapping in database...", file=sys.stderr)
                    self.store_flight_data(data_hash_hex, ipfs_cid)
                    print("Mapping stored.", file=sys.stderr)

                except Exception as ipfs_e:
                    print(f"IPFS or Database Error: {ipfs_e}", file=sys.stderr)
                    return {
                        "compliance_messages": [f"Error during IPFS or Database Processing: {str(ipfs_e)}"],
                        "dataHash": data_hash_hex,
                        "ipfsCid": None,
                        "error": f"IPFS or Database Processing error: {str(ipfs_e)}"
                    }

                # 15. Prepare final result
                result = {
                    "compliance_messages": [self._state.ai_report],
                    "dataHash": data_hash_hex,
                    "ipfsCid": self._state.ipfs_cid,
                    "raw_validation_data": {
                        "deterministic_checks": self._state.deterministic_results,
                        "mcp_validation": self._state.mcp_results
                    }
                }

                return result

        except Exception as e:
            print(f"Unexpected error in async processing: {e}", file=sys.stderr)
            return {
                "compliance_messages": [f"Unexpected processing error: {str(e)}"],
                "error": f"Unexpected processing error: {str(e)}"
            }
        finally:
            self._is_processing = False
            if mcp_client:
                try:
                    await mcp_client.cleanup()
                    print("MCP client cleaned up.", file=sys.stderr)
                except Exception as cleanup_error:
                    print(f"Error during MCP client cleanup: {cleanup_error}", file=sys.stderr)

async def main():
    """Main entry point for the script."""
    print("Script started.", file=sys.stderr)
    try:
        input_json = sys.stdin.read()
        print(f"Received input JSON: {input_json}", file=sys.stderr)

        if not input_json:
            raise ValueError("No input JSON received.")

        flight_data = json.loads(input_json)
        print("Input JSON parsed successfully.", file=sys.stderr)

        with FlightDataValidator() as validator:
            result = await validator.validate_and_process_flight_data(flight_data)
            print(json.dumps(result))
            print("Script finished successfully.", file=sys.stderr)

    except json.JSONDecodeError:
        print("Error: Invalid JSON input received.", file=sys.stderr)
        print(json.dumps({
            "compliance_messages": ["Invalid JSON input received."],
            "error": "Invalid JSON input received."
        }))
        sys.exit(1)

    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        print(json.dumps({
            "compliance_messages": [f"An unexpected error occurred: {str(e)}"],
            "error": f"An unexpected error occurred: {str(e)}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())