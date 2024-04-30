import { db, type SrRequestRecord } from "@/db/SlideRuleDb";
import { type Elevation } from '@/db/SlideRuleDb';
import { atl06p } from '@/sliderule/icesat2.js';
import { type Atl06pReqParams } from '@/sliderule/icesat2';
import { type WorkerError, type WorkerMessage } from './workerUtils';
import { type ExtLatLon, type ExtHMean, type WorkerSummary } from '@/db/SlideRuleDb';
import type { ReqParams } from "@/stores/reqParamsStore";

const localExtLatLon = {minLat: 90, maxLat: -90, minLon: 180, maxLon: -180} as ExtLatLon;
const localExtHMean = {minHMean: 100000, maxHMean: -100000, lowHMean: 100000, highHMean: -100000} as ExtHMean;


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
}

async function sendSummaryMsg(req_id:number, summary:WorkerSummary, msg: string) {
    const workerSummaryMsg: WorkerMessage = { req_id:req_id, status: 'summary', msg:msg };
    try{
        await db.updateRequestRecord( {req_id:req_id, status: 'summary',status_details: msg});
        await db.updateSummary(req_id, summary);
    } catch (error) {
        console.error('Failed to update request status to summary:', error, ' for req_id:', req_id);
    }
    try{
        postMessage(workerSummaryMsg);
    } catch (error) {
        console.error('Failed to postMessage for workerSummary:', error, ' for req_id:', req_id);
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

onmessage = (event) => {
    try{
        let numWkChunks = 0;
        let runningCount = 0;
        let currentThreshold = 50000;
        const thresholdIncrement = 50000;
        const srRequestRecord:SrRequestRecord = JSON.parse(event.data);;
        const req:ReqParams = srRequestRecord.parameters as ReqParams;
        console.log("atl06ToDb req: ", req);
        const reqID = srRequestRecord.req_id;
        if((reqID) && (reqID > 0)){
            sendStartedMsg(reqID,req);
            const callbacks = {
                atl06rec: (result:any) => {
                    numWkChunks += 1;
                    const currentRecs = result["elevation"];
                    const curFlatRecs = currentRecs.flat();
                    if(curFlatRecs.length > 0) {
                        runningCount += curFlatRecs.length;
                        //console.log(`flatRecs.length:${flatRecs.length} lastOne:`,flatRecs[flatRecs.length - 1]);
                        db.transaction('rw', db.elevations, async () => {
                            try {
                                // Adding req_id to each record in curFlatRecs
                                const updatedFlatRecs: Elevation[] = curFlatRecs.map((rec: Elevation) => ({
                                    ...rec,
                                    req_id: reqID, 
                                }));
                                //console.log('flatRecs.length:', updatedFlatRecs.length, 'curFlatRecs:', updatedFlatRecs);
                                await db.elevations.bulkAdd(updatedFlatRecs);
                                //console.log('Bulk add successful');
                                updateExtremes(curFlatRecs);
                            } catch (error) {
                                console.error('Bulk add failed: ', error);
                                sendErrorMsg(reqID, { type: 'BulkAddError', code: 'BulkAdd', message: 'Bulk add failed' });
                            }
                        }).catch((error) => {
                            console.error('Transaction failed: ', error);
                            sendErrorMsg(reqID, { type: 'TransactionError', code: 'Transaction', message: 'Transaction failed' });
                        });
                        if(runningCount > currentThreshold) {
                            sendProgressMsg(reqID, runningCount,`Received ${runningCount} pnts in ${numWkChunks} chunks.`);
                            currentThreshold = runningCount + thresholdIncrement;
                        }

                    } else {
                        console.log('0 elevation records returned from SlideRule.');
                        sendProgressMsg(reqID, runningCount,`Received ${runningCount} pnts in ${numWkChunks} chunks.`);
                    }        
                },
                exceptrec: (result:any) => {
                    console.log('atl06p cb exceptrec result:', result);
                    //HACK!!!!!
                    if(result.text.includes('Starting proxy for atl06 to process')){
                        sendServerMsg(reqID, `server msg: ${result.text}`);
                    } else if(result.text.includes('Successfully completed processing')){
                        sendServerMsg(reqID, `server msg: ${result.text}`);
                    } else {
                        sendErrorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: result.text });
                    } 
                },
                eventrec: (result:any) => {
                    console.log('atl06p cb eventrec result:', result);
                    sendServerMsg(reqID, `server msg: ${result.attr}`);
                },
            };
            if(reqID){       
                console.log("atl06pParams:",srRequestRecord.parameters);
                if(srRequestRecord.parameters){
                    console.log('atl06pParams:',srRequestRecord.parameters);
                    atl06p(srRequestRecord.parameters as Atl06pReqParams,callbacks)
                    .then(() => { // result
                            // Log the result to the console
                            console.log('Final: flatRecs.length: lastOne:', runningCount, 'req_id:', reqID);
                            let status_details = 'unknown status_details';
                            if(runningCount > 0) {
                                status_details = `Received ${runningCount} pnts`;
                            } else {
                                status_details = 'No data returned from SlideRule.';
                            }
                            console.log('atl06p Success:', status_details);
                            sendSummaryMsg(reqID,  { extLatLon: localExtLatLon, extHMean: localExtHMean }, status_details);
                        },
                        error => {
                            // Log the error to the console
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
                        }
                    ).catch((error => {
                        // Log the error to the console
                        const status_details = `An unknown error occurred while running atl06p: ${error}`;
                        console.error('atl06p Error = ', status_details);
                        sendErrorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: 'an error has occured while running atl06p' });
                    })).finally(() => {
                        if(reqID){
                            console.log('runAtl06 req_id:',reqID, ' updating stats');
                            sendSuccessMsg(reqID, `Finished req_id: ${reqID}`);
                        } else {
                            console.error('runAtl06 req_id was undefined?');
                            sendErrorMsg(reqID, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'reqID was undefined' });
                        }
                    });
                } else {
                    console.error('runAtl06 srRequestRecord.parameters was undefined');
                    sendErrorMsg(reqID, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'srRequestRecord.parameters was undefined' });
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