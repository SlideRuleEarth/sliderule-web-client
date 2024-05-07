import { db } from "@/db/SlideRuleDb";
import { type Elevation } from '@/db/SlideRuleDb';
import { atl06p } from '@/sliderule/icesat2.js';
import { type Atl06pReqParams } from '@/sliderule/icesat2';
import { type WebWorkerCmd, type WorkerError, type WorkerMessage } from '@/workers/workerUtils';
import { type ExtLatLon, type ExtHMean, type WorkerSummary } from '@/workers/workerUtils';
import type { ReqParams } from "@/stores/reqParamsStore";
import Dexie from 'dexie';
import { REC_VERSION, set_recordDefinitions, get_num_defs_fetched, get_recordDefinitions, get_num_defs_rd_from_cache, type Sr_Results_type} from '@/sliderule/core';


const localExtLatLon = {minLat: 90, maxLat: -90, minLon: 180, maxLon: -180} as ExtLatLon;
const localExtHMean = {minHMean: 100000, maxHMean: -100000, lowHMean: 100000, highHMean: -100000} as ExtHMean;

let num_checks = 0;
let target_numAtl06Recs = 0;
let target_num_atl06Exceptions = 0;
function checkDoneProcessing(reqID:number, state:string, num_atl06Exceptions:number, num_atl06recs_processed:number, runningCount:number, bulkAddPromises: Promise<void>[]){
    num_checks++;
    if(state === 'done_reading'){
        if((num_atl06recs_processed >= target_numAtl06Recs) && (num_atl06Exceptions >= target_num_atl06Exceptions)){
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
                console.error('No bulk add promises to process?');
                sendErrorMsg(reqID, { type: 'BulkAddError', code: 'BulkAdd', message: 'No bulk add promises to process' });
            }
        }
    }

}

