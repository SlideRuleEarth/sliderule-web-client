export type WorkerStatus = 'started' | 'progress' | 'summary' | 'success' | 'error' | 'server_msg';

export interface WorkerError {
    type: string;
    code: string;
    message: string;
}

export interface WorkerMessage {
    req_id: number;             // Request ID
    status: WorkerStatus;       // Status of the worker
    progress?: number;          // Percentage for progress updates
    msg?: string;               // status details
    error?: WorkerError;        // Error details (if an error occurred)
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


export interface WorkerSummary extends WorkerMessage {
    extLatLon: ExtLatLon;
    extHMean: ExtHMean;
}
