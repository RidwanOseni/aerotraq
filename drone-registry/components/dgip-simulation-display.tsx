'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Define the structure for a DGIP log entry, matching the backend simulation output
export interface DgipLogEntry {
    timestamp: string;
    latitude: number;
    longitude: number;
    altitude: number;
    speed: number;
    heading: number;
    battery: number;
}

export interface DgipSimulationDisplayProps {
    displayLog: DgipLogEntry | null;
    currentLogIndex: number;
    totalLogs: number;
    isSimulating: boolean;
    simulatedDgip: DgipLogEntry[];
}
  
// Correctly type the React Functional Component to accept its defined props
const DgipSimulationDisplay: React.FC<DgipSimulationDisplayProps> = ({
    displayLog,
    currentLogIndex,
    totalLogs,
    isSimulating,
    simulatedDgip
}) => {
    if (!displayLog) {
        if (isSimulating) {
            return (
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>DGIP Simulation</CardTitle>
                        <CardDescription>Starting simulation...</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    </CardContent>
                </Card>
            );
        }
        return null;
    }

    return (
        <Card className="w-full h-full">
            <CardHeader>
                <CardTitle>Simulated DGIP Log</CardTitle>
                <CardDescription>Live simulation of drone telemetry.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 h-[calc(100%-120px)]">
                <p className="text-sm font-medium">
                    *Entry:* <span className="font-normal">{currentLogIndex} / {totalLogs}</span>
                </p>
                <p className="text-sm font-medium">
                    *Timestamp:* <span className="font-normal">{new Date(displayLog.timestamp).toLocaleTimeString()}</span>
                </p>
                <p className="text-sm font-medium">
                    *Location:* <span className="font-normal">Lat {displayLog.latitude.toFixed(6)}, Lng {displayLog.longitude.toFixed(6)}</span>
                </p>
                <p className="text-sm font-medium">
                    *Altitude:* <span className="font-normal">{displayLog.altitude.toFixed(1)} m</span>
                </p>
                <p className="text-sm font-medium">
                    *Speed:* <span className="font-normal">{displayLog.speed.toFixed(1)} m/s</span>
                </p>
                <p className="text-sm font-medium">
                    *Heading:* <span className="font-normal">{displayLog.heading.toFixed(0)}°</span>
                </p>
                <p className="text-sm font-medium">
                    *Battery:* <span className="font-normal">{displayLog.battery.toFixed(0)}%</span>
                </p>

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
            </CardContent>
        </Card>
    );
};

export default DgipSimulationDisplay;