async function sendStartedMsg(req_id:number,req_params:ReqParams) {
    const workerStartedMsg: WorkerMessage =  { req_id:req_id, status: 'started', msg:`Starting req_id: ${req_id}`};
    try{
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

async function sendAbortedMsg(req_id:number, msg: string) {
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

async function sendProgressMsg(req_id:number, progress:number, msg: string) {
    const workerProgressMsg: WorkerMessage =  { req_id:req_id, status: 'progress', progress:progress, msg:msg };
    try{
        await db.updateRequestRecord( {req_id:req_id, status: 'progress',status_details: msg});
    } catch (error) {
        console.error('Failed to update request status to progress:', error, ' for req_id:', req_id);
    }
    try{
        postMessage(workerProgressMsg);
    } catch (error) {
        console.error('Failed to postMessage for workerProgress:', error, ' for req_id:', req_id);
    }
    console.log('sendProgressMsg  num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
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

async function sendServerMsg(req_id:number,  msg: string) {
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

async function sendErrorMsg(req_id:number=0, workerError: WorkerError) {
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

function updateExtremes(curFlatRecs: { h_mean: number,latitude: number, longitude:number }[]) {

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

onmessage = async (event) => {
    try{
        console.log('atl06ToDb worker received event:', event.data)
        //console.log('Starting with num_defs_fetched:',get_num_defs_fetched(),' recordDefinitions:',get_recordDefinitions());
        // const recordDefs = await db.getDefinitionsByVersion(REC_VERSION);
        // if(recordDefs.length === 0){
        //     console.error('No record definitions fetched');
        // } else if (recordDefs.length === 1) {
        //     console.log('Expected-->Single record definition fetched:', recordDefs[0].data);
        //     set_recordDefinitions(recordDefs[0].data);
        // } else {
        //     console.error('Unexpected size for recordDefs:', recordDefs);
        // }
        // console.log('Proceeding with num_defs_fetched:',get_num_defs_fetched(),' recordDefinitions:',get_recordDefinitions());

        let abortRequested = false;

        const cmd:WebWorkerCmd = JSON.parse(event.data);;
        const reqID = cmd.req_id;
        if(cmd.type === 'abort'){
            abortRequested = true;
            sendAbortedMsg(reqID, 'Processing aborted.');
            console.log('Abort requested for req_id:', reqID);
            return;
        }
        const req:ReqParams = cmd.parameters as ReqParams;
        console.log("atl06ToDb req: ", req);
        let num_atl06recs_processed = 0;
        let num_atl06Exceptions = 0;
        let read_result = {} as Sr_Results_type;
        let state = 'reading'
        let runningCount = 0;
        let progThreshold = 1;
        const progThresholdIncrement = 50000;
        const bulkAddPromises: Promise<void>[] = [];        
        if((reqID) && (reqID > 0)){
            sendStartedMsg(reqID,req);
            const callbacks = {
                atl06rec: async (result:any) => {
                    num_atl06recs_processed++;
                    if (abortRequested) {
                        console.log('Processing aborted.');
                        return; // Stop processing when abort is requested
                    }
                    if(num_atl06recs_processed === 0){
                        console.log('atl06p cb atl06rec result:', result);
                    }
                    const currentRecs = result["elevation"];
                    const curFlatRecs = currentRecs.flat();
                    if(curFlatRecs.length > 0) {
                        runningCount += curFlatRecs.length;
                        updateExtremes(curFlatRecs);
                        //console.log('bulkAddElevations:',curFlatRecs.length, 'runningCount:', runningCount);
                        try {
                            // Adding req_id to each record in curFlatRecs
                            const updatedFlatRecs: Elevation[] = curFlatRecs.map((rec: Elevation) => ({
                                ...rec,
                                req_id: reqID, 
                            }));
                            //console.log('flatRecs.length:', updatedFlatRecs.length, 'curFlatRecs:', updatedFlatRecs);
                            try {
                                const addPromise = db.elevations.bulkAdd(updatedFlatRecs);
                                bulkAddPromises.push(addPromise);
                            } catch (error) {
                                console.error('Error during bulk add preparation:', error);
                            }
                        } catch (error) {
                            console.error('Bulk add failed: ', error);
                            sendErrorMsg(reqID, { type: 'BulkAddError', code: 'BulkAdd', message: 'Bulk add failed' });
                        }

                        //await db.transaction('rw', db.elevations, async () => {
                        if(runningCount > progThreshold){
                            progThreshold = runningCount + progThresholdIncrement;
                            sendProgressMsg(reqID, runningCount,`Received ${runningCount} pnts in ${num_atl06recs_processed} records.`);
                            console.log('runningCount:', runningCount, ' num_atl06recs_processed:', num_atl06recs_processed, 'num_atl06Exceptions:', num_atl06Exceptions);
                        }
                    } else {
                        console.log('0 elevation records returned from SlideRule.');
                    } 
                    checkDoneProcessing(reqID, state, num_atl06Exceptions, num_atl06recs_processed, runningCount, bulkAddPromises);
                },
                exceptrec: (result:any) => {
                    num_atl06Exceptions++;
                    console.log('atl06p cb exceptrec result:', result);
                    switch(result.code){
                        case 0: // RTE_INFO
                        {
                            console.log('atl06p cb exceptrec result:', result.text);
                            sendServerMsg(reqID, `server msg: ${result.text}`);
                            break;
                        }
                        case -1: // RTE_ERROR
                        {
                            console.log('atl06p cb exceptrec result:', result.text);
                            console.error('atl06p cb exceptrec result:', result.text);
                            //sendErrorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: result.text });
                            break;
                        }
                        case -2: // RTE_TIMEOUT
                        {
                            console.error('atl06p cb exceptrec result:', result.text);
                            sendErrorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: result.text });
                            break;
                        }
                        case -3: // RTE_RESOURCE_DOES_NOT_EXIST
                        {
                            console.error('atl06p cb exceptrec result:', result.text);
                            sendErrorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: result.text });
                            break;
                        }
                        case -4: // RTE_EMPTY_SUBSET
                        {
                            console.error('atl06p cb exceptrec result:', result.text);
                            sendErrorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: result.text });
                            break;
                        }
                        case -5: // RTE_SIMPLIFY
                        {
                            console.error('atl06p cb exceptrec result:', result.text);
                            sendErrorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: result.text });
                            break;
                        }
                    }
                    console.log('runningCount:', runningCount, ' num_atl06recs_processed:', num_atl06recs_processed, 'num_atl06Exceptions:', num_atl06Exceptions);
                    checkDoneProcessing(reqID, state, num_atl06Exceptions, num_atl06recs_processed, runningCount, bulkAddPromises);
                    console.log('exceptrec  num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
                },
                eventrec: (result:any) => {
                    console.log('atl06p cb eventrec result (DEPRECATED):', result);
                    sendServerMsg(reqID, `server msg (DEPRECATED): ${result.attr}`);
                },
            }; // callbacks...
            if(reqID){       
                //console.log("atl06pParams:",cmd.parameters);
                if(cmd.parameters){
                    //console.log('atl06pParams:',cmd.parameters);
                    atl06p(cmd.parameters as Atl06pReqParams,callbacks).then(async (result) => { // result
                        if(result){
                            read_result = result as Sr_Results_type;
                            target_numAtl06Recs = Number(read_result['atl06rec']);
                            target_num_atl06Exceptions = Number(read_result['exceptrec']);
                            console.log('atl06p Done Reading result:', read_result, 'target_numAtl06Recs:', target_numAtl06Recs, 'target_num_atl06Exceptions:', target_num_atl06Exceptions);
                        }
                        console.log('atl06p Done Reading result:', read_result);
                        state = 'done_reading';
                        // Log the result to the console
                        console.log('Final:  lastOne:', runningCount, 'req_id:', reqID);
                        console.log('req_id:',reqID, 'num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
                    },error => { // catch errors during the atl06p call promise (not ones that occur in success block)
                            // Log the error to the console
                            state = 'error';
                            console.log('atl06p Error = ', error);
                            let emsg = '';
                            let code = '';
                            if (navigator.onLine) {
                                code = 'NETWORK';
                                emsg =  'Network error: Possible DNS resolution issue or server down.';
                            } else {
                                code = 'OFFLINE';
                                emsg = 'Network error: your browser appears to be/have been offline.';
                            }
                            if(emsg !== '') {
                                console.error('atl06p Error = ', emsg);
                            }
                            sendErrorMsg(reqID, { type: 'NetworkError', code: code, message: emsg });
                    }).catch((error => { // catch all errors including in then clause of promise
                        // Log the error to the console
                        const status_details = `An unknown error occurred while running atl06p: ${error}`;
                        console.error('atl06p Error = ', status_details);
                        sendErrorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: 'an error has occured while running atl06p' });
                    })).finally(() => {
                        if(reqID){
                            console.log('runAtl06 req_id:',reqID, ' updating stats');
                            // Wait for all transaction promises to complete
                            console.log('runAtl06 num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
                        } else {
                            console.error('runAtl06 req_id was undefined?');
                            sendErrorMsg(reqID, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'reqID was undefined' });
                        }
                    });
                } else {
                    console.error('runAtl06 cmd.parameters was undefined');
                    sendErrorMsg(reqID, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'cmd.parameters was undefined' });
                }
            } else {
                console.error('runAtl06 reqID was undefined');
                sendErrorMsg(reqID, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'reqID was undefined' });
            }
        } else {
            console.error('runAtl06 req_id was undefined');
            sendErrorMsg(0, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'req_id was undefined' });
        }
    } catch (error: any) {
        console.error('runAtl06Error = ', error);
        sendErrorMsg(0, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'an Unknown error has occured' });
    }
};