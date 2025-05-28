'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    if (!displayLog) {
        if (isSimulating) {
             return (
                <Card className="w-full mt-4">
                    <CardHeader>
                        <CardTitle className="text-lg">DGIP Simulation</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <p className="text-muted-foreground">Starting simulation...</p>
                         {/* Optionally add a loader here */}
                    </CardContent>
                 </Card>
             );
        }
        return null; // Don't render anything if no log is displayed and not simulating
    }

    return (
        <Card className="w-full mt-4">
            <CardHeader>
                <CardTitle className="text-lg">Simulated DGIP Log</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
                <p className="text-muted-foreground">Live simulation of drone telemetry.</p>
                <p><strong>Entry:</strong> {currentLogIndex} / {totalLogs}</p>
                <p><strong>Timestamp:</strong> {new Date(displayLog.timestamp).toLocaleTimeString()}</p>
                <p><strong>Location:</strong> Lat {displayLog.latitude.toFixed(6)}, Lng {displayLog.longitude.toFixed(6)}</p>
                <p><strong>Altitude:</strong> {displayLog.altitude.toFixed(1)} m</p>
                <p><strong>Speed:</strong> {displayLog.speed.toFixed(1)} m/s</p>
                <p><strong>Heading:</strong> {displayLog.heading.toFixed(0)}°</p>
                <p><strong>Battery:</strong> {displayLog.battery.toFixed(0)}%</p>
            </CardContent>
            {isSimulating && totalLogs > 0 && currentLogIndex < totalLogs && (
                 <div className="px-6 pb-4 text-sm text-muted-foreground">
                    Simulation in progress... ({currentLogIndex} / {totalLogs})
                 </div>
            )}
             {!isSimulating && totalLogs > 0 && currentLogIndex === totalLogs && (
                 <div className="px-6 pb-4 text-sm text-green-600">
                    Simulation complete.
                 </div>
             )}
        </Card>
    );
}