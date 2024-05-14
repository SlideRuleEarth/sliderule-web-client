import type { ReqParams } from "@/stores/reqParamsStore";
import type { SysConfig } from "@/sliderule/core"
import { db } from "@/db/SlideRuleDb";
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

let num_checks = 0;

export function checkDoneProcessing(reqID:number, 
                                    read_state:string, 
                                    num_atl06Exceptions:number, 
                                    num_atl06recs_processed:number, 
                                    runningCount:number, 
                                    bulkAddPromises: Promise<void>[],
                                    localExtLatLon: ExtLatLon,
                                    localExtHMean: ExtHMean,
                                    target_numAtl06Recs:number,
                                    target_numAtl06Exceptions:number) {
    num_checks++;
    if((read_state === 'done_reading') || (read_state === 'error')){
        if((num_atl06recs_processed >= target_numAtl06Recs) && (num_atl06Exceptions >= target_numAtl06Exceptions)){
            let status_details = 'No data returned from SlideRule.';
            if(target_numAtl06Recs > 0) {
                status_details = `Received ${target_numAtl06Recs} records and Processed ${num_atl06recs_processed} records`;
            }
            console.log('atl06p Success:', status_details, 'req_id:', reqID, 'runningCount:', runningCount, 'num_checks:', num_checks, 'num promises:', bulkAddPromises.length);
            if(bulkAddPromises.length > 0){
                Promise.all(bulkAddPromises).then(() => {
                    sendSummaryMsg({req_id:reqID, status:'summary', extLatLon: localExtLatLon, extHMean: localExtHMean }, status_details);
                    sendSuccessMsg(reqID, `Successfully finished reading req_id: ${reqID} with ${runningCount} points.`);
                }).catch((error) => {
                    console.error('Failed to complete bulk add promises:', error);
                    sendErrorMsg(reqID, { type: 'BulkAddError', code: 'BulkAdd', message: 'Bulk add failed' });
                });
            } else {
                console.log('No bulk add promises to process?');
                sendSummaryMsg({req_id:reqID, status:'summary', extLatLon: localExtLatLon, extHMean: localExtHMean }, status_details);
                sendSuccessMsg(reqID, `Successfully finished reading req_id: ${reqID} with ${runningCount} points.`);
                //sendErrorMsg(reqID, { type: 'BulkAddError', code: 'BulkAdd', message: 'No bulk add promises to process' });
            }
        }
        read_state = 'done';
    }
}

export async function sendStartedMsg(req_id:number,req_params:ReqParams) {
    const workerStartedMsg: WorkerMessage =  { req_id:req_id, status: 'started', msg:`Starting req_id: ${req_id}`};
    try{
        num_checks = 0;
        // initialize request record in db
        await db.updateRequestRecord( {req_id:req_id,status:workerStartedMsg.status,func:'atl06p', parameters:req_params,status_details: workerStartedMsg.msg, start_time: new Date(), end_time: new Date(), elapsed_time: ''});
    } catch (error) {
        console.error('Failed to update request status to started:', error, ' for req_id:', req_id);
    }
    try{
        postMessage(workerStartedMsg);
    } catch (error) {
        console.error('Failed to postMessage for workerStarted:', error, ' for req_id:', req_id);
    }
}

export async function sendAbortedMsg(req_id:number, msg: string) {
    const workerAbortedMsg: WorkerMessage =  { req_id:req_id, status: 'aborted', msg:`Aborting req_id: ${req_id}`};
    try{
        // initialize request record in db
        await db.updateRequestRecord( {req_id:req_id, status: 'aborted',status_details: msg});
    } catch (error) {
        console.error('Failed to update request status to aborted:', error, ' for req_id:', req_id);
    }
    try{
        postMessage(workerAbortedMsg);
    } catch (error) {
        console.error('Failed to postMessage for sendAbortedMsg:', error, ' for req_id:', req_id);
    }
}

