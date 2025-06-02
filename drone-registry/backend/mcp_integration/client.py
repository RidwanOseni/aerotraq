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

# Retrieve OpenAIP API key and server path from environment variables
# Using os.getenv() makes it work for everyone and is standard practice.
openaip_api_key = os.getenv("OPENAIP_API_KEY")
# Load OpenAIP server path from environment
openaip_server_path = os.getenv("OPENAIP_SERVER_PATH", "../mcp-server/openaip-mcp-server/build/index.js")

# Ensure required environment variables are set
if not openaip_api_key:
    print("Error: OPENAIP_API_KEY environment variable is not set.", file=sys.stderr)
    sys.exit(1)

if not openaip_server_path:
    print("Error: OPENAIP_SERVER_PATH environment variable is not set.", file=sys.stderr)
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

        # Initialize OpenAI client - it automatically reads OPENAI_API_KEY from env [11]
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

        print(f"Attempting to connect to OpenAIP MCP server at path: {openaip_server_path}", file=sys.stderr)

        server_env = os.environ.copy()
        server_env["OPENAIP_API_KEY"] = openaip_api_key

        # Determine the command based on file extension for cross-platform compatibility
        # This logic mirrors the MCP client setup in other SDKs [12-15]
        if openaip_server_path.endswith('.js'):
            command = 'node'
        elif openaip_server_path.endswith('.py'):
             # Use 'python3' for Linux/MacOS and 'python' for Windows as suggested in Kotlin SDK [14]
            command = 'python3' if sys.platform != 'win32' else 'python'
        elif openaip_server_path.endswith('.jar'):
             # Include '-jar' argument for Java servers as shown in Kotlin SDK [14]
            command = 'java'
            args = ['-jar', openaip_server_path]
        else:
            raise ValueError(f"Unsupported server script extension for path: {openaip_server_path}")

        # Configure server parameters for stdio_client
        # args list is constructed differently if command is 'java'
        if command != 'java':
             args = [openaip_server_path]


        server_params = StdioServerParameters(
            command=command, # The executable command
            args=args, # The arguments as a list
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

            # List tools available on the server to confirm connection and capabilities [12]
            try:
                response = await self.session.list_tools()
                print("Available tools on server:", file=sys.stderr)
                for tool in response.tools:
                    print(f" - {tool.name}: {tool.description}", file=sys.stderr)
            except Exception as e:
                print(f"Failed to list tools: {e}. The server might not support 'tools/list'.", file=sys.stderr)

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
            # The flightAreaCenter might come as a string "lat,lng" or an object {lat: ..., lng: ...}
            # Handle both possibilities from frontend/backend consistency issues
            flight_area_center = flight_data.get('flightAreaCenter')
            if isinstance(flight_area_center, str):
                lat_str, lon_str = flight_area_center.split(',')
                latitude = float(lat_str.strip())
                longitude = float(lon_str.strip())
            elif isinstance(flight_area_center, dict):
                 latitude = float(flight_area_center.get('latitude', 0))
                 longitude = float(flight_area_center.get('longitude', 0))
            else:
                raise ValueError("flightAreaCenter is not a valid string or object.")


            # Get altitude from flightAreaMaxHeight
            altitude = float(flight_data.get('flightAreaMaxHeight', 0))

            # Get search radius from flightAreaRadius (convert to km if needed)
            # The tool expects radius in kilometers [16]
            # The frontend uses meters [17]
            radius_meters = float(flight_data.get('flightAreaRadius', 0))
            search_radius_km = radius_meters / 1000.0 # Convert meters to kilometers

            # The validate-nfz tool schema description doesn't explicitly list referenceDatum [16]
            # but the example args include it with value 1 [18].
            # Let's include a default value for now.
            reference_datum = 1 # Assuming 1 corresponds to MSL (Mean Sea Level) or similar


            tool_args = {
                "coordinates": {
                    "latitude": latitude,
                    "longitude": longitude,
                    "altitude": altitude,
                    "referenceDatum": reference_datum
                },
                "searchRadius": round(search_radius_km, 3) # Round search radius for consistency
            }

            return tool_args

        except (ValueError, AttributeError) as e:
            print(f"Error transforming flight data: {e}", file=sys.stderr)
            raise ValueError(f"Invalid flight data format for transformation: {e}")


    def _extract_serializable_content(self, result: Any) -> Union[str, dict, list]:
        """
        Extract serializable content from MCP server response.
        Handles CallToolResult and its content types properly.
        """
        # Assuming 'result' is a CallToolResult object as per MCP SDK structure [18]
        if hasattr(result, 'content') and isinstance(result.content, list):
            # Concatenate text content from list items
            text_content = []
            for item in result.content:
                if hasattr(item, 'type') and item.type == 'text' and hasattr(item, 'text'):
                    text_content.append(item.text)
                # Add handling for other content types if necessary in the future
            return "\n".join(text_content)
        elif isinstance(result, str):
            # If the result is already a string (e.g., a simple error message from MCP)
            return result
        else:
             # Fallback for other unexpected result types
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
            # Return specific error if connection failed after attempt
            return {"error": "Could not connect to MCP server after attempt."}


        try:
            # Transform the flight data into the format expected by the tool
            tool_args = self._transform_flight_data(flight_data)
            print(f"Calling tool 'validate-nfz' with args: {tool_args}", file=sys.stderr)

            # Call the tool asynchronously
            result = await self.session.call_tool("validate-nfz", tool_args)
            print(f"Tool call result received: {result}", file=sys.stderr)

            # Extract serializable content from the result
            serializable_result = self._extract_serializable_content(result)

            # MCP tool status 'error' indicates a tool-specific execution error [18]
            is_error = getattr(result, 'isError', False) # Assume False if attribute missing
            if is_error:
                 # If the tool execution itself returned an error flag
                 return {"status": "tool_error", "message": serializable_result}
            else:
                 # If the tool executed successfully, return the result content
                 return {"status": "success", "validationResult": serializable_result}


        except Exception as e:
            print(f"Error calling tool 'validate-nfz': {e}", file=sys.stderr)
            # Catch exceptions during the tool call itself (e.g., transport issues, server errors)
            return {"status": "communication_error", "message": f"Error communicating with MCP server tool: {e}"}


    async def cleanup(self):
        """
        Clean up resources, including closing the MCP session and the server process.
        """
        print("Performing MCP client cleanup...", file=sys.stderr)
        # The exit_stack will handle closing the session and transport [19]
        await self.exit_stack.aclose()
        self.session = None
        self.stdio = None
        self.write = None
        print("MCP client cleanup complete.", file=sys.stderr)


# The __main__ block logic remains the same, handling stdin/stdout for the API route [20]
# and calling the main async function from the FlightDataValidator class.
# The OpenAIPClientIntegration is initialized and used within FlightDataValidator.

if __name__ == "__main__":
    # The Next.js API route expects the Python script to be run via `spawn` [6]
    # and communicate via stdin/stdout [6].
    # The __main__ block should handle reading from stdin, running the async main function,
    # and printing the final JSON result to stdout.

    # Async entry point
    # The FlightDataValidator class now initializes the OpenAIPClientIntegration internally [9]
    asyncio.run(FlightDataValidator().main())