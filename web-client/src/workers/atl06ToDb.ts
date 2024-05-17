import { db } from "@/db/SlideRuleDb";
import { type Elevation } from '@/db/SlideRuleDb';
import { atl06p } from '@/sliderule/icesat2.js';
import { type Atl06pReqParams,type Atl06ReqParams } from '@/sliderule/icesat2';
import { dataMsg, type WebWorkerCmd } from '@/workers/workerUtils';
import { get_num_defs_fetched, get_num_defs_rd_from_cache, type Sr_Results_type} from '@/sliderule/core';
import { init } from '@/sliderule/core';
import { updateExtremes,abortedMsg,progressMsg,serverMsg,startedMsg,errorMsg,successMsg,summaryMsg, type ExtHMean, type ExtLatLon } from '@/workers/workerUtils';

const localExtLatLon = {minLat: 90, maxLat: -90, minLon: 180, maxLon: -180} as ExtLatLon;
const localExtHMean = {minHMean: 100000, maxHMean: -100000, lowHMean: 100000, highHMean: -100000} as ExtHMean;

let target_numAtl06Recs = 0;
let target_numAtl06Exceptions = 0;
let target_numArrowDataRecs = 0;
let target_numArrowMetaRecs = 0;

let num_checks = 0;
let num_post_done_checks = 0;
export async function checkDoneProcessing(  reqID:number, 
                                            read_state:string, 
                                            num_atl06Exceptions:number, 
                                            num_atl06recs_processed:number,
                                            num_arrow_data_recs_processed:number,
                                            num_arrow_meta_recs_processed:number, 
                                            num_el_pnts:number, 
                                            bulkAddPromises: Promise<void>[],
                                            localExtLatLon: ExtLatLon,
                                            localExtHMean: ExtHMean,
                                            target_numAtl06Recs:number,
                                            target_numAtl06Exceptions:number,
                                            target_numArrowDataRecs:number,
                                            target_numArrowMetaRecs:number): Promise<void>{
    num_checks++;
    if((read_state === 'done_reading') || (read_state === 'error')){
        num_post_done_checks++;
        if((num_atl06recs_processed >= target_numAtl06Recs) && (num_atl06Exceptions >= target_numAtl06Exceptions) && (num_arrow_data_recs_processed >= target_numArrowDataRecs) && (num_arrow_meta_recs_processed >= target_numArrowMetaRecs)){
            let status_details = 'No data returned from SlideRule.';
            if((target_numAtl06Recs > 0) || (target_numArrowDataRecs > 0) || (target_numArrowMetaRecs > 0)){
                status_details = `Received atl06rec:${target_numAtl06Recs}  arrow.data:${target_numArrowDataRecs} arrow.meta:${target_numArrowMetaRecs} Processed atl06:${num_atl06recs_processed}  arrow.data:${num_arrow_data_recs_processed} arrow.meta:${num_arrow_meta_recs_processed}  exceptions:${num_atl06Exceptions}  num_el_pnts:${num_el_pnts}  num_checks:${num_checks} num_post_done_checks:${num_post_done_checks} bulkAddPromises:${bulkAddPromises.length}`;
            }
            console.log('atl06p Success:', status_details, 'req_id:', reqID, 'num_el_pnts:', num_el_pnts, 'num_checks:', num_checks, 'num promises:', bulkAddPromises.length);
            if(bulkAddPromises.length > 0){
                Promise.all(bulkAddPromises).then(async () => {
                    postMessage(await summaryMsg({req_id:reqID, status:'summary', extLatLon: localExtLatLon, extHMean: localExtHMean }, status_details));
                    postMessage(await successMsg(reqID, `Successfully finished reading req_id: ${reqID} with ${num_el_pnts} points.`));
                }).catch((error) => {
                    console.error('Failed to complete bulk add promises:', error);
                    postMessage(errorMsg(reqID, { type: 'BulkAddError', code: 'BulkAdd', message: 'Bulk add failed' }));
                });
            } else {
                console.log('No bulk add promises to process.');
                postMessage(await summaryMsg({req_id:reqID, status:'summary', extLatLon: localExtLatLon, extHMean: localExtHMean }, status_details));
                postMessage(await successMsg(reqID, `Successfully finished reading req_id: ${reqID} with ${num_el_pnts} points.`));
            }
        }
        read_state = 'done';
    }
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
            abortedMsg(reqID, 'Processing aborted.');
            console.log('Abort requested for req_id:', reqID);
            return;
        }
        if (cmd.sysConfig){
            init(cmd.sysConfig)
        } else {
            console.error('cmd.sysConfig was not provided');
            errorMsg(reqID, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'cmd.sysConfig was not provided' });
            return;
        }
        const req:Atl06ReqParams = cmd.parameters as Atl06ReqParams;
        console.log("atl06ToDb req: ", req);
        let num_atl06recs_processed = 0;
        let num_atl06Exceptions = 0;
        let num_arrow_data_recs_processed = 0;
        let num_arrow_meta_recs_processed = 0;
        let read_result = {} as Sr_Results_type;
        let read_state = 'idle'
        let num_el_pnts = 0;
        let recsProgThresh = 1;
        let recsProgThreshInc = 100;
        let exceptionsProgThresh = 1;
        let exceptionsProgThreshInc = 1;
        const bulkAddPromises: Promise<void>[] = [];
        let arrowData: Uint8Array | undefined = undefined;
        let arrowFilename = '';
        let arrowDataSize = 0;
        let arrowDataOffset = 0;

        
        if((reqID) && (reqID > 0)){
            num_checks = 0;
            startedMsg(reqID,req);
            const callbacks = {
                'arrowrec.meta': async (result:any) => {
                    console.log('atl06p cb arrowrec.meta result:', result);
                    arrowFilename = result.filename;
                    arrowDataSize = Number(result.size);
                    if(num_arrow_meta_recs_processed === 0){
                        try{
                            await db.updateRequestRecord( {req_id:reqID, status: 'progress',status_details: 'Started processing arrow meta data.'});
                        } catch (error) {
                            console.error('Failed to update request status to progress:', error, ' for req_id:', reqID);
                        }
                    }
                    num_arrow_meta_recs_processed++;
                },
                'arrowrec.data': async (result:any) => {
                    console.log('atl06p cb arrowrec.data result:', result);
                    //postMessage({type: 'arrowData', data: result.data}); 
                    //arrowData.push(result.data);

                    if(num_arrow_data_recs_processed === 0){
                        try{
                            arrowData = new Uint8Array(arrowDataSize);
                            await db.updateRequestRecord( {req_id:reqID, status: 'progress',status_details: 'Started processing arrow data.'});
                        } catch (error) {
                            console.error('Failed to update request status to progress:', error, ' for req_id:', reqID);
                        }
                    }
                    if(arrowData){
                        arrowData.set(result.data, arrowDataOffset);
                        arrowDataOffset += result.data.length;
                        num_arrow_data_recs_processed++;
                        num_arrow_data_recs_processed++;
                    } else {
                        console.error('arrowData was not initialized.');
                    }  
                },
                atl06rec: async (result:any) => {
                    if(num_atl06recs_processed === 0){
                        try{

                            await db.updateRequestRecord( {req_id:reqID, status: 'progress',status_details: 'Started processing ATL06 data.'});
                        } catch (error) {
                            console.error('Failed to update request status to progress:', error, ' for req_id:', reqID);
                        }
                    }
                    num_atl06recs_processed++;
                    if (abortRequested) {
                        console.log('Processing aborted.');
                        return; // Stop processing when abort is requested
                    }
                    const currentRecs = result["elevation"];
                    const curFlatRecs = currentRecs.flat();
                    if(curFlatRecs.length > 0) {
                        num_el_pnts += curFlatRecs.length;
                        updateExtremes(curFlatRecs, localExtLatLon, localExtHMean);
                        //console.log('bulkAddElevations:',curFlatRecs.length, 'num_el_pnts:', num_el_pnts);
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
                            postMessage(await errorMsg(reqID, { type: 'BulkAddError', code: 'BulkAdd', message: 'Bulk add failed' }));
                        }

                    } else {
                        console.log('0 elevation records returned from SlideRule.');
                    } 
                    if(num_atl06recs_processed > recsProgThresh){
                        recsProgThresh = num_atl06recs_processed + recsProgThreshInc;
                        const msg =  `Received ${num_el_pnts} pnts in ${num_atl06recs_processed}/${target_numAtl06Recs} records. ${num_atl06Exceptions}/${target_numAtl06Exceptions} exceptions.`;
                        postMessage(await progressMsg(reqID, 
                                        {
                                            read_state:read_state,
                                            target_numAtl06Recs:target_numAtl06Recs,
                                            numAtl06Recs:num_atl06recs_processed,
                                            target_numAtl06Exceptions:target_numAtl06Exceptions,
                                            numAtl06Exceptions:num_atl06Exceptions,
                                            target_numArrowDataRecs:target_numArrowDataRecs,
                                            numArrowDataRecs:num_arrow_data_recs_processed,
                                            target_numArrowMetaRecs:target_numArrowMetaRecs,
                                            numArrowMetaRecs:num_arrow_meta_recs_processed
                                        },
                                        msg,
                                        localExtLatLon,
                                        localExtHMean));
                        console.log(msg);
                    }
                    await checkDoneProcessing(reqID, 
                                        read_state, 
                                        num_atl06Exceptions, 
                                        num_atl06recs_processed,
                                        num_arrow_data_recs_processed,
                                        num_arrow_meta_recs_processed, 
                                        num_el_pnts, 
                                        bulkAddPromises,
                                        localExtLatLon,
                                        localExtHMean,
                                        target_numAtl06Recs,
                                        target_numAtl06Exceptions,
                                        target_numArrowDataRecs,
                                        target_numArrowMetaRecs);
                },
                exceptrec: async (result:any) => {
                    num_atl06Exceptions++;
                    console.log('atl06p cb exceptrec result:', result);
                    switch(result.code){
                        case 0: // RTE_INFO
                        {
                            //console.log('RTE_INFO: atl06p cb exceptrec result:', result.text);
                            postMessage(await serverMsg(reqID, `server msg: ${result.text}`));
                            break;
                        }
                        case -1: // RTE_ERROR
                        {
                            console.error('RTE_ERROR: atl06p cb exceptrec result:', result.text);
                            postMessage(await errorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: result.text }));
                            break;
                        }
                        case -2: // RTE_TIMEOUT
                        {
                            console.error('RTE_TIMEOUT: atl06p cb exceptrec result:', result.text);
                            postMessage(await errorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: result.text }));
                            const msg =  `RTE_TIMEOUT Received ${num_el_pnts} pnts in ${num_atl06recs_processed}/${target_numAtl06Recs} records. ${num_atl06Exceptions}/${target_numAtl06Exceptions} exceptions. num_arrow_data_recs:${num_arrow_data_recs_processed} num_arrow_meta_recs:${num_arrow_meta_recs_processed}.`;
                            postMessage(await progressMsg(reqID, 
                                            {   
                                                read_state:read_state,
                                                target_numAtl06Recs:target_numAtl06Recs,
                                                numAtl06Recs:num_atl06recs_processed,
                                                target_numAtl06Exceptions:target_numAtl06Exceptions,
                                                numAtl06Exceptions:num_atl06Exceptions,
                                                target_numArrowDataRecs:target_numArrowDataRecs,
                                                numArrowDataRecs:num_arrow_data_recs_processed,
                                                target_numArrowMetaRecs:target_numArrowMetaRecs,
                                                numArrowMetaRecs:num_arrow_meta_recs_processed
                                            },
                                            msg,
                                            localExtLatLon,
                                            localExtHMean));
                            console.log(msg);
                            break;
                        }
                        case -3: // RTE_RESOURCE_DOES_NOT_EXIST
                        {
                            console.error('RTE_RESOURCE_DOES_NOT_EXIST: atl06p cb exceptrec result:', result.text);
                            postMessage(await errorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: result.text }));
                            break;
                        }
                        case -4: // RTE_EMPTY_SUBSET
                        {
                            //console.log('RTE_EMPTY_SUBSET: atl06p cb exceptrec result:', result.text);
                            postMessage(await serverMsg(reqID, result.text));
                            break;
                        }
                        case -5: // RTE_SIMPLIFY
                        {
                            console.log('RTE_SIMPLIFY: atl06p cb exceptrec req:', req);
                            console.error('RTE_SIMPLIFY: atl06p cb exceptrec result:', result.text);
                            //postMessage(await errorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: result.text }));
                            break;
                        }
                    }
                    console.log('num_el_pnts:', num_el_pnts, ' num_atl06recs_processed:', num_atl06recs_processed, 'num_atl06Exceptions:', num_atl06Exceptions, 'num_arrow_data_recs_processed:', num_arrow_data_recs_processed, 'num_arrow_meta_recs_processed:', num_arrow_meta_recs_processed);
                    if(num_atl06Exceptions > exceptionsProgThresh){
                        exceptionsProgThresh = num_atl06Exceptions + exceptionsProgThreshInc;
                        const msg =  `Received ${num_el_pnts} pnts in ${num_atl06recs_processed}/${target_numAtl06Recs} atl06 records. ${num_atl06Exceptions}/${target_numAtl06Exceptions} exceptions num_arrow_data_recs:${num_arrow_data_recs_processed} num_arrow_meta_recs:${num_arrow_meta_recs_processed}.`;
                        postMessage(await progressMsg(reqID, 
                                        {
                                            read_state:read_state,
                                            target_numAtl06Recs:target_numAtl06Recs,
                                            numAtl06Recs:num_atl06recs_processed,
                                            target_numAtl06Exceptions:target_numAtl06Exceptions,
                                            numAtl06Exceptions:num_atl06Exceptions,
                                            target_numArrowDataRecs:target_numArrowDataRecs,
                                            numArrowDataRecs:num_arrow_data_recs_processed,
                                            target_numArrowMetaRecs:target_numArrowMetaRecs,
                                            numArrowMetaRecs:num_arrow_meta_recs_processed
                                        },
                                        msg,
                                        localExtLatLon,
                                        localExtHMean));
                        console.log(msg);
                    }
                    await checkDoneProcessing(reqID, 
                                        read_state, 
                                        num_atl06Exceptions, 
                                        num_atl06recs_processed,
                                        num_arrow_data_recs_processed,
                                        num_arrow_meta_recs_processed, 
                                        num_el_pnts,
                                        bulkAddPromises,
                                        localExtLatLon,
                                        localExtHMean,
                                        target_numAtl06Recs,
                                        target_numAtl06Exceptions,
                                        target_numArrowDataRecs,
                                        target_numArrowMetaRecs);
                    //console.log('exceptrec  num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
                },
                eventrec: (result:any) => {
                    //console.log('atl06p cb eventrec result (DEPRECATED):', result);
                    postMessage(serverMsg(reqID, `server msg (DEPRECATED): ${result.attr}`));
                },
            }; // callbacks...
            if(reqID){       
                //console.log("atl06pParams:",cmd.parameters);
                if(cmd.parameters){
                    //console.log('atl06pParams:',cmd.parameters);
                    read_state = 'reading';
                    postMessage(await progressMsg(reqID, 
                            {
                                read_state:read_state,
                                target_numAtl06Recs:target_numAtl06Recs,
                                numAtl06Recs:num_atl06recs_processed,
                                target_numAtl06Exceptions:target_numAtl06Exceptions,
                                numAtl06Exceptions:num_atl06Exceptions,
                                target_numArrowDataRecs:target_numArrowDataRecs,
                                numArrowDataRecs:num_arrow_data_recs_processed,
                                target_numArrowMetaRecs:target_numArrowMetaRecs,
                                numArrowMetaRecs:num_arrow_meta_recs_processed
                            },
                            'Starting to read ATL06 data.',
                            localExtLatLon,
                            localExtHMean));                  
                    atl06p(cmd.parameters as Atl06pReqParams,callbacks).then(async (result) => { // result
                        if(result){
                            read_result = result as Sr_Results_type;
                            target_numAtl06Recs = 'atl06rec' in read_result ? Number(read_result['atl06rec']) : 0;
                            target_numAtl06Exceptions = 'exceptrec' in read_result ? Number(read_result['exceptrec']) : 0;
                            target_numArrowDataRecs = 'arrowrec.data' in read_result ? Number(read_result['arrowrec.data']) : 0;
                            target_numArrowMetaRecs = 'arrowrec.meta' in read_result ? Number(read_result['arrowrec.meta']) : 0;
                            console.log('atl06p Done Reading result:', read_result, 'target_numAtl06Recs:', target_numAtl06Recs, 'target_numAtl06Exceptions:', target_numAtl06Exceptions, 'target_numArrowDataRecs:', target_numArrowDataRecs, 'target_numArrowMetaRecs:', target_numArrowMetaRecs);
                        }
                        console.log('atl06p Done Reading: result:', result);
                        //console.log('atl06p Done Reading: read_result:', read_result);
                        const msg =  `Done Reading; received ${num_el_pnts} pnts in ${num_atl06recs_processed}/${target_numAtl06Recs} records. ${num_atl06Exceptions}/${target_numAtl06Exceptions} exceptions. num_arrow_data_recs:${num_arrow_data_recs_processed} num_arrow_meta_recs:${num_arrow_meta_recs_processed}.`;

                        read_state = 'done_reading';
                        postMessage(await progressMsg(reqID, 
                                        {
                                            read_state:read_state,
                                            target_numAtl06Recs:target_numAtl06Recs,
                                            numAtl06Recs:num_atl06recs_processed,
                                            target_numAtl06Exceptions:target_numAtl06Exceptions,
                                            numAtl06Exceptions:num_atl06Exceptions,
                                            target_numArrowDataRecs:target_numArrowDataRecs,
                                            numArrowDataRecs:num_arrow_data_recs_processed,
                                            target_numArrowMetaRecs:target_numArrowMetaRecs,
                                            numArrowMetaRecs:num_arrow_meta_recs_processed
                                        },
                                        msg,
                                        localExtLatLon,
                                        localExtHMean));
                        recsProgThreshInc = Math.floor(target_numAtl06Recs/10);
                        exceptionsProgThreshInc = Math.floor(target_numAtl06Exceptions/10);
                        // Log the result to the console
                        console.log('Final:  lastOne:', num_el_pnts, 'req_id:', reqID);
                        console.log('req_id:',reqID, 'num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
                    },error => { // catch errors during the atl06p call promise (not ones that occur in success block)
                            // Log the error to the console
                            read_state = 'error';
                            postMessage(progressMsg(reqID, 
                                {
                                    read_state:read_state,
                                    target_numAtl06Recs:target_numAtl06Recs,
                                    numAtl06Recs:num_atl06recs_processed,
                                    target_numAtl06Exceptions:target_numAtl06Exceptions,
                                    numAtl06Exceptions:num_atl06Exceptions,
                                    target_numArrowDataRecs:target_numArrowDataRecs,
                                    numArrowDataRecs:num_arrow_data_recs_processed,
                                    target_numArrowMetaRecs:target_numArrowMetaRecs,
                                    numArrowMetaRecs:num_arrow_meta_recs_processed
                                },
                                'Error occurred while reading ATL06 data.',
                                localExtLatLon,
                                localExtHMean));
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
                            postMessage(errorMsg(reqID, { type: 'NetworkError', code: code, message: emsg }));
                    }).catch((error => { // catch all errors including in then clause of promise
                        // Log the error to the console
                        const status_details = `An unknown error occurred while running atl06p: ${error}`;
                        read_state = 'error';
                        postMessage(progressMsg(reqID, 
                                        {
                                            read_state:read_state,
                                            target_numAtl06Recs:target_numAtl06Recs,
                                            numAtl06Recs:num_atl06recs_processed,
                                            target_numAtl06Exceptions:target_numAtl06Exceptions,
                                            numAtl06Exceptions:num_atl06Exceptions,
                                            target_numArrowDataRecs:target_numArrowDataRecs,
                                            numArrowDataRecs:num_arrow_data_recs_processed,
                                            target_numArrowMetaRecs:target_numArrowMetaRecs,
                                            numArrowMetaRecs:num_arrow_meta_recs_processed
                                        },
                                        status_details,
                                        localExtLatLon,
                                        localExtHMean));
                        console.log('atl06p Error = ', error);
                        console.error('atl06p Error = ', status_details);
                        postMessage(errorMsg(reqID, { type: 'atl06pError', code: 'ATL06P', message: 'an error has occured while running atl06p' }));
                    })).finally(() => {
                        if(reqID){
                            console.log('finally runAtl06 req_id:',reqID, ' updating stats');
                            // Wait for all transaction promises to complete
                            console.log('finally runAtl06 num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
                        } else {
                            console.error('finally runAtl06 req_id was undefined?');
                            errorMsg(reqID, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'reqID was undefined' });
                        }
                        checkDoneProcessing(reqID, 
                                            read_state, 
                                            num_atl06Exceptions, 
                                            num_atl06recs_processed,
                                            num_arrow_data_recs_processed,
                                            num_arrow_meta_recs_processed, 
                                            num_el_pnts, 
                                            bulkAddPromises,
                                            localExtLatLon,
                                            localExtHMean,
                                            target_numAtl06Recs,
                                            target_numAtl06Exceptions,
                                            target_numArrowDataRecs,
                                            target_numArrowMetaRecs);
                        if(num_arrow_data_recs_processed > 0){
                            console.log('runAtl06 req_id:',reqID, 'postMessage dataMsg: arrowFilename:', arrowFilename, 'arrowData:', arrowData);
                            if(arrowData){
                                postMessage(dataMsg(reqID, arrowFilename, [arrowData]));
                            } else {
                                console.error('arrowData was not initialized.');
                            }
                        }
                    });
                } else {
                    console.error('runAtl06 cmd.parameters was undefined');
                    postMessage(await errorMsg(reqID, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'cmd.parameters was undefined' }));
                }
            } else {
                console.error('runAtl06 reqID was undefined');
                postMessage(await errorMsg(reqID, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'reqID was undefined' }));
            }
        } else {
            console.error('runAtl06 req_id was undefined');
            postMessage(await errorMsg(0, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'req_id was undefined' }));
        }
    } catch (error: any) {
        console.error('runAtl06Error = ', error);
        postMessage(await errorMsg(0, { type: 'runAtl06Error', code: 'WEBWORKER', message: 'an Unknown error has occured' }));
    }
};