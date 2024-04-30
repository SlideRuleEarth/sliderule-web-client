import { type WorkerMessage } from './taskQueue';

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
