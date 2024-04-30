import { type WorkerSummary } from '@/db/SlideRuleDb';

export interface WorkerError {
    type: string;
    code: string;
    message: string;
}

export type WorkerStatus = 'started' | 'progress' | 'summary' | 'success' | 'error' | 'server_msg';

export interface WorkerMessage {
    req_id: number;             // Request ID
    status: WorkerStatus;       // Status of the worker
    summary?: WorkerSummary;    // Summary of the worker's work 
    progress?: number;          // Percentage for progress updates
    msg?: string;               // status details
    error?: WorkerError;        // Error details (if an error occurred)
}