export async function sendProgressMsg(  req_id:number, 
                                        progress:SrProgress, 
                                        msg: string,
                                        localExtLatLon: ExtLatLon,
                                        localExtHMean: ExtHMean) {
    const workerProgressMsg: WorkerSummary =  { req_id:req_id, status: 'progress', progress:progress,extLatLon: localExtLatLon, extHMean: localExtHMean, msg:msg };
    try{
        postMessage(workerProgressMsg);
    } catch (error) {
        console.error('Failed to postMessage for workerProgress:', error, ' for req_id:', req_id);
    }
    console.log(msg)
    //console.log('sendProgressMsg  num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
}

export async function sendServerMsg(req_id:number,  msg: string) {
    const workerServerMsg: WorkerMessage =  { req_id:req_id, status: 'server_msg', msg:msg };
    try{
        await db.updateRequestRecord( {req_id:req_id, status: 'server_msg',status_details: msg});
    } catch (error) {
        console.error('Failed to update request status to server_msg:', error, ' for req_id:', req_id);
    }
    try{
        postMessage(workerServerMsg);
    } catch (error) {
        console.error('Failed to postMessage for workerServer:', error, ' for req_id:', req_id);
    }
}

export async function sendErrorMsg(req_id:number=0, workerError: WorkerError) {
    const workerErrorMsg: WorkerMessage = { req_id:req_id, status: 'error', error: workerError };
    if(req_id > 0) {
        try{
            await db.updateRequestRecord( {req_id:req_id, status: 'error',status_details: workerError.message});
        } catch (error) {
            console.error('Failed to update request status to error:', error, ' for req_id:', req_id);
        }
    } else {
        console.error('req_id was not provided for sendErrorMsg');
    }
    try{
        postMessage(workerErrorMsg);
    } catch (error) {
        console.error('Failed to postMessage for workerError:', error, ' for req_id:', req_id);
    }
}

export function updateExtremes( curFlatRecs: { h_mean: number,latitude: number, longitude:number }[],
                                localExtLatLon: ExtLatLon,
                                localExtHMean: ExtHMean) {

    curFlatRecs.forEach(rec => {
        if (rec.h_mean < localExtHMean.minHMean) {
            localExtHMean.minHMean = rec.h_mean;
        }
        if (rec.h_mean > localExtHMean.maxHMean) {
            localExtHMean.maxHMean = rec.h_mean;
        }
        if (rec.latitude < localExtLatLon.minLat) {
            localExtLatLon.minLat = rec.latitude;
        }
        if (rec.latitude > localExtLatLon.maxLat) {
            localExtLatLon.maxLat = rec.latitude;
        }
        if (rec.longitude < localExtLatLon.minLon) {
            localExtLatLon.minLon = rec.longitude;
        }
        if (rec.longitude > localExtLatLon.maxLon) {
            localExtLatLon.maxLon = rec.longitude;
        }
    });
}

async function sendSuccessMsg(req_id:number, msg:string) {
    const workerSuccessMsg: WorkerMessage = { req_id:req_id, status: 'success', msg:msg };
    try{
        await db.updateRequestRecord( {req_id:req_id, status: 'success',status_details: msg});
    } catch (error) {
        console.error('Failed to update request status to success:', error, ' for req_id:', req_id);
    }
    try{
        postMessage(workerSuccessMsg);
    } catch (error) {
        console.error('Failed to postMessage for workerSuccess:', error, ' for req_id:', req_id);
    }
}

async function sendSummaryMsg(workerSummaryMsg:WorkerSummary, msg: string) {
    try{
        await db.updateRequestRecord( {req_id:workerSummaryMsg.req_id, status: 'summary',status_details: msg});
        await db.updateSummary(workerSummaryMsg.req_id, workerSummaryMsg);
    } catch (error) {
        console.error('Failed to update request status to summary:', error, ' for req_id:', workerSummaryMsg.req_id);
    }
    try{
        postMessage(workerSummaryMsg);
    } catch (error) {
        console.error('Failed to postMessage for workerSummary:', error, ' for req_id:', workerSummaryMsg.req_id);
    }
}
