import asyncio
import os
import sys
import json
from typing import Optional, Union, Any, List
from contextlib import AsyncExitStack

# Import necessary classes from the MCP Python SDK
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Import the OpenAI SDK
from openai import OpenAI

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Define the path to your OpenAIP MCP server executable
OPENAIP_SERVER_PATH = "C:/Users/hp/Desktop/DeAI-Bootcamp/Final Project/Team9EncodeDeAIBootcamp2025-UAVguardChain/mcp-server/openaip-mcp-server/build/index.js"

# Retrieve OpenAIP API key - used by the server, but the client passes it via env
openaip_api_key = os.getenv("OPENAIP_API_KEY")
if not openaip_api_key:
    print("Error: OPENAIP_API_KEY environment variable is not set.", file=sys.stderr)
    sys.exit(1)

class OpenAIPClientIntegration:
    """
    Integrates MCP client functionality into the drone registry backend.
    Connects to the OpenAIP MCP server to use its tools (e.g., NFZ validation).
    Uses OpenAI API for potential LLM orchestration or interactions.
    """
    def __init__(self):
        # Initialize session and client objects
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
        self.stdio = None
        self.write = None

        # Initialize OpenAI client - it automatically reads OPENAI_API_KEY from env
        try:
            self.openai_client = OpenAI()
        except Exception as e:
            print(f"Error initializing OpenAI client: {e}. OpenAI API functionality may be unavailable.", file=sys.stderr)
            self.openai_client = None

    async def connect_to_server(self):
        """
        Connects to the OpenAIP MCP server process.
        Launches the server as a subprocess and establishes communication.
        """
        if self.session is not None:
            return

        print("Attempting to connect to OpenAIP MCP server...", file=sys.stderr)
        server_env = os.environ.copy()
        server_env["OPENAIP_API_KEY"] = openaip_api_key

        # Configure server parameters for stdio_client
        server_params = StdioServerParameters(
            command="node",  # The executable command
            args=[OPENAIP_SERVER_PATH],  # The arguments as a list
            env=server_env
        )

        try:
            # First, get the stdio transport
            stdio_transport = await self.exit_stack.enter_async_context(
                stdio_client(server_params)
            )
            
            # Unpack the transport into stdio and write streams
            self.stdio, self.write = stdio_transport
            
            # Create the client session with the streams
            self.session = await self.exit_stack.enter_async_context(
                ClientSession(self.stdio, self.write)
            )
            
            print("Connected to OpenAIP MCP server.", file=sys.stderr)

            # List tools available on the server to confirm connection and capabilities
            try:
                response = await self.session.list_tools()
                print("Available tools on server:", file=sys.stderr)
                for tool in response.tools:
                    print(f" - {tool.name}: {tool.description}", file=sys.stderr)
            except Exception as e:
                print(f"Failed to list tools: {e}. The server might not support 'tools/list'.", file=sys.stderr)
                # Based on error-message.txt, prompts/list returned Method not found [-32601] [17, 18],
                # but tools/list should be standard for servers exposing tools

        except Exception as e:
            print(f"Failed to connect to OpenAIP MCP server: {e}", file=sys.stderr)
            self.session = None
            self.stdio = None
            self.write = None
            raise

    def _transform_flight_data(self, flight_data: dict) -> dict:
        """
        Transform frontend flight data into the format expected by the validate-nfz tool.
        """
        try:
            # Extract coordinates from flightAreaCenter (format: "latitude, longitude")
            lat_str, lon_str = flight_data.get('flightAreaCenter', '').split(',')
            latitude = float(lat_str.strip())
            longitude = float(lon_str.strip())

            # Get altitude from flightAreaMaxHeight
            altitude = float(flight_data.get('flightAreaMaxHeight', 0))

            # Get search radius from flightAreaRadius (convert to km if needed)
            search_radius = float(flight_data.get('flightAreaRadius', 5)) / 1000  # Convert meters to kilometers

            # Define reference datum mapping
            REFERENCE_DATUM_MAP = {
                "AMSL": 1,  # Above Mean Sea Level
                "AGL": 2,   # Above Ground Level
                "MSL": 1,   # Mean Sea Level (same as AMSL)
                "WGS84": 3  # World Geodetic System 1984
            }

            # Use AMSL (1) as the default reference datum
            reference_datum = REFERENCE_DATUM_MAP.get("AMSL", 1)

            # Construct the tool arguments
            tool_args = {
                "coordinates": {
                    "latitude": latitude,
                    "longitude": longitude,
                    "altitude": altitude,
                    "referenceDatum": reference_datum  # Now using numerical value
                },
                "searchRadius": search_radius
            }

            return tool_args

        except (ValueError, AttributeError) as e:
            print(f"Error transforming flight data: {e}", file=sys.stderr)
            raise ValueError(f"Invalid flight data format: {e}")

    def _extract_serializable_content(self, result: Any) -> Union[str, dict, list]:
        """
        Extract serializable content from MCP server response.
        Handles CallToolResult and its content types properly.
        """
        try:
            if hasattr(result, 'content'):
                content = result.content
                # Handle list of content blocks
                if isinstance(content, list):
                    return [self._extract_serializable_content(item) for item in content]
                # Handle TextContent type
                elif hasattr(content, 'text'):
                    return content.text
                # Handle dictionary content
                elif isinstance(content, dict):
                    return {k: self._extract_serializable_content(v) for k, v in content.items()}
                # Handle primitive types
                elif isinstance(content, (str, int, float, bool)):
                    return content
                # Fallback to string representation
                else:
                    return str(content)
            # Handle direct primitive types
            elif isinstance(result, (str, int, float, bool)):
                return result
            # Handle dictionaries
            elif isinstance(result, dict):
                return {k: self._extract_serializable_content(v) for k, v in result.items()}
            # Handle lists
            elif isinstance(result, list):
                return [self._extract_serializable_content(item) for item in result]
            # Fallback for any other type
            else:
                return str(result)
        except Exception as e:
            print(f"Error extracting serializable content: {e}", file=sys.stderr)
            return str(result)

    async def validate_flight_data(self, flight_data: dict):
        """
        Calls the NFZ validation tool on the connected OpenAIP MCP server.
        """
        if self.session is None:
            print("Client not connected to server. Attempting to connect...", file=sys.stderr)
            try:
                await self.connect_to_server()
            except Exception as e:
                print(f"Connection attempt failed: {e}", file=sys.stderr)
                return {"error": f"Could not connect to MCP server: {e}"}

        if self.session is None:
            return {"error": "Could not connect to MCP server after attempt."}

        try:
            # Transform the flight data into the format expected by the tool
            tool_args = self._transform_flight_data(flight_data)
            
            print(f"Calling tool 'validate-nfz' with args: {tool_args}", file=sys.stderr)

            result = await self.session.call_tool("validate-nfz", tool_args)
            print(f"Tool call result received: {result}", file=sys.stderr)
            
            # Extract serializable content from the result
            serializable_result = self._extract_serializable_content(result)
            
            return {"status": "success", "validationResult": serializable_result}

        except Exception as e:
            print(f"Error calling tool 'validate-nfz': {e}", file=sys.stderr)
            return {"status": "error", "message": f"Error validating flight data: {e}"}

    async def cleanup(self):
        """
        Clean up resources, including closing the MCP session and the server process.
        """
        print("Performing MCP client cleanup...", file=sys.stderr)
        await self.exit_stack.aclose()
        self.session = None
        self.stdio = None
        self.write = None
        print("MCP client cleanup complete.", file=sys.stderr)

