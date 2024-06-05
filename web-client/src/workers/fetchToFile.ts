import { db } from "@/db/SlideRuleDb";
import { atl06,atl03 } from '@/sliderule/icesat2.js';
import { type AtlpReqParams,type AtlReqParams } from '@/sliderule/icesat2';
import { type WebWorkerCmd, opfsReadyMsg } from '@/workers/workerUtils';
import { get_num_defs_fetched, get_num_defs_rd_from_cache, type Sr_Results_type} from '@/sliderule/core';
import { init } from '@/sliderule/core';
import { abortedMsg,progressMsg,serverMsg,startedMsg,errorMsg,successMsg} from '@/workers/workerUtils';

let target_numSvrExceptions = 0;
let target_numArrowDataRecs = 0;
let target_numArrowMetaRecs = 0;
let abortRequested = false;
let num_checks = 0;
let num_post_done_checks = 0;


export async function checkDoneProcessing(  reqID:number, 
                                            read_state:string, 
                                            num_svr_exceptions:number, 
                                            num_arrow_data_recs_processed:number,
                                            num_arrow_meta_recs_processed:number, 
                                            target_numSvrExceptions:number,
                                            target_numArrowDataRecs:number,
                                            target_numArrowMetaRecs:number): Promise<void>{
    num_checks++;
    console.log('checkDoneProcessing num_checks:', num_checks, 'num_post_done_checks:', num_post_done_checks, 'read_state:', read_state, 'abortRequested:', abortRequested, 'reqID:', reqID, 'num_svr_exceptions:', num_svr_exceptions, 'num_arrow_data_recs_processed:', num_arrow_data_recs_processed, 'num_arrow_meta_recs_processed:', num_arrow_meta_recs_processed, 'target_numSvrExceptions:', target_numSvrExceptions, 'target_numArrowDataRecs:', target_numArrowDataRecs, 'target_numArrowMetaRecs:', target_numArrowMetaRecs)
    if((read_state === 'done_reading') || (read_state === 'error') || abortRequested){
        num_post_done_checks++;
        if( ((num_svr_exceptions >= target_numSvrExceptions) && (num_arrow_data_recs_processed >= target_numArrowDataRecs) && (num_arrow_meta_recs_processed >= target_numArrowMetaRecs)) || abortRequested){
            let status_details = 'No data returned from SlideRule.';
            if( (target_numArrowDataRecs > 0) && (target_numArrowMetaRecs > 0) && (target_numSvrExceptions > 0)){
                status_details = `Received tgt arrow.data:${target_numArrowDataRecs} tgt arrow.meta:${target_numArrowMetaRecs} tgt Exceptions: ${target_numSvrExceptions}  arrow.data:${num_arrow_data_recs_processed} arrow.meta:${num_arrow_meta_recs_processed}  exceptions:${num_svr_exceptions} num_checks:${num_checks} num_post_done_checks:${num_post_done_checks}`;
                const fileName = await db.getFilename(reqID);
                postMessage(opfsReadyMsg(reqID, fileName));
                let msg = `checkDoneProcessing: Successfully finished reading/writing req_id: ${reqID}`;
                if(abortRequested){ // Abort requested
                    msg = `checkDoneProcessing: Aborted processing req_id: ${reqID}`
                } else {
                    if(read_state === 'done_reading'){
                        console.log('Success:', status_details, 'req_id:', reqID, 'num_checks:', num_checks);
                        postMessage(await successMsg(reqID, msg));
                    }
                }
                read_state = 'done';
                console.log(msg);
            }
        }
    }
}


function mysleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

