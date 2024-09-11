import { type SrRequestRecord } from '@/db/SlideRuleDb';
import { updateElevationForReqId } from '@/utils/SrParquetUtils';
import { useSysConfigStore} from "@/stores/sysConfigStore";
import { type TimeoutHandle } from '@/stores/mapStore';    
import { useCurReqSumStore } from "@/stores/curReqSumStore";
import { useMapStore } from '@/stores/mapStore';
import { useRequestsStore } from "@/stores/requestsStore";
import { useReqParamsStore } from "@/stores/reqParamsStore";
import { useSrToastStore } from "@/stores/srToastStore";
import { db } from '@/db/SlideRuleDb';
import type { WorkerMessage, WorkerSummary, WebWorkerCmd } from '@/workers/workerUtils';
import { useSrSvrConsoleStore } from '@/stores/SrSvrConsoleStore';
import { duckDbLoadOpfsParquetFile } from '@/utils/SrDuckDbUtils';

const consoleStore = useSrSvrConsoleStore();
const sysConfigStore = useSysConfigStore();
const curReqSumStore = useCurReqSumStore();
const mapStore = useMapStore();
const requestsStore = useRequestsStore();
const reqParamsStore = useReqParamsStore();

let worker: Worker | null = null;
let workerTimeoutHandle: TimeoutHandle | null = null; // Handle for the timeout to clear it when necessary
let percentComplete: number | null = null;

function startFetchToFileWorker(){
    worker =  new Worker(new URL('../workers/fetchToFile', import.meta.url), { type: 'module' }); // new URL must be inline? per documentation: https://vitejs.dev/guide/features.html#web-workers
    const timeoutDuration = reqParamsStore.totalTimeoutValue*1000; // Convert to milliseconds
    console.log('runFetchToFileWorker with timeoutDuration:',timeoutDuration, ' milliseconds redraw Elevations every:',mapStore.redrawTimeOutSeconds, ' seconds');
    workerTimeoutHandle = setTimeout(() => {
        if (worker) {
            const msg = `Timeout: Worker operation timed out in:${timeoutDuration} secs`;
            console.error(msg); // add thirty seconds to the timeout to let server timeout first
            //toast.add({ severity: 'info', summary: 'Timeout', detail: msg, life: srToastStore.getLife() });
            useSrToastStore().info('Timeout',msg);
            cleanUpWorker();
            worker = null;
        }
    }, timeoutDuration);
    reqParamsStore.using_worker = true;
    return worker;
} 

const handleWorkerMsg = async (workerMsg:WorkerMessage) => {
    //console.log('handleWorkerMsg workerMsg:',workerMsg);
    let fileName:string;
    let successMsg:string;
    switch(workerMsg.status){
        case 'success':
            console.log('handleWorkerMsg success:',workerMsg.msg);
            if(curReqSumStore.getNumArrowDataRecs() > 0){
                successMsg = `File created from ${curReqSumStore.getNumArrowDataRecs()} arrow Records .\n Click on Analysis button to plot elevation of individual tracks.`;
                useSrToastStore().success('Success',successMsg);
            } else {
                successMsg = 'File created with no arrow Records. Adjust your parameters or region and try again.';
                useSrToastStore().warn('No data found',successMsg);
            }
           break;
        case 'started':
            console.log('handleWorkerMsg started');
            useSrToastStore().info('Started',workerMsg.msg);
            break;
        case 'aborted':
            console.log('handleWorkerMsg aborted');
            useSrToastStore().warn('Aborted',workerMsg.msg);
            requestsStore.setConsoleMsg('Job aborted');
            cleanUpWorker();
            break;
        case 'server_msg':
            //console.log('handleWorkerMsg server_msg:',workerMsg.msg);
            if(workerMsg.msg){
                consoleStore.addLine(workerMsg.msg);
            }
            if(workerMsg.msg){
                requestsStore.setSvrMsg(workerMsg.msg);
                percentComplete = parseCompletionPercentage(workerMsg.msg);
                if (percentComplete !== null) {
                    curReqSumStore.setPercentComplete(percentComplete);
                } 
            }
            break;
        case 'progress':
            //console.log('handleWorkerMsg progress:',workerMsg.progress);
            if(workerMsg.progress){
                curReqSumStore.setReadState(workerMsg.progress.read_state);
                curReqSumStore.setNumExceptions(workerMsg.progress.numSvrExceptions);
                curReqSumStore.setTgtExceptions(workerMsg.progress.target_numSvrExceptions);
                curReqSumStore.setNumArrowDataRecs(workerMsg.progress.numArrowDataRecs);
                curReqSumStore.setTgtArrowDataRecs(workerMsg.progress.target_numArrowDataRecs);
                curReqSumStore.setNumArrowMetaRecs(workerMsg.progress.numArrowMetaRecs);
                curReqSumStore.setTgtArrowMetaRecs(workerMsg.progress.target_numArrowMetaRecs);

                if(workerMsg.msg){
                    requestsStore.setSvrMsg(workerMsg.msg);
                    requestsStore.setConsoleMsg(`Received ${workerMsg.progress.numArrowDataRecs} arrowData records`);
                }
            }
            break;
        case 'summary':
            console.log('handleWorkerMsg summary:',workerMsg);
            if(workerMsg){
                const sMsg = workerMsg as WorkerSummary;
                curReqSumStore.setSummary(sMsg);
            }
            break;
        case 'error':
            if(workerMsg.error){
                console.error('handleWorkerMsg error:',workerMsg.error);
                //toast.add({severity: 'error',summary: workerMsg.error?.type, detail: workerMsg.error?.message, life: srToastStore.getLife() });
                useSrToastStore().error(workerMsg.error?.type,workerMsg.error?.message);
            }
            if(worker){
                cleanUpWorker();
            }
            console.log('Error... isLoading:',mapStore.isLoading);
            break;

        case 'opfs_ready':
            console.log('handleWorkerMsg opfs_ready for req_id:',workerMsg.req_id);
            try {
                if(workerMsg?.req_id > 0){
                    fileName = await db.getFilename(workerMsg.req_id);
                    await duckDbLoadOpfsParquetFile(fileName);
                    await updateElevationForReqId(workerMsg.req_id);
                } else {
                    console.error('handleWorkerMsg opfs_ready req_id is undefined or 0');
                }
            } catch (error) {
                console.error('handleWorkerMsg opfs_ready error:',error);
                useSrToastStore().error('Error','Error loading file');
            }
            if(worker){
                cleanUpWorker();
            }
            break;

        default:
            console.error('handleWorkerMsg unknown status?:',workerMsg.status);
            break;
    }     
}