if __name__ == "__main__":
    try:
        # Read all of stdin
        input_json_string = sys.stdin.read()

        if not input_json_string:
            raise ValueError("No input JSON received from stdin.")

        # Parse JSON string into a dictionary
        flight_data_to_validate = json.loads(input_json_string)

        # Run the async main logic
        async def run_validation():
            client = OpenAIPClientIntegration()
            try:
                # connect_to_server is called internally by validate_flight_data if needed
                validation_result = await client.validate_flight_data(flight_data_to_validate)
                print(json.dumps(validation_result))

            except Exception as e:
                # Catch any exceptions not caught inside validate_flight_data
                error_response = {"status": "error", "message": f"Application error during validation: {e}"}
                print(json.dumps(error_response))
                print(f"Application error: {e}", file=sys.stderr)
                sys.exit(1)

            finally:
                await client.cleanup()

        asyncio.run(run_validation())

    except json.JSONDecodeError:
        error_response = {"status": "error", "message": "Invalid JSON input received."}
        print(json.dumps(error_response))
        print("Error: Invalid JSON input received.", file=sys.stderr)
        sys.exit(1)
    except ValueError as ve:
        error_response = {"status": "error", "message": str(ve)}
        print(json.dumps(error_response))
        print(f"Error: {ve}", file=sys.stderr)
        sys.exit(1)
    except Exception as general_e:
        error_response = {"status": "error", "message": f"An unexpected error occurred: {general_e}"}
        print(json.dumps(error_response))
        print(f"An unexpected error occurred: {general_e}", file=sys.stderr)
        sys.exit(1)