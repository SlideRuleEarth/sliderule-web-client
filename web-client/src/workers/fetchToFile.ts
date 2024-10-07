import { db } from "@/db/SlideRuleDb";
import { atlxx } from '@/sliderule/icesat2';
import { type AtlxxReqParams,type AtlReqParams } from '@/sliderule/icesat2';
import { type WebWorkerCmd, opfsReadyMsg } from '@/workers/workerUtils';
import { get_num_defs_fetched, get_num_defs_rd_from_cache, type Sr_Results_type} from '@/sliderule/core';
import { init } from '@/sliderule/core';
import { abortedMsg,progressMsg,serverMsg,startedMsg,errorMsg,successMsg} from '@/workers/workerUtils';

let target_numSvrExceptions = 0;
let target_numArrowDataRecs = 0;
let target_numArrowMetaRecs = 0;
let target_numEOFRecs = 0;
let got_all_cbs = false;
let abortRequested = false;
let num_checks = 0;
let num_post_done_checks = 0;


export async function checkDoneProcessing(  thisReqID:number,
                                            syncAccessHandle:any, 
                                            read_state:string, 
                                            num_svr_exceptions:number, 
                                            num_arrow_data_recs_processed:number,
                                            num_arrow_meta_recs_processed:number): Promise<void>{
    num_checks++;
    if(!thisReqID || (thisReqID <= 0)){
        const emsg = `checkDoneProcessing: Invalid req_id:${thisReqID}`;
        console.error(emsg);
        throw new Error(emsg);
    }
    //console.log('checkDoneProcessing num_checks:', num_checks, 'num_post_done_checks:', num_post_done_checks, 'read_state:', read_state, 'abortRequested:', abortRequested, 'thisReqID:', thisReqID, 'num_svr_exceptions:', num_svr_exceptions, 'num_arrow_data_recs_processed:', num_arrow_data_recs_processed, 'num_arrow_meta_recs_processed:', num_arrow_meta_recs_processed, 'target_numSvrExceptions:', target_numSvrExceptions, 'target_numArrowDataRecs:', target_numArrowDataRecs, 'target_numArrowMetaRecs:', target_numArrowMetaRecs)
    if((read_state === 'done_reading') || (read_state === 'error') || abortRequested){
        num_post_done_checks++;
        console.log('checkDoneProcessing num_checks:', num_checks, 'num_post_done_checks:', num_post_done_checks, 'read_state:', read_state, 'abortRequested:', abortRequested, 'thisReqID:', thisReqID, 'num_svr_exceptions:', num_svr_exceptions, 'num_arrow_data_recs_processed:', num_arrow_data_recs_processed, 'num_arrow_meta_recs_processed:', num_arrow_meta_recs_processed, 'target_numSvrExceptions:', target_numSvrExceptions, 'target_numArrowDataRecs:', target_numArrowDataRecs, 'target_numArrowMetaRecs:', target_numArrowMetaRecs)
        if(got_all_cbs || abortRequested){
            let status_details = 'No data returned from SlideRule.';
            if( (target_numArrowDataRecs > 0) || (target_numArrowMetaRecs > 0) || (target_numSvrExceptions > 0)){
                status_details = `Received tgt arrow.data:${target_numArrowDataRecs} tgt arrow.meta:${target_numArrowMetaRecs} tgt Exceptions: ${target_numSvrExceptions}  arrow.data:${num_arrow_data_recs_processed} arrow.meta:${num_arrow_meta_recs_processed}  exceptions:${num_svr_exceptions} num_checks:${num_checks} num_post_done_checks:${num_post_done_checks}`;
            }
            let msg='';
            if(abortRequested){ // Abort requested
                msg = `checkDoneProcessing: Aborted processing req_id: ${thisReqID}`
            } else {
                msg = `checkDoneProcessing: Successfully finished reading/writing req_id: ${thisReqID} read_state:${read_state}`;
                if(read_state === 'done_reading'){
                    console.log('Success:', status_details, 'req_id:', thisReqID, 'num_checks:', num_checks);
                    postMessage(await successMsg(thisReqID, msg));
                }
            }
            read_state = 'done';
            syncAccessHandle.close();
            const fileName = await db.getFilename(thisReqID);
            postMessage(opfsReadyMsg(thisReqID, fileName));
            console.log(msg);
        } else {
            console.warn('Not Done yet - checkDoneProcessing num_checks:', num_checks, 'num_post_done_checks:', num_post_done_checks, 'read_state:', read_state, 'abortRequested:', abortRequested, 'thisReqID:', thisReqID, 'num_svr_exceptions:', num_svr_exceptions, 'num_arrow_data_recs_processed:', num_arrow_data_recs_processed, 'num_arrow_meta_recs_processed:', num_arrow_meta_recs_processed, 'target_numSvrExceptions:', target_numSvrExceptions, 'target_numArrowDataRecs:', target_numArrowDataRecs, 'target_numArrowMetaRecs:', target_numArrowMetaRecs)
        }
    }
}


function mysleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

onmessage = async (event) => {
    try{
        console.log('fetchToFile worker received event:', event.data)

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
        let num_EOF_recs_processed = 0;
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

        const outputFormat = req.parms.output?.format;
        const opfsRoot = await navigator.storage.getDirectory();
        const folderName = 'SlideRule'; 
        const directoryHandle = await opfsRoot.getDirectoryHandle(folderName, { create: true });
        const fileName = `${cmd.func}_${reqID}_${new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-').replace(/T/g, '-').replace(/Z/g, '')}.parquet`;
        console.log(cmd.func,' arrowCbNdx:',arrowCbNdx,' fileName:', fileName, ' outputFormat:', outputFormat, ' opfsRoot:', opfsRoot, 'req', req);

        const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
        console.log(cmd.func,' arrowCbNdx:',arrowCbNdx,' fileName:', fileName, ' fileHandle:', fileHandle);
        const syncAccessHandle = await (fileHandle as any).createSyncAccessHandle();
        console.log(cmd.func,' arrowCbNdx:',arrowCbNdx,' fileName:', fileName, ' syncAccessHandle:', syncAccessHandle);
        await db.updateRequestRecord( {req_id:reqID, file:fileName});

        if((reqID) && (reqID > 0)){
            num_checks = 0;
            startedMsg(reqID,req);
            const callbacks = {
                'arrowrec.meta': async (result:any) => {
                    arrowCbNdx++;
                    console.log('arrowrec.meta arrowCbNdx:',arrowCbNdx,' result.filename:', result.filename, ' result:', result);
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
                        console.log('arrowrec.meta (for _metadata.json) arrowCbNdx:',arrowCbNdx,' arrowMetaFilename:', arrowMetaFilename, ' arrowMetaFileSize:', arrowMetaFileSize, 'arrowDataFileOffset:', arrowDataFileOffset, ' num_arrow_metaFile_meta_recs_processed:', num_arrow_metaFile_meta_recs_processed);
                        console.log(' ------- RESETTING arrowMetaFileOffset ------- ')
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
                        console.log('arrowrec.meta (for datafile) arrowCbNdx:',arrowCbNdx,' arrowDataFilename:', arrowDataFilename, ' arrowDataFileSize:', arrowDataFileSize, 'arrowDataFileOffset:', arrowDataFileOffset, ' num_arrow_dataFile_meta_recs_processed:', num_arrow_dataFile_meta_recs_processed);
                        console.log(' ------- RESETTING arrowDataFileOffset ------- ')
                    }
                },
                'arrowrec.data': async (result:any) => {
                    arrowCbNdx++;
                    console.log('arrowrec.data arrowCbNdx:',arrowCbNdx,' result:', result);
                    if (abortRequested) {
                        console.log('Processing aborted.');
                        return; // Stop processing when abort is requested
                    }
                    if(result.filename.includes('_metadata.json')){
                        if(arrowMetaFile){
                            arrowMetaFile.set(result.data, arrowMetaFileOffset);
                            arrowMetaFileOffset += result.data.length;
                            num_arrow_metaFile_data_recs_processed++;
                            console.log('arrowrec.data (_metadata.json) arrowCbNdx:',arrowCbNdx,' arrowMetaFile:', arrowMetaFile, 'arrowMetaFileOffset:', arrowMetaFileOffset, ' result.data:', result.data, ' result.data.length:', result.data.length, ' result:', result);
                        } else {
                            console.error('arrowMetaFile was not initialized.');
                        }
                    } else {
                        console.log('arrowrec.data arrowCbNdx:',arrowCbNdx,' BEFORE write arrowDataFileOffset:', arrowDataFileOffset,' type:', typeof result.data , ' result.data.length:', result.data.length, ' result:', result, ' is ArrayBuffer?:', (result.data instanceof ArrayBuffer || ArrayBuffer.isView(result.data)));
                        // const buf = new Uint8Array(result.data.length);
                        // buf.set(new Uint8Array(result.data));
                        // const num_bytes = syncAccessHandle.write(buf, { at: arrowMetaFileOffset });
                        const num_bytes = syncAccessHandle.write(new Uint8Array(result.data), { at: arrowDataFileOffset });
                        syncAccessHandle.flush();
                        arrowDataFileOffset += result.data.length;
                        num_arrow_dataFile_data_recs_processed++;
                        console.log('arrowrec.data arrowCbNdx:',arrowCbNdx, 'AFTER write arrowDataFileOffset:', arrowDataFileOffset,' num_bytes:', num_bytes, ' result.data.length:', result.data.length);
                        if (num_bytes !== result.data.length) {
                            console.error('Failed to write all bytes to file. num_bytes:', num_bytes, ' result.data.length:', result.data.length);
                            throw new Error('Failed to write all bytes to file.');
                        }
                        await db.updateRequestRecord( {req_id:reqID, num_bytes: arrowDataFileOffset});
                    }
                    await checkDoneProcessing(  reqID,                                                         
                                                syncAccessHandle, 
                                                read_state, 
                                                num_svr_exceptions, 
                                                num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed,
                                                num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed);
                },
                'arrowrec.eof': async (result:any) => {
                    arrowCbNdx++;
                    //console.log('arrowrec.eof arrowCbNdx:',arrowCbNdx,' result:', result);
                    await db.updateRequestRecord( {req_id:reqID, status: 'Success',status_details: 'EOF checksum present.',checksum: result.checksum});
                    num_EOF_recs_processed++;
                },
                exceptrec: async (result:any) => {
                    //console.log('exceptrec result:', result);
                    if (abortRequested) {
                        console.log('Processing aborted.');
                        return; // Stop processing when abort is requested
                    }

                    switch(result.code){
                        case 0: // RTE_INFO
                        {
                            postMessage(await serverMsg(reqID, `RTE_INFO msg: ${result.text}`));
                            break;
                        }
                        case -1: // RTE_ERROR
                        {
                            //console.warn('RTE_ERROR: exceptrec result:', result.text);
                            postMessage(await serverMsg(reqID, `RTE_ERROR msg:${result.text}`));
                            break;
                        }
                        case -2: // RTE_TIMEOUT
                        {
                            //console.warn('RTE_TIMEOUT: exceptrec result:', result.text);
                            postMessage(await serverMsg(reqID,`RTE_TIMEOUT msg: ${result.text}`));
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
                            //console.log(msg);
                            break;
                        }
                        case -3: // RTE_RESOURCE_DOES_NOT_EXIST
                        {
                            //console.warn('RTE_RESOURCE_DOES_NOT_EXIST: exceptrec result:', result.text);
                            postMessage(await serverMsg(reqID, `RTE_RESOURCE_DOES_NOT_EXIST msg:${result.text}`));
                            break;
                        }
                        case -4: // RTE_EMPTY_SUBSET
                        {
                            //console.warn('RTE_EMPTY_SUBSET: exceptrec result:', result.text);
                            postMessage(await serverMsg(reqID, `RTE_EMPTY_SUBSET msg:${result.text}`));
                            break;
                        }
                        case -5: // RTE_SIMPLIFY
                        {
                            //console.warn('RTE_SIMPLIFY: exceptrec result:', result.text);
                            postMessage(await serverMsg(reqID, `RTE_SIMPLIFY msg:${result.text}`));
                            break;
                        }
                    }
                    //console.log( 'num_svr_exceptions:', num_svr_exceptions, 'num_arrow_data_recs_processed:',num_arrow_dataFile_data_recs_processed, 'num_arrow_meta_recs_processed:',num_arrow_metaFile_meta_recs_processed, 'num_checks:', num_checks, 'num_post_done_checks:', num_post_done_checks );
                    num_svr_exceptions++;
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
                        //console.log(msg);
                    }
                    await checkDoneProcessing(  reqID,
                                                syncAccessHandle,
                                                read_state, 
                                                num_svr_exceptions, 
                                                num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed,
                                                num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed);
                    //console.log('exceptrec  num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
                },
                eventrec: (result:any) => {
                    //console.log('eventrec result (DEPRECATED):', result);
                    if (abortRequested) {
                        console.log('Processing aborted.');
                        return; // Stop processing when abort is requested
                    }
                    postMessage(serverMsg(reqID, `eventrec server msg (DEPRECATED): ${result.attr}`));
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
                            console.log('Fetching:', cmd.func, ' for reqID:', reqID, ' with cmd.parameters:', cmd.parameters, ' using callbacks:', callbacks);  
                            if(got_all_cbs){
                                console.warn("&&&&&&&&&&&&&&&&&&&& STATE ERROR &&&&&&&&&&&&&&&&&&&");
                            }
                            got_all_cbs = false;
                            result = await atlxx(cmd.func as string, cmd.parameters as AtlxxReqParams,callbacks);

                            if(result){
                                read_result = result as Sr_Results_type;
                                target_numSvrExceptions = 'exceptrec'       in read_result ? Number(read_result['exceptrec']) : 0;
                                target_numArrowDataRecs = 'arrowrec.data'   in read_result ? Number(read_result['arrowrec.data']) : 0;
                                target_numArrowMetaRecs = 'arrowrec.meta'   in read_result ? Number(read_result['arrowrec.meta']) : 0;
                                target_numEOFRecs       = 'arrowrec.eof'    in read_result ? Number(read_result['arrowrec.eof']) : 0;
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
                            let num_retries_left = 10; // TBD use configured timeout from params
                            got_all_cbs = false;
                            while((num_retries_left > 0) && (target_numArrowDataRecs>0)){
                                console.log('Waiting for final CBs num_retries_left:', num_retries_left, 'target_numArrowDataRecs:', target_numArrowDataRecs, 'num_arrow_dataFile_data_recs_processed:', num_arrow_dataFile_data_recs_processed, 'num_arrow_metaFile_data_recs_processed:', num_arrow_metaFile_data_recs_processed);
                                if(
                                    ((num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed) === target_numArrowDataRecs) &&
                                    ((num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed) === target_numArrowMetaRecs) &&
                                    (num_svr_exceptions === target_numSvrExceptions) && 
                                    (num_EOF_recs_processed === target_numEOFRecs)
                                ){
                                    console.log('++++ Got all CBs. num_retries_left:', num_retries_left, 'target_numArrowDataRecs:', target_numArrowDataRecs, 'num_arrow_dataFile_data_recs_processed:', num_arrow_dataFile_data_recs_processed, 'num_arrow_metaFile_data_recs_processed:', num_arrow_metaFile_data_recs_processed);
                                    got_all_cbs = true;
                                    break;
                                } else {
                                    console.log('**** Waiting for final CBs num_retries_left:', num_retries_left, 'target_numArrowDataRecs:', target_numArrowDataRecs, 'num_arrow_dataFile_data_recs_processed:', num_arrow_dataFile_data_recs_processed, 'num_arrow_metaFile_data_recs_processed:', num_arrow_metaFile_data_recs_processed);
                                    console.log('**** Waiting for final CBs num_retries_left:', num_retries_left, 'target_numArrowMetaRecs:', target_numArrowMetaRecs, 'num_arrow_dataFile_meta_recs_processed:', num_arrow_dataFile_meta_recs_processed, 'num_arrow_metaFile_meta_recs_processed:', num_arrow_metaFile_meta_recs_processed);
                                    console.log('**** Waiting for final CBs num_retries_left:', num_retries_left, 'target_numSvrExceptions:', target_numSvrExceptions, 'num_svr_exceptions:', num_svr_exceptions);
                                }
                                num_retries_left--;
                                await mysleep(1000);
                            } 
                            if(!got_all_cbs){
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
                                //console.log('finally req_id:',reqID, ' updating stats');
                                // Wait for all transaction promises to complete
                                //console.log('finally num_defs_fetched:',get_num_defs_fetched(),' get_num_defs_rd_from_cache:',get_num_defs_rd_from_cache());
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
                                console.log('finally fileName:', fileName, "offset:", arrowDataFileOffset);
                            } else {
                                console.error('finally No arrow Data File data records were processed.');
                            }
                            await checkDoneProcessing(  reqID,
                                                        syncAccessHandle, 
                                                        read_state, 
                                                        num_svr_exceptions, 
                                                        num_arrow_dataFile_data_recs_processed+num_arrow_metaFile_data_recs_processed,
                                                        num_arrow_dataFile_meta_recs_processed+num_arrow_metaFile_meta_recs_processed);
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