const handleWorkerMsgEvent = async (event: MessageEvent) => {
    if(worker){
        const workerMsg:WorkerMessage = event.data;
        handleWorkerMsg(workerMsg);
    } else {
        console.error('handleWorkerMsgEvent: worker was undefined?');
    }
}

export function processAbortClicked() {
    if(worker){
        mapStore.isAborting = true; 
        const cmd = {type:'abort',req_id:mapStore.currentReqId} as WebWorkerCmd;
        worker.postMessage(JSON.stringify(cmd));
        console.log('abortClicked isLoading:',mapStore.isLoading);
        requestsStore.setConsoleMsg('Abort Clicked');
        useSrToastStore().info('Abort Clicked','Aborting request');
    } else {
        //toast.add({severity: 'error',summary: 'Error', detail: 'Worker was undefined', life: srToastStore.getLife() });
        useSrToastStore().error('Error','Worker was undefined');
        console.error('abortClicked worker was undefined');
        useRequestsStore().setConsoleMsg('Abort Clicked');
    }
    mapStore.isLoading = false; // controls spinning progress
}

function handleWorkerError(error:ErrorEvent, errorMsg:string) {
    console.error('Error:', error);
    //toast.add({ severity: 'error', summary: 'Error', detail: errorMsg, life: srToastStore.getLife() });
    useSrToastStore().error('Error',errorMsg);
    cleanUpWorker();
}



function cleanUpWorker(){
    //mapStore.unsubscribeLiveElevationQuery();
    if (workerTimeoutHandle) {
        clearTimeout(workerTimeoutHandle);
        workerTimeoutHandle = null;
    }        
    if(worker){
        worker.terminate();
        worker = null;
    }

    //mapStore.clearRedrawElevationsTimeoutHandle();
    mapStore.isLoading = false; // controls spinning progress
    mapStore.isAborting = false;
    reqParamsStore.using_worker = false;
    console.log('cleanUpWorker -- isLoading:',mapStore.isLoading);
}

function parseCompletionPercentage(message: string): number | null {
    const regex = /\[(\d+) out of (\d+)\]/;
    const match = message.match(regex);

    if (match && match.length === 3) {
        const cnt = requestsStore.incrementSrMsgCnt();
        const completed = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);

        if (!isNaN(completed) && !isNaN(total) && total !== 0) {
            return (cnt / total) * 100;
        }
    }
    return null; // Return null if the message does not match the expected format or total is zero
}

