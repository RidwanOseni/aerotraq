import sys
import json
import asyncio
import aioipfs
from eth_hash.auto import keccak

async def process_dgip_data(dgip_log_data: list):
    """
    Serializes, hashes, and uploads DGIP log data to IPFS.
    """
    if not dgip_log_data:
        return None, None, "No DGIP log data received."

    # Serialize the list of log entries consistently
    # sort_keys=True ensures deterministic serialization for consistent hashing
    try:
        # The flightPathAsset.json example wraps waypoints in a 'generated_path' object
        # Let's simulate that structure for better resemblance to potential final asset metadata
        serialized_data_obj = {
            "generated_path": {
                "waypoints": dgip_log_data # Use the received log array as waypoints
            }
        }
        serialized_data_string = json.dumps(serialized_data_obj, sort_keys=True, separators=(',', ':'))
    except Exception as e:
        return None, None, f"Error serializing DGIP data: {e}"

    # Calculate Keccak256 hash of the serialized data
    try:
        dgip_data_hash_bytes = keccak(serialized_data_string.encode('utf-8'))
        dgip_data_hash_hex = dgip_data_hash_bytes.hex()
    except Exception as e:
        return None, None, f"Error calculating DGIP data hash: {e}"

    # Upload to IPFS
    ipfs_cid = None
    try:
        async with aioipfs.AsyncIPFS() as ipfs_client:
            ipfs_add_result = await ipfs_client.core.add_bytes(serialized_data_string.encode('utf-8'))
            ipfs_cid = ipfs_add_result['Hash']
    except Exception as e:
        # It's okay to proceed if IPFS upload fails for the MVP, but report the error
        sys.stderr.write(f"Warning: Failed to upload DGIP data to IPFS: {e}\n")
        ipfs_cid = None # Ensure ipfs_cid is None on failure

    return dgip_data_hash_hex, ipfs_cid, None

async def main():
    """Main entry point for the script."""
    try:
        input_json = sys.stdin.read()
        if not input_json:
            raise ValueError("No input JSON received.")

        dgip_log_data = json.loads(input_json)
        if not isinstance(dgip_log_data, list):
             raise ValueError("Input must be a JSON array of DGIP logs.")

        dgip_data_hash, ipfs_cid, error = await process_dgip_data(dgip_log_data)

        result = {
            "dgipDataHash": dgip_data_hash,
            "ipfsCid": ipfs_cid,
            "error": error
        }
        print(json.dumps(result)) # Output result as JSON to stdout

    except json.JSONDecodeError:
        sys.stderr.write("Error: Invalid JSON input received.\n")
        print(json.dumps({"dgipDataHash": None, "ipfsCid": None, "error": "Invalid JSON input received."}))
        sys.exit(1)
    except ValueError as ve:
        sys.stderr.write(f"Error: {ve}\n")
        print(json.dumps({"dgipDataHash": None, "ipfsCid": None, "error": str(ve)}))
        sys.exit(1)
    except Exception as general_e:
        sys.stderr.write(f"An unexpected error occurred: {general_e}\n")
        print(json.dumps({"dgipDataHash": None, "ipfsCid": None, "error": f"An unexpected error occurred: {general_e}"}))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())