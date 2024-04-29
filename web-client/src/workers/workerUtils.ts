

export interface WorkerError {
    type: string;
    code: string;
    message: string;
}

export interface WorkerSummary {
    extLatLon: ExtLatLon;
    extHMean: ExtHMean;
}


export interface ExtLatLon {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

export interface ExtHMean {
    minHMean: number;
    maxHMean: number;
    lowHMean: number;   // 5th percentile
    highHMean: number;  // 95th percentile
}

export type WorkerStatus = 'started' | 'progress' | 'summary' | 'success' | 'error' | 'server_msg';

export interface WorkerMessage {
    status: WorkerStatus;
    summary?: WorkerSummary; // Summary of the worker's work 
    progress?: number;       // Percentage for progress updates
    msg?: string;            // status details
    error?: WorkerError;     // Error details (if an error occurred)
}