async function runFetchToFileWorker(srReqRec:SrRequestRecord){
    try{
        //console.log('runFetchToFileWorker srReqRec:',srReqRec);
        if(srReqRec.req_id){
            await db.updateRequest(srReqRec.req_id,srReqRec); 
            mapStore.setCurrentReqId(srReqRec.req_id);
            mapStore.isLoading = true; // controls spinning progress
            worker = startFetchToFileWorker();
            worker.onmessage = handleWorkerMsgEvent;
            worker.onerror = (error) => {
                if(worker){
                    console.error('Worker error:', error);
                    handleWorkerError(error, 'Worker faced an unexpected error');
                    cleanUpWorker();
                }
            };
            const cmd = {type:'run',req_id:srReqRec.req_id, sysConfig: sysConfigStore.getSysConfig(), func:srReqRec.func, parameters:srReqRec.parameters} as WebWorkerCmd;
            worker.postMessage(JSON.stringify(cmd));
        } else {
            console.error('runFetchToFileWorker req_id is undefined');
            //toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
            useSrToastStore().error('Error','There was an error');
        }
    } catch (error) {
        console.error('runFetchToFileWorker error:',error);
        //toast.add({severity: 'error',summary: 'Error', detail: 'An error occurred running the worker', life: srToastStore.getLife() });
        useSrToastStore().error('Error','An error occurred running the worker');
    }
}

// Function that is called when the "Run SlideRule" button is clicked
export async function processRunSlideRuleClicked() {
    mapStore.isLoading = true;
    console.log('runSlideRuleClicked isLoading:',mapStore.isLoading);
    curReqSumStore.setNumExceptions(0);
    curReqSumStore.setTgtExceptions(0);
    curReqSumStore.setNumArrowDataRecs(0);
    curReqSumStore.setTgtArrowDataRecs(0);
    curReqSumStore.setNumArrowMetaRecs(0);
    curReqSumStore.setTgtArrowMetaRecs(0);
    requestsStore.setSvrMsgCnt(0);
    requestsStore.setSvrMsg('waiting...');
    curReqSumStore.setPercentComplete(0);

    if(!reqParamsStore.ignorePolygon && (reqParamsStore.poly === null || reqParamsStore.poly.length === 0)){
        console.warn('no geographic reqion defined');
        //toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
        useSrToastStore().error('Error','You must define a geographic region. Draw a poly (no bigger than a couple square miles) or upload a shapefile.');
        requestsStore.setConsoleMsg('You need to supply geographic region ...');
        mapStore.isLoading = false;
        return;
    }
    requestsStore.setConsoleMsg('Running...');
    const srReqRec = await requestsStore.createNewSrRequestRecord();
    if(srReqRec) {
        console.log('runSlideRuleClicked srReqRec:',srReqRec);
        if(!srReqRec.req_id) {
            console.error('runAtl06 req_id is undefined');
            //toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
            useSrToastStore().error('Error','There was an error');
            return;
        }

        if(useReqParamsStore().missionValue.value === 'ICESat-2') {
            if(useReqParamsStore().iceSat2SelectedAPI.value === 'atl06') {
                console.log('atl06 selected');
                srReqRec.func = 'atl06';
                srReqRec.parameters = reqParamsStore.getAtlpReqParams(srReqRec.req_id);
                srReqRec.start_time = new Date();
                srReqRec.end_time = new Date();
                runFetchToFileWorker(srReqRec);
            } else if(useReqParamsStore().iceSat2SelectedAPI.value === 'atl03') {
                console.log('atl03 selected');
                srReqRec.func = 'atl03';
                srReqRec.parameters = reqParamsStore.getAtlpReqParams(srReqRec.req_id);
                srReqRec.start_time = new Date();
                srReqRec.end_time = new Date();
                runFetchToFileWorker(srReqRec);
            } else if(useReqParamsStore().iceSat2SelectedAPI.value === 'atl08') {
                console.log('atl08 selected');
                srReqRec.func = 'atl08';
                srReqRec.parameters = reqParamsStore.getAtlpReqParams(srReqRec.req_id);
                srReqRec.start_time = new Date();
                srReqRec.end_time = new Date();
                runFetchToFileWorker(srReqRec);
            } else if(useReqParamsStore().iceSat2SelectedAPI.value === 'atl24') {
                console.log('atl24 TBD');
                //toast.add({severity: 'info',summary: 'Info', detail: 'atl24 TBD', life: srToastStore.getLife() });
                useSrToastStore().info('Info','atl24 is TBD');
                requestsStore.setConsoleMsg('stopped... atl24 TBD');
                mapStore.isLoading = false;
            } else {
                console.error('runSlideRuleClicked iceSat2SelectedAPI was undefined');
                useSrToastStore().warn('Unsupported','That selection is TBD');
                requestsStore.setConsoleMsg('stopped...');
                mapStore.isLoading = false;
            }
        } else if(useReqParamsStore().missionValue.value === 'GEDI') {
            console.log('GEDI TBD');
            useSrToastStore().info('Info','GEDI TBD');
        }
    } else {
        console.error('runSlideRuleClicked srReqRec was undefined');
        useSrToastStore().error('Error','There was an error');
        requestsStore.setConsoleMsg('stopped...');
        mapStore.isLoading = false;
    }
};
