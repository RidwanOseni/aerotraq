import json
import math
import datetime
import time
import sys

# Define the target number of simulated points
TARGET_NUM_POINTS = 10

def generate_dgip_data(center_lat, center_lng, radius_meters, start_time_iso, end_time_iso):
    """
    Generates simulated DGIP data for a flight path with a fixed number of points.

    Args:
        center_lat (float): Latitude of the center of the flight area.
        center_lng (float): Longitude of the center of the flight area.
        radius_meters (float): Radius of the flight area in meters.
        start_time_iso (str): ISO 8601 string for the flight start time.
        end_time_iso (str): ISO 8601 string for the flight end time.

    Returns:
        list: A list of dictionaries, where each dictionary is a DGIP log entry.
    """
    try:
        # Parse start and end times
        start_dt = datetime.datetime.fromisoformat(start_time_iso)
        end_dt = datetime.datetime.fromisoformat(end_time_iso)

        # Calculate total duration of the flight
        duration_seconds = (end_dt - start_dt).total_seconds()

        # Handle cases where duration is zero or negative
        if duration_seconds <= 0:
            print("Error: End time must be after start time for simulation.", file=sys.stderr)
            # Optionally return one point at start if duration is exactly zero
            if duration_seconds == 0:
                simulated_lat = center_lat
                simulated_lng = center_lng # Simple case for 0 duration
                # Mock other telemetry for a single point
                simulated_alt = 0 # On the ground
                simulated_speed = 0
                simulated_heading = 0
                simulated_battery = 100
                return [{
                    "timestamp": start_dt.isoformat(),
                    "latitude": round(simulated_lat, 6),
                    "longitude": round(simulated_lng, 6),
                    "altitude": round(simulated_alt, 2),
                    "speed": round(simulated_speed, 2),
                    "heading": round(simulated_heading, 2),
                    "battery": round(simulated_battery, 2)
                }]
            return [] # Return empty list if end time is before start time

        # Use the fixed target number of points
        num_points_to_generate = TARGET_NUM_POINTS

        # Calculate the time interval needed to get the target number of points over the duration
        # Avoid division by zero if only one point is requested (though TARGET_NUM_POINTS is fixed at 10)
        simulated_interval_seconds = duration_seconds / (num_points_to_generate - 1) if num_points_to_generate > 1 else 0

        # Convert radius from meters to degrees (approximate conversion for simulation)
        radius_degrees = radius_meters / 111000.0

        dgip_log = []

        # Simulate points
        for i in range(num_points_to_generate):
            # Calculate the current time based on the fixed interval and start time
            current_time = start_dt + datetime.timedelta(seconds=i * simulated_interval_seconds)
            # Ensure the last point is exactly at the end time for precision
            if i == num_points_to_generate - 1:
                 current_time = end_dt

            # Calculate progress through the flight (from 0 to 1)
            # Avoid division by zero if only one point is generated
            progress = i / (num_points_to_generate - 1) if num_points_to_generate > 1 else 0

            # Simulate a circular path position based on progress
            angle = progress * 2 * math.pi # Angle from 0 to 2*pi

            # Calculate latitude and longitude offsets
            lat_offset = radius_degrees * math.cos(angle)
            # Adjust longitude offset based on latitude for better approximation
            lng_offset = radius_degrees * math.sin(angle) / math.cos(math.radians(center_lat))

            simulated_lat = center_lat + lat_offset
            simulated_lng = center_lng + lng_offset

            # Mock other telemetry data based on progress
            # Altitude can vary: ascend, maintain, descend
            if progress < 0.2:
                simulated_alt = 10 + (110 * progress / 0.2) # Ascend to ~120m
            elif progress < 0.8:
                simulated_alt = 120 + (10 * (math.sin((progress - 0.2) / 0.6 * math.pi))) # Vary between 120m and 130m (simplified)
                simulated_alt = min(simulated_alt, 120) # Cap at 120m based on schema requirements
            else:
                simulated_alt = 120 - (110 * (progress - 0.8) / 0.2) # Descend to ~10m

            simulated_alt = max(0, simulated_alt) # Ensure altitude is not negative

            # Mock speed (simplified: faster during mid-flight)
            simulated_speed = 15 + (math.sin(progress * math.pi) * 10) # Speed varies, maybe faster in middle
            simulated_speed = max(0, simulated_speed) # Ensure speed is not negative

            # Mock heading (based on movement around the circle, simplified tangential direction)
            # Calculate angle of the vector from the center to the point, then add 90 degrees for tangent (counter-clockwise)
            simulated_heading = math.degrees(math.atan2(lng_offset, lat_offset))
            simulated_heading = (simulated_heading + 90) % 360

            # Mock battery (decreases over time)
            simulated_battery = 95 - (progress * 80) # Decrease from 95% to 15%
            simulated_battery = max(0, simulated_battery) # Ensure battery is not negative or above 100

            dgip_log.append({
                "timestamp": current_time.isoformat(),
                "latitude": round(simulated_lat, 6),  # Round for cleaner output
                "longitude": round(simulated_lng, 6),
                "altitude": round(simulated_alt, 2),
                "speed": round(simulated_speed, 2),
                "heading": round(simulated_heading, 2),
                "battery": round(simulated_battery, 2)
            })

        return dgip_log

    except ValueError as e:
        print(f"Error parsing time or invalid parameters: {e}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"An unexpected error occurred during simulation: {e}", file=sys.stderr)
        return []

# Main execution block to run the script from stdin input
if __name__ == "__main__":
    print(f"Reading flight parameters from stdin (JSON format) for {TARGET_NUM_POINTS} simulation points...", file=sys.stderr)
    try:
        # Load flight parameters from standard input (sent by the Next.js API route)
        input_params = json.load(sys.stdin)

        # Extract required parameters from the input JSON
        center_lat = input_params['flightAreaCenter']['latitude']
        center_lng = input_params['flightAreaCenter']['longitude']
        radius_meters = input_params['flightAreaRadius']
        flight_date = input_params['flightDate'] # YYYY-MM-DD format expected from frontend
        start_time = input_params['startTime'] # HH:MM format expected
        end_time = input_params['endTime']   # HH:MM format expected

        # Combine date and time into ISO 8601 format for consistent datetime parsing
        start_time_iso = f"{flight_date}T{start_time}:00"
        end_time_iso = f"{flight_date}T{end_time}:00"

        # Generate the simulated data using the extracted parameters
        # The interval_seconds parameter is now ignored inside the function as we use a fixed point count
        simulated_data = generate_dgip_data(center_lat, center_lng, radius_meters, start_time_iso, end_time_iso)

        # Output the generated data as JSON to standard output (read by the Next.js API route)
        print(json.dumps(simulated_data, indent=2))

    except (json.JSONDecodeError, KeyError, ValueError) as e:
        # Handle errors during input reading or parsing
        print(f"Error reading or parsing input JSON from stdin: {e}", file=sys.stderr)
        # Print an error message and exit with a non-zero status code
        print(json.dumps({"error": f"Failed to parse input flight data: {e}"}), file=sys.stderr)
        sys.exit(1)
    except Exception as general_e:
        # Handle any other unexpected errors
        print(f"An unexpected error occurred: {general_e}", file=sys.stderr)
        print(json.dumps({"error": f"An unexpected error occurred during simulation: {general_e}"}), file=sys.stderr)
        sys.exit(1)