import type { ReqParams } from "@/stores/reqParamsStore";
import type { SysConfig } from "@/sliderule/core"
export interface WebWorkerCmd {
    type: string; // 'run', 'abort' 
    req_id: number;
    sysConfig?: SysConfig;
    parameters?: ReqParams;
}

export type WorkerStatus = 'started' | 'progress' | 'summary' | 'success' | 'error' | 'server_msg' | 'aborted';

export interface WorkerError {
    type: string;
    code: string;
    message: string;
}

export interface SrProgress {
    read_state: string;
    target_numAtl06Recs: number;
    numAtl06Recs: number;
    target_numAtl06Exceptions: number;
    numAtl06Exceptions: number;
}

export interface WorkerMessage {
    req_id: number;             // Request ID
    status: WorkerStatus;       // Status of the worker
    progress?: SrProgress;          // Percentage for progress updates
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
