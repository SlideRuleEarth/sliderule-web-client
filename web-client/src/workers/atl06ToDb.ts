import { db } from "@/db/SlideRuleDb";
import { type Elevation } from '@/db/SlideRuleDb';
import { atl06p } from '@/sliderule/icesat2.js';
import { type Atl06pReqParams } from '@/sliderule/icesat2';


let localHMin = 100000;
let localHMax = -100000;
let localLatMin = 90;
let localLatMax = -90;
let localLonMin = 180;
let localLonMax = -180;


export interface WorkerError {
    type: string;
    code: string;
    message: string;
}
type WorkerStatus = 'started' | 'progress' | 'success' | 'error';

export interface WorkerMessage {
    status: WorkerStatus; 
    progress?: number;      // Percentage for progress updates
    msg?: String;           // status details
    error?: WorkerError;    // Error details (if an error occurred)
}

function sendStatusMsg(status: WorkerStatus, msg: String) {
    const wmsg: WorkerMessage = { status: status, msg:msg };
    postMessage(wmsg);
}

function sendErrorMsg(workerError: WorkerError) {
    const wmsg: WorkerMessage = { status: 'error', error: workerError };
    postMessage(wmsg);
}

function updateExtremes(curFlatRecs: { h_mean: number,latitude: number, longitude:number }[]) {

    curFlatRecs.forEach(rec => {
        if (rec.h_mean < localHMin) {
            localHMin = rec.h_mean;
        }
        if (rec.h_mean > localHMax) {
            localHMax = rec.h_mean;
        }
        if (rec.latitude < localLatMin) {
            localLatMin = rec.latitude;
        }
        if (rec.latitude > localLatMax) {
            localLatMax = rec.latitude;
        }
        if (rec.longitude < localLonMin) {
            localLonMin = rec.longitude;
        }
        if (rec.longitude > localLonMax) {
            localLonMax = rec.longitude;
        }
    });
}

onmessage = (event) => {
    try{
        let runningCount = 0;
        let currentThreshold = 50000;
        const thresholdIncrement = 50000;
        const req = JSON.parse(event.data);
        console.log("atl06ToDb req: ", req);
        sendStatusMsg('started', `Starting req_id: ${req.req_id}`);
        const recs:Elevation[] = [];
        const callbacks = {
            atl06rec: (result:any) => {
                const currentRecs = result["elevation"];
                const curFlatRecs = currentRecs.flat();
                if(curFlatRecs.length > 0) {
                    runningCount += curFlatRecs.length;
                    if(runningCount > currentThreshold) {
                        sendStatusMsg('progress', `Recieved ${runningCount} pnts`);
                        currentThreshold = runningCount + thresholdIncrement;
                    }
                    recs.push(curFlatRecs);
                    updateExtremes(curFlatRecs);
                    //console.log(`flatRecs.length:${flatRecs.length} lastOne:`,flatRecs[flatRecs.length - 1]);
                    db.transaction('rw', db.elevations, async () => {
                        try {
                            // Adding req_id to each record in curFlatRecs
                            const updatedFlatRecs: Elevation[] = curFlatRecs.map((rec: Elevation) => ({
                                ...rec,
                                req_id: req.req_id, 
                            }));
                            //console.log('flatRecs.length:', updatedFlatRecs.length, 'curFlatRecs:', updatedFlatRecs);
                            await db.elevations.bulkAdd(updatedFlatRecs);
                            //console.log('Bulk add successful');
                        } catch (error) {
                            console.error('Bulk add failed: ', error);
                            sendErrorMsg({ type: 'BulkAddError', code: 'BulkAdd', message: 'Bulk add failed' });
                        }
                    }).catch((error) => {
                        console.error('Transaction failed: ', error);
                        sendErrorMsg({ type: 'TransactionError', code: 'Transaction', message: 'Transaction failed' });
                    });    
                } else {
                    console.log('0 elevation records returned from SlideRule.');
                    sendStatusMsg('progress', `Received ${curFlatRecs.length} pnts?`);
                }        
            },
            exceptrec: (result:any) => {
                console.log('atl06p cb exceptrec result:', result);
                sendErrorMsg({ type: 'atl06pError', code: 'ATL06P', message: result.text });
            },
            eventrec: (result:any) => {
                console.log('atl06p cb eventrec result:', result);
                sendStatusMsg('progress', `server msg: ${result.text}`);
            },
        };
        if(req.req_id){       
            console.log("atl06pParams:",req.parameters);
            if(req.parameters){
                console.log('atl06pParams:',req.parameters);
                atl06p(req.parameters as Atl06pReqParams,callbacks)
                .then(
                    () => { // result
                        // Log the result to the console
                        const flatRecs = recs.flat();
                        console.log(`Final: flatRecs.length:${flatRecs.length} lastOne:`,flatRecs[flatRecs.length - 1]);
                        let status_details = 'unknown status_details';
                        if(flatRecs.length > 0) {
                            status_details = `Recieved ${recs.flat().length} pnts`;
                        } else {
                            status_details = 'No data returned from SlideRule.';
                        }
                        console.log('runSlideRuleClicked Success:', status_details);
                        sendStatusMsg('success', status_details);
                    },
                    error => {
                        // Log the error to the console
                        console.log('runSlideRuleClicked Error = ', error);
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
                            console.error('runSlideRuleClicked Error = ', emsg);
                        }
                        sendErrorMsg({ type: 'NetworkError', code: code, message: emsg });
                    }
                ).catch((error => {
                    // Log the error to the console
                    const status_details = `An unknown error occurred while running atl06p: ${error}`;
                    console.error('runSlideRuleClicked Error = ', status_details);
                    sendErrorMsg({ type: 'atl06pError', code: 'ATL06P', message: 'an error has occured while running atl06p' });
                })).finally(() => {
                    if(req.req_id){
                        console.log('runAtl06 req_id:',req.req_id, ' updating stats');
                        db.addOrUpdateExtLatLon({req_id: req.req_id, minLat: localLatMin, maxLat: localLatMax, minLon: localLonMin, maxLon: localLonMax});
                        db.addOrUpdateHMeanStats({req_id: req.req_id, minHMean: localHMin, maxHMean: localHMax, lowHMean: localHMin + 0.05 * (localHMax - localHMin), highHMean: localHMin + 0.95 * (localHMax - localHMin)});
                        sendStatusMsg('success', `Finished req_id: ${req.req_id}`);
                    } else {
                        console.error('runAtl06 req_id was undefined?');
                        sendErrorMsg({ type: 'runAtl06Error', code: 'WEBWORKER', message: 'req.req_id was undefined' });
                    }
                });
            } else {
                console.error('runAtl06 req.parameters was undefined');
                sendErrorMsg({ type: 'runAtl06Error', code: 'WEBWORKER', message: 'req.parameters was undefined' });
            }
        } else {
            console.error('runAtl06 req.req_id was undefined');
            sendErrorMsg({ type: 'runAtl06Error', code: 'WEBWORKER', message: 'req.req_id was undefined' });
        }
    } catch (error: any) {
        console.error('runAtl06Error = ', error);
        sendErrorMsg({ type: 'runAtl06Error', code: 'WEBWORKER', message: 'an Unknown error has occured' });
    }
};