onmessage = async (event) => {
    try{
        console.log('fetchToFile worker received event:', event.data)
        // console.log('Starting with num_defs_fetched:',get_num_defs_fetched(),' recordDefinitions:',get_recordDefinitions());
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


        const cmd:WebWorkerCmd = JSON.parse(event.data);
        console.log('fetchToFile worker received cmd:', cmd);
        const reqID = cmd.req_id;
        if(cmd.type === 'abort'){
            abortRequested = true;
            postMessage(await abortedMsg(reqID, 'Processing aborted.'));
            console.log('Abort requested for req_id:', reqID);
            return;
        }
        if (cmd.sysConfig){
            init(cmd.sysConfig)
        } else {
            console.error('cmd.sysConfig was not provided');
            errorMsg(reqID, { type: 'runWorkerError', code: 'WEBWORKER', message: 'cmd.sysConfig was not provided' });
            return;
        }

        const req:AtlReqParams = cmd.parameters as AtlReqParams;
        console.log("fetchToFile req: ", req);
        let num_svr_exceptions = 0;
        let num_arrow_dataFile_data_recs_processed = 0;
        let num_arrow_dataFile_meta_recs_processed = 0;
        let num_arrow_metaFile_data_recs_processed = 0;
        let num_arrow_metaFile_meta_recs_processed = 0;
        let read_result = {} as Sr_Results_type;
        let read_state = 'idle'
        let exceptionsProgThresh = 1;
        let exceptionsProgThreshInc = 1;
        let arrowMetaFile: Uint8Array | undefined = undefined;
        let arrowDataFilename: string = '';
        let arrowMetaFilename: string = '';
        let arrowDataFileSize:number = 0;
        let arrowMetaFileSize:number = 0;
        let arrowDataFileOffset: number = 0;
        let arrowMetaFileOffset: number = 0;
        let arrowCbNdx = -1;

        const fileName = `${cmd.func}_${reqID}_${new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-').replace(/T/g, '-').replace(/Z/g, '')}.parquet`;
        const outputFormat = req.parms.output?.format;
        const opfsRoot = await navigator.storage.getDirectory();
        console.log(cmd.func,' arrowCbNdx:',arrowCbNdx,' fileName:', fileName, ' outputFormat:', outputFormat, ' opfsRoot:', opfsRoot, 'req', req);
        let syncAccessHandle: any;
        if(fileName){
            const fileHandle = await opfsRoot.getFileHandle(fileName, {
                create: true,
            });
            console.log(cmd.func,' arrowCbNdx:',arrowCbNdx,' fileName:', fileName, ' fileHandle:', fileHandle);
            syncAccessHandle = await (fileHandle as any).createSyncAccessHandle();
            console.log(cmd.func,' arrowCbNdx:',arrowCbNdx,' fileName:', fileName, ' syncAccessHandle:', syncAccessHandle);
            await db.updateRequestRecord( {req_id:reqID, file:fileName});
        } else {
            console.log(cmd.func,' arrowCbNdx:',arrowCbNdx,' fileName was not provided.');
        }
        if((reqID) && (reqID > 0)){
            num_checks = 0;
            startedMsg(reqID,req);
            const callbacks = {
                'arrowrec.meta': async (result:any) => {
                    arrowCbNdx++;
                    console.log('atl06p cb arrowrec.meta arrowCbNdx:',arrowCbNdx,' result.filename:', result.filename, ' result:', result);
                    if (abortRequested) {
                        console.log('Processing aborted.');
                        return; // Stop processing when abort is requested
                    }
                    if(result.filename.includes('_metadata.json')){
                        arrowMetaFilename = result.filename;
                        arrowMetaFileSize = Number(result.size);
                        arrowMetaFileOffset = 0;
                        //create the new data array that corresponds to this meta data
                        arrowMetaFile = new Uint8Array(arrowMetaFileSize);
                        if(num_arrow_metaFile_meta_recs_processed === 0){
                            try{
                                await db.updateRequestRecord( {req_id:reqID, status: 'progress',status_details: 'Started processing arrow meta data.'});
                            } catch (error) {
                                console.error('Failed to update request status to progress:', error, ' for req_id:', reqID, ' for arrowCbNdx:', arrowCbNdx);
                            }
                        }
                        num_arrow_metaFile_meta_recs_processed++;
                        console.log('atl06p cb arrowrec.meta arrowCbNdx:',arrowCbNdx,' arrowMetaFilename:', arrowMetaFilename, ' arrowMetaFileSize:', arrowMetaFileSize, 'arrowDataFileOffset:', arrowDataFileOffset, ' num_arrow_metaFile_meta_recs_processed:', num_arrow_metaFile_meta_recs_processed);
                    } else {
                        arrowDataFilename = result.filename;
                        arrowDataFileSize = Number(result.size);
                        arrowDataFileOffset = 0;
                        if(num_arrow_dataFile_meta_recs_processed === 0){
                            try{
                                await db.updateRequestRecord( {req_id:reqID, status: 'progress',status_details: 'Started processing arrow data.'});
                            } catch (error) {
                                console.error('Failed to update request status to progress:', error, ' for req_id:', reqID, ' for arrowCbNdx:', arrowCbNdx);
                            }
                        }
                        num_arrow_dataFile_meta_recs_processed++;
                        console.log('atl06p cb arrowrec.meta arrowCbNdx:',arrowCbNdx,' arrowDataFilename:', arrowDataFilename, ' arrowDataFileSize:', arrowDataFileSize, 'arrowDataFileOffset:', arrowDataFileOffset, ' num_arrow_dataFile_data_recs_processed:', num_arrow_dataFile_data_recs_processed);
                    }
                },
                'arrowrec.data': async (result:any) => {
                    arrowCbNdx++;
                    console.log('atl06p cb arrowrec.data arrowCbNdx:',arrowCbNdx,' result:', result);
                    if (abortRequested) {
                        console.log('Processing aborted.');
                        return; // Stop processing when abort is requested
                    }
                    if(result.filename.includes('_metadata.json')){
                        if(arrowMetaFile){
                            arrowMetaFile.set(result.data, arrowMetaFileOffset);
                            arrowMetaFileOffset += result.data.length;
                            num_arrow_metaFile_data_recs_processed++;
                            console.log('atl06p cb arrowrec.data arrowCbNdx:',arrowCbNdx,' arrowMetaFile:', arrowMetaFile, 'arrowMetaFileOffset:', arrowMetaFileOffset, ' result.data:', result.data, ' result.data.length:', result.data.length, ' result:', result);
                        } else {
                            console.error('arrowMetaFile was not initialized.');
                        }
                    } else {
                        arrowDataFileOffset += result.data.length;
                        console.log('atl06p cb arrowrec.data arrowCbNdx:',arrowCbNdx,' BEFORE write arrowDataFileOffset:', arrowDataFileOffset,' type:', typeof result.data , ' result.data.length:', result.data.length, ' result:', result, ' is ArrayBuffer?:', (result.data instanceof ArrayBuffer || ArrayBuffer.isView(result.data)));
                        syncAccessHandle.write(new Uint8Array(result.data), { at: arrowMetaFileOffset });
                        syncAccessHandle.flush();
                        num_arrow_dataFile_data_recs_processed++;
                        console.warn('atl06p cb arrowrec.data arrowCbNdx:',arrowCbNdx, 'AFTER write arrowDataFileOffset:', arrowDataFileOffset);
                    }
                    await checkDoneProcessing(  reqID, 
                                                read_state, 
                                                num_svr_exceptions, 
                                                num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed,
                                                num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed, 
                                                target_numSvrExceptions,
                                                target_numArrowDataRecs,
                                                target_numArrowMetaRecs);
                },
                exceptrec: async (result:any) => {
                    num_svr_exceptions++;
                    console.log('atl06p cb exceptrec result:', result);
                    if (abortRequested) {
                        console.log('Processing aborted.');
                        return; // Stop processing when abort is requested
                    }

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
                            const msg =  `RTE_TIMEOUT Received ${num_svr_exceptions}/${target_numSvrExceptions} exceptions.`;
                            postMessage(await progressMsg(reqID, 
                                            {   
                                                read_state:read_state,
                                                target_numSvrExceptions:target_numSvrExceptions,
                                                numSvrExceptions:num_svr_exceptions,
                                                target_numArrowDataRecs:target_numArrowDataRecs,
                                                numArrowDataRecs:num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed,
                                                target_numArrowMetaRecs:target_numArrowMetaRecs,
                                                numArrowMetaRecs:num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed
                                            },
                                            msg));
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
                    console.log( 'num_svr_exceptions:', num_svr_exceptions, 'num_arrow_data_recs_processed:',num_arrow_dataFile_data_recs_processed, 'num_arrow_meta_recs_processed:',num_arrow_metaFile_meta_recs_processed, 'num_checks:', num_checks, 'num_post_done_checks:', num_post_done_checks );
                    if(num_svr_exceptions > exceptionsProgThresh){
                        exceptionsProgThresh = num_svr_exceptions + exceptionsProgThreshInc;
                        const msg =  `Received ${num_svr_exceptions}/${target_numSvrExceptions} exceptions.`;
                        postMessage(await progressMsg(reqID, 
                                        {
                                            read_state:read_state,
                                            target_numSvrExceptions:target_numSvrExceptions,
                                            numSvrExceptions:num_svr_exceptions,
                                            target_numArrowDataRecs:target_numArrowDataRecs,
                                            numArrowDataRecs:num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed,
                                            target_numArrowMetaRecs:target_numArrowMetaRecs,
                                            numArrowMetaRecs:num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed
                                        },
                                        msg));
                        console.log(msg);
                    }
                    await checkDoneProcessing(  reqID, 
                                                read_state, 
                                                num_svr_exceptions, 
                                                num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed,
                                                num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed, 
                                                target_numSvrExceptions,
                                                target_numArrowDataRecs,
                                                target_numArrowMetaRecs);
                    //console.log('exceptrec  num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
                },
                eventrec: (result:any) => {
                    //console.log('atl06p cb eventrec result (DEPRECATED):', result);
                    if (abortRequested) {
                        console.log('Processing aborted.');
                        return; // Stop processing when abort is requested
                    }
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
                                                    target_numSvrExceptions:target_numSvrExceptions,
                                                    numSvrExceptions:num_svr_exceptions,
                                                    target_numArrowDataRecs:target_numArrowDataRecs,
                                                    numArrowDataRecs:num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed,
                                                    target_numArrowMetaRecs:target_numArrowMetaRecs,
                                                    numArrowMetaRecs:num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed
                                                },
                                                `Starting to read ${cmd.func} data.`
                                            ));
                    if(cmd.func){
                        let result:Sr_Results_type = {} as Sr_Results_type; 
                        try{  
                            if(cmd.func.includes('atl06')){  
                                result = await atl06(cmd.parameters as AtlpReqParams,callbacks);
                            } else if(cmd.func.includes('atl03')){
                                result = await atl03(cmd.parameters as AtlpReqParams,callbacks);
                            } else {
                                console.error('Unknown cmd.func provided');
                                postMessage(await errorMsg(reqID, { type: 'runWorkerError', code: 'WEBWORKER', message: 'Unknown cmd.func provided' }));
                            }
                            if(result){
                                read_result = result as Sr_Results_type;
                                target_numSvrExceptions = 'exceptrec' in read_result ? Number(read_result['exceptrec']) : 0;
                                target_numArrowDataRecs = 'arrowrec.data' in read_result ? Number(read_result['arrowrec.data']) : 0;
                                target_numArrowMetaRecs = 'arrowrec.meta' in read_result ? Number(read_result['arrowrec.meta']) : 0;
                                console.log(cmd.func,'  Done Reading result:', read_result, 'target_numSvrExceptions:', target_numSvrExceptions, 'target_numArrowDataRecs:', target_numArrowDataRecs, 'target_numArrowMetaRecs:', target_numArrowMetaRecs);
                            }
                            console.log(cmd.func,'  Done Reading: result:', result);
                            const msg =  `Done Reading; received  ${num_svr_exceptions}/${target_numSvrExceptions} exceptions. num_arrow_data_recs:${num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed} num_arrow_meta_recs:${num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed}.`;

                            read_state = 'done_reading';
                            postMessage(await progressMsg(reqID, 
                                                            {
                                                                read_state:read_state,
                                                                target_numSvrExceptions:target_numSvrExceptions,
                                                                numSvrExceptions:num_svr_exceptions,
                                                                target_numArrowDataRecs:target_numArrowDataRecs,
                                                                numArrowDataRecs:num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed,
                                                                target_numArrowMetaRecs:target_numArrowMetaRecs,
                                                                numArrowMetaRecs:num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed
                                                            },
                                                            msg,
                                                        ));
                            exceptionsProgThreshInc = Math.floor(target_numSvrExceptions/10);
                            let num_retries_left = 3;
                            let gotit = false;
                            while((num_retries_left > 0) && (target_numArrowDataRecs>0)){
                                console.log('Waiting for final CBs num_retries_left:', num_retries_left, 'target_numArrowDataRecs:', target_numArrowDataRecs, 'num_arrow_dataFile_data_recs_processed:', num_arrow_dataFile_data_recs_processed, 'num_arrow_metaFile_data_recs_processed:', num_arrow_metaFile_data_recs_processed);
                                if(num_arrow_dataFile_data_recs_processed === target_numArrowDataRecs){
                                    gotit = true;
                                    break;
                                }
                                num_retries_left--;
                                await mysleep(1000);
                            } 
                            if(!gotit){
                                console.error('Failed to get all arrowrec.data CBs. num_retries_left:', num_retries_left, 'target_numArrowDataRecs:', target_numArrowDataRecs, 'num_arrow_dataFile_data_recs_processed:', num_arrow_dataFile_data_recs_processed, 'num_arrow_metaFile_data_recs_processed:', num_arrow_metaFile_data_recs_processed);
                            }
                            console.log('FINAL target_numArrowDataRecs:', target_numArrowDataRecs, 'num_arrow_dataFile_data_recs_processed:', num_arrow_dataFile_data_recs_processed, 'num_arrow_metaFile_data_recs_processed:', num_arrow_metaFile_data_recs_processed);
                            // Log the result to the console
                            console.log('Done - req_id:', reqID);
                            console.log('req_id:',reqID, 'num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
                        } catch (error) {
                            read_state = 'error';
                            postMessage(await progressMsg(reqID, 
                                {
                                    read_state:read_state,
                                    target_numSvrExceptions:target_numSvrExceptions,
                                    numSvrExceptions:num_svr_exceptions,
                                    target_numArrowDataRecs:target_numArrowDataRecs,
                                    numArrowDataRecs:num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed,
                                    target_numArrowMetaRecs:target_numArrowMetaRecs,
                                    numArrowMetaRecs:num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed
                                },
                                'Error occurred while reading ATL0n data.'
                                ));
                            console.log(cmd.func,'  Error = ', error);
                            let emsg = '';
                            emsg = String(error);
                            let code = '';
                            //console.warn('Error:', error);
                            //console.warn('emsg:', emsg);
                            if(emsg.includes("SlideRuleError")){
                                code = 'SLIDERULE';
                            } else {
                                if (navigator.onLine) {
                                    code = 'NETWORK';
                                    emsg = 'Network error: Possible DNS resolution issue or server down.';
                                } else {
                                    code = 'OFFLINE';
                                    emsg = 'Network error: your browser appears to be/have been offline.';
                                }
                            }
                            if(emsg !== '') {
                                console.error(cmd.func,'  Error = ', emsg);
                            }
                            postMessage(await errorMsg(reqID, { type: 'NetworkError', code: code, message: emsg }));
                        } finally {
                            if(reqID){
                                console.log('finally req_id:',reqID, ' updating stats');
                                // Wait for all transaction promises to complete
                                console.log('finally num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
                            } else {
                                console.error('finally req_id was undefined?');
                                await errorMsg(reqID, { type: 'runWorkerError', code: 'WEBWORKER', message: 'reqID was undefined' });
                            }
                            if(arrowMetaFileOffset > 0){
                                // Convert schema Uint8Array to JSON string
                                const jsonString = new TextDecoder().decode(arrowMetaFile);
                                console.log('finally arrowMetaFile jsonString:', jsonString);
                            } else {
                                console.log('finally No arrowMetaFile records were processed.');
                            }
                            console.log('finally req:',req,'outputFormat:', outputFormat, 'arrowDataFileOffset:', arrowDataFileOffset);

                            if(arrowDataFileOffset > 0){
                                console.log('finally fileName:', fileName, "size:",syncAccessHandle.getSize(), "offset:", arrowDataFileOffset);
                            } else {
                                console.error('finally No arrow Data File data records were processed.');
                            }
                            await checkDoneProcessing(reqID, 
                                                        read_state, 
                                                        num_svr_exceptions, 
                                                        num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed,
                                                        num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed, 
                                                        target_numSvrExceptions,
                                                        target_numArrowDataRecs,
                                                        target_numArrowMetaRecs);
                        }
                    } else {
                        console.error('cmd.func was not provided');
                        postMessage(await errorMsg(reqID, { type: 'runWorkerError', code: 'WEBWORKER', message: 'cmd.func was not provided' }));
                    }
                } else {

                    console.error('cmd.parameters was undefined');
                    postMessage(await errorMsg(reqID, { type: 'runWorkerError', code: 'WEBWORKER', message: 'cmd.parameters was undefined' }));
                }
            } else {
                console.error('reqID was undefined');
                postMessage(await errorMsg(reqID, { type: 'runWorkerError', code: 'WEBWORKER', message: 'reqID was undefined' }));
            }
        } else {
            console.error('runAtl06 req_id was undefined');
            postMessage(await errorMsg(0, { type: 'runWorkerError', code: 'WEBWORKER', message: 'req_id was undefined' }));
        }
    } catch (error: any) {
        console.error('runWorkerError = ', error);
        postMessage(await errorMsg(0, { type: 'runWorkerError', code: 'WEBWORKER', message: 'an Unknown error has occured' }));
    }
};