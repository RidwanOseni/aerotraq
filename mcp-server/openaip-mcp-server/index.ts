import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, ZodRawShape } from "zod";
import dotenv from "dotenv";
import fetch from "node-fetch";
import process from "process";

// Load environment variables
dotenv.config();

// Retrieve OpenAIP API key
const OPENAIP_API_KEY = process.env.OPENAIP_API_KEY;

// Exit if API key is not set
if (!OPENAIP_API_KEY) {
  console.error("FATAL: OPENAIP_API_KEY environment variable is not set.");
  process.exit(1);
} else {
  console.error("OPENAIP_API_KEY successfully loaded.");
}

// Define constants
const OPENAIP_API_BASE = "https://api.core.openaip.net/api";
const USER_AGENT = "your-drone-registry-app/1.0 (Contact: your-email@example.com)";
const SERVER_NAME = "openaip-data-server";

// Initialize MCP server instance
const server = new McpServer({
    name: SERVER_NAME,
    version: "1.0.0"
});

// Define schemas
const GeoParamsSchema = z.object({
    northEast: z.object({
        latitude: z.number().describe("Northeast latitude."),
        longitude: z.number().describe("Northeast longitude."),
    }).describe("Northeast corner of the bounding box."),
    southWest: z.object({
        latitude: z.number().describe("Southwest latitude."),
        longitude: z.number().describe("Southwest longitude."),
    }).describe("Southwest corner of the bounding box."),
}).describe("Geographical bounding box filter defined by northeast and southwest corners.");

// Define flight coordinates schema
const FlightCoordinatesSchema = z.object({
    latitude: z.number().describe("Latitude of the flight position."),
    longitude: z.number().describe("Longitude of the flight position."),
    altitude: z.number().describe("Altitude of the flight in meters."),
    referenceDatum: z.number().describe("Altitude reference datum (0=AGL, 1=MSL)."),
});

