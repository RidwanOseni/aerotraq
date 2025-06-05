'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react"; // Import useState and useEffect for isClient pattern

// Define the structure for a DGIP log entry, matching the backend simulation output

interface DgipLogEntry {
  timestamp: string; // ISO string or similar
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
}

export function DgipSimulationDisplay({ displayLog, currentLogIndex, totalLogs, isSimulating }: DgipSimulationDisplayProps) {
  // New state to track if the component has mounted on the client [18]
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set isClient to true once the component mounts on the client [18]
    setIsClient(true);
  }, []);

  // On the server, render a stable placeholder [18]
  if (!isClient) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>DGIP Simulation</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading simulation data...</p>
        </CardContent>
      </Card>
    );
  }

  // Once mounted on the client, proceed with dynamic rendering logic [19]
  if (!displayLog) {
    if (isSimulating) {
      return (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>DGIP Simulation</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Starting simulation...</p>
          </CardContent>
        </Card>
      );
    }
    return null; // Don't render anything if no log is displayed and not simulating
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Simulated DGIP Log</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">Live simulation of drone telemetry.</p>
        <p>
          <span className="font-medium">Entry:</span> {currentLogIndex} / {totalLogs}
        </p>
        {/* toLocaleTimeString() is locale-dependent, but now only runs on the client [19] */}
        <p>
          <span className="font-medium">Timestamp:</span> {new Date(displayLog.timestamp).toLocaleTimeString()}
        </p>
        <p>
          <span className="font-medium">Location:</span> Lat {displayLog.latitude.toFixed(6)}, Lng {displayLog.longitude.toFixed(6)}
        </p>
        <p>
          <span className="font-medium">Altitude:</span> {displayLog.altitude.toFixed(1)} m
        </p>
        <p>
          <span className="font-medium">Speed:</span> {displayLog.speed.toFixed(1)} m/s
        </p>
        <p>
          <span className="font-medium">Heading:</span> {displayLog.heading.toFixed(0)}°
        </p>
        <p>
          <span className="font-medium">Battery:</span> {displayLog.battery.toFixed(0)}%
        </p>
        {isSimulating && totalLogs > 0 && currentLogIndex < totalLogs && (
          <p className="text-sm text-blue-500">
            Simulation in progress... ({currentLogIndex} / {totalLogs})
          </p>
        )}
        {!isSimulating && totalLogs > 0 && currentLogIndex === totalLogs && (
          <p className="text-sm text-green-500">
            Simulation complete.
          </p>
        )}
      </CardContent>
    </Card>
  );
}