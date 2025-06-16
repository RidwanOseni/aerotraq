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