// Helper function to call the OpenAIP API
async function callOpenAIPApi<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${OPENAIP_API_BASE}${endpoint}`);
    if (params) {
        Object.keys(params).forEach(key => {
            const value = params[key];
            if (key === 'geoFilter' && typeof value === 'object' && value !== null && value.northEast && value.southWest) {
                url.searchParams.append('ne_lat', value.northEast.latitude.toString());
                url.searchParams.append('ne_lon', value.northEast.longitude.toString());
                url.searchParams.append('sw_lat', value.southWest.latitude.toString());
                url.searchParams.append('sw_lon', value.southWest.longitude.toString());
            } else if (Array.isArray(value)) {
                if (value.length > 0) {
                    url.searchParams.append(key, value.join(','));
                }
            } else if (value !== undefined) {
                url.searchParams.append(key, value.toString());
            }
        });
    }

    try {
        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/json',
                'x-openaip-api-key': OPENAIP_API_KEY!
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            const errorMessage = `OpenAIP API returned status: ${response.status} ${response.statusText} - ${errorBody}`;
            console.error("API request failed:", errorMessage);
            throw new Error(errorMessage);
        }

        return await response.json() as T;
    } catch (error) {
        console.error("Error making OpenAIP API request:", error);
        throw error;
    }
}

// Helper function to create bounding box around coordinates
function createBoundingBox(lat: number, lon: number, radiusKm: number = 5) {
    const latChange = radiusKm / 111.32; // 1 degree of latitude is approximately 111.32 km
    const lonChange = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
    
    return {
        northEast: {
            latitude: lat + latChange,
            longitude: lon + lonChange
        },
        southWest: {
            latitude: lat - latChange,
            longitude: lon - lonChange
        }
    };
}

// Helper function to check if altitude is within limits
function isAltitudeWithinLimits(altitude: number, lowerLimit?: { value: number, unit: string }, upperLimit?: { value: number, unit: string }): boolean {
    if (!lowerLimit && !upperLimit) return true;
    
    const convertToMeters = (value: number, unit: string): number => {
        switch(unit.toLowerCase()) {
            case 'ft': return value * 0.3048;
            case 'm': return value;
            default: return value;
        }
    };

    const lowerMeters = lowerLimit ? convertToMeters(lowerLimit.value, lowerLimit.unit) : -Infinity;
    const upperMeters = upperLimit ? convertToMeters(upperLimit.value, upperLimit.unit) : Infinity;

    return altitude >= lowerMeters && altitude <= upperMeters;
}

// Define interfaces
interface OpenAIPResponse<T> {
    items: T[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    nextPage: number;
}

interface Airport {
    id: string;
    name: string;
    type: number;
    icaoCode?: string;
    iataCode?: string;
    elevation?: { value: number, unit: number };
    geometry?: { type: string, coordinates: number[] };
}

interface Airspace {
    id: string;
    name: string;
    type: number;
    dimensions?: { upperLimit?: { value: number, unit: string }, lowerLimit?: { value: number, unit: string } };
}

interface Obstacle {
    id: string;
    name: string;
    type: number;
    elevation?: { value: number, unit: number };
}

interface RCAirfield {
    id: string;
    name: string;
    country: string;
    geometry?: { type: string, coordinates: number[] };
    elevation?: { value: number, unit: number };
    combustion?: boolean;
    electric?: boolean;
    turbine?: boolean;
    permittedAltitude?: { value: number, unit: number, referenceDatum: number };
}

interface RCAirfieldAirspace {
    id: string;
    name: string;
    country: string;
    dimensions?: { upperLimit?: { value: number, unit: string }, lowerLimit?: { value: number, unit: string } };
}

// Add the validate-nfz tool
server.tool(
    "validate-nfz",
    "Validates flight coordinates and altitude against OpenAIP data for NFZ validation.",
    {
        coordinates: FlightCoordinatesSchema.describe("Flight coordinates and altitude to validate."),
        searchRadius: z.number().optional().describe("Search radius in kilometers (default: 5km)."),
    },
    async (args) => {
        console.error("Received request for validate-nfz tool with args:", args);
        try {
            const { latitude, longitude, altitude, referenceDatum } = args.coordinates;
            const searchRadius = args.searchRadius || 5;
            
            // Create bounding box for airspace search
            const boundingBox = createBoundingBox(latitude, longitude, searchRadius);
            
            // Query relevant data
            const [airspaces, obstacles] = await Promise.all([
                callOpenAIPApi<OpenAIPResponse<Airspace>>('/airspaces', { geoFilter: boundingBox }),
                callOpenAIPApi<OpenAIPResponse<Obstacle>>('/obstacles', { 
                    pos: `${latitude},${longitude}`,
                    dist: searchRadius * 1000 // Convert km to meters
                })
            ]);

            // Validate against airspaces
            const conflictingAirspaces = airspaces.items.filter(airspace => {
                if (!airspace.dimensions) return false;
                return !isAltitudeWithinLimits(altitude, airspace.dimensions.lowerLimit, airspace.dimensions.upperLimit);
            });

            // Validate against obstacles
            const nearbyObstacles = obstacles.items.filter(obstacle => {
                if (!obstacle.elevation) return false;
                const obstacleElevation = obstacle.elevation.unit === 0 ? obstacle.elevation.value * 0.3048 : obstacle.elevation.value;
                return obstacleElevation >= altitude;
            });

            // Format results
            const results = {
                isValid: conflictingAirspaces.length === 0 && nearbyObstacles.length === 0,
                conflicts: {
                    airspaces: conflictingAirspaces.map(airspace => ({
                        id: airspace.id,
                        name: airspace.name,
                        type: airspace.type,
                        limits: {
                            lower: airspace.dimensions?.lowerLimit,
                            upper: airspace.dimensions?.upperLimit
                        }
                    })),
                    obstacles: nearbyObstacles.map(obstacle => ({
                        id: obstacle.id,
                        name: obstacle.name,
                        type: obstacle.type,
                        elevation: obstacle.elevation
                    }))
                }
            };

            // Format response message
            let message = `NFZ Validation Results for coordinates (${latitude}, ${longitude}) at ${altitude}m ${referenceDatum === 0 ? 'AGL' : 'MSL'}:\n\n`;
            
            if (results.isValid) {
                message += "✅ Flight path is valid - No conflicts found.\n";
            } else {
                message += "❌ Flight path has conflicts:\n\n";
                
                if (results.conflicts.airspaces.length > 0) {
                    message += "Conflicting Airspaces:\n";
                    results.conflicts.airspaces.forEach(airspace => {
                        message += `- ${airspace.name} (Type: ${airspace.type})\n`;
                        if (airspace.limits.lower) {
                            message += `  Lower Limit: ${airspace.limits.lower.value} ${airspace.limits.lower.unit}\n`;
                        }
                        if (airspace.limits.upper) {
                            message += `  Upper Limit: ${airspace.limits.upper.value} ${airspace.limits.upper.unit}\n`;
                        }
                    });
                }

                if (results.conflicts.obstacles.length > 0) { [13]
                  message += "\nNearby Obstacles:\n"; [13]
                  results.conflicts.obstacles.forEach(obstacle => { [13]
                      // Check if elevation is defined before accessing its properties
                      const elevation = obstacle.elevation?.value !== undefined ?
                          `${obstacle.elevation.value} ${obstacle.elevation.unit === 0 ? 'ft' : obstacle.elevation.unit === 1 ? 'm' : 'Unknown Unit'}` : // Correctly handle unit mapping
                          'N/A'; // Provide a default if elevation is missing
                      message += `- ${obstacle.name} (Elevation: ${elevation})\n`; [13]
                  });
              }
            }

            return {
                content: [{ type: "text", text: message }]
            };
        } catch (error: any) {
            console.error("Error in validate-nfz tool handler:", error);
            return {
                content: [{ type: "text", text: `Error validating NFZ: ${error.message}` }],
                isError: true
            };
        }
    }
);

// Main execution logic
async function main() {
    const transport = new StdioServerTransport();

    transport.onclose = (err?: Error) => {
        if (err) {
            console.error("Transport closed with error:", err);
            process.exit(1);
        } else {
            console.log("Transport closed gracefully.");
            process.exit(0);
        }
    };

    console.log("Starting OpenAIP MCP server...");
    try {
        await server.connect(transport);
        console.log(`OpenAIP MCP server "${SERVER_NAME}" connected and ready.`);
    } catch (error) {
        console.error("Failed to connect server transport:", error);
        process.exit(1);
    }
}

// Run the main async function
main().catch(console.error);