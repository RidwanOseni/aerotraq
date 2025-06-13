'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import dynamic from 'next/dynamic';

// Dynamically import MapContainer, TileLayer, Polyline, Marker
// This resolves the module import issue by ensuring these components are loaded client-side only.
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });

import L from 'leaflet';

// Import Leaflet's CSS for basic map styling
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons not showing up in Leaflet when bundled
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
});

// Define the structure for a DGIP log entry, matching the backend simulation output
interface DgipLogEntry {
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  battery: number;
}

interface DgipSimulationDisplayProps {
  displayLog: DgipLogEntry | null;
  currentLogIndex: number;
  totalLogs: number;
  isSimulating: boolean;
  simulatedDgip: DgipLogEntry[];
}

export function DgipSimulationDisplay({ displayLog, currentLogIndex, totalLogs, isSimulating, simulatedDgip }: DgipSimulationDisplayProps) {
  if (!displayLog) {
    if (isSimulating) {
      return (
        <Card className="w-full mt-4">
          <CardHeader>
            <CardTitle>DGIP Simulation</CardTitle>
            <CardDescription>Starting simulation...</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Optionally add a loader here */}
          </CardContent>
        </Card>
      );
    }
    return null; // Don't render anything if no log is displayed and not simulating
  }

  // Convert simulatedDgip into an array of LatLng tuples for Polyline
  const pathPositions = simulatedDgip.map(log => [log.latitude, log.longitude] as [number, number]);

  return (
    <Card className="w-full mt-4">
      <CardHeader>
        <CardTitle>Simulated DGIP Log</CardTitle>
        <CardDescription>Live simulation of drone telemetry.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Text display (existing) */}
        <p>Entry: {currentLogIndex} / {totalLogs}</p>
        <p>Timestamp: {new Date(displayLog.timestamp).toLocaleTimeString()}</p>
        <p>Location: Lat {displayLog.latitude.toFixed(6)}, Lng {displayLog.longitude.toFixed(6)}</p>
        <p>Altitude: {displayLog.altitude.toFixed(1)} m</p>
        <p>Speed: {displayLog.speed.toFixed(1)} m/s</p>
        <p>Heading: {displayLog.heading.toFixed(0)}°</p>
        <p>Battery: {displayLog.battery.toFixed(0)}%</p>

        {isSimulating && totalLogs > 0 && currentLogIndex < totalLogs && (
          <Alert className="mt-4">
            <AlertTitle>Simulation in progress...</AlertTitle>
            <AlertDescription>
              ({currentLogIndex} / {totalLogs})
            </AlertDescription>
          </Alert>
        )}

        {!isSimulating && totalLogs > 0 && currentLogIndex === totalLogs && (
          <Alert className="mt-4">
            <AlertTitle>Simulation complete.</AlertTitle>
            <AlertDescription>
              The full DGIP log has been generated.
            </AlertDescription>
          </Alert>
        )}

        {/* Map display */}
        {/* Set a fixed height for the map container for the MapContainer to correctly render */}
        <div style={{ height: '400px', width: '100%', marginTop: '20px' }}>
          <MapContainer
            center={[displayLog.latitude, displayLog.longitude]}
            zoom={15}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='© OpenStreetMap <https://www.openstreetmap.org/copyright> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Render the full flight path */}
            {pathPositions.length > 0 && (
              <Polyline positions={pathPositions} color="blue" />
            )}

            {/* Render the current drone position as a marker */}
            <Marker position={[displayLog.latitude, displayLog.longitude]} />
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}