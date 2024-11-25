import { type SrRequestRecord } from '@/db/SlideRuleDb';
import { checkAreaOfConvexHullError } from './SrMapUtils';
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
import { duckDbReadAndUpdateElevationData,duckDbReadAndUpdateSelectedLayer, duckDbReadOrCacheSummary } from '@/utils/SrDuckDbUtils';
import { duckDbLoadOpfsParquetFile } from '@/utils/SrDuckDbUtils';
import { findSrViewKey } from "@/composables/SrViews";
import { useJwtStore } from '@/stores/SrJWTStore';
import { type AtlxxReqParams } from '@/sliderule/icesat2';
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';

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
    const timeoutDuration = reqParamsStore.getWorkerThreadTimeout(); 
    console.log('startFetchToFileWorker with timeoutDuration:',timeoutDuration, ' milliseconds');
    workerTimeoutHandle = setTimeout(() => {
        if (worker) {
            const msg = `Timeout: Worker operation timed out in:${(timeoutDuration/1000)} secs`;
            console.error(msg); // added to the timeout to let server timeout first
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
    let numBytes:number;
    switch(workerMsg.status){
        case 'success':
            console.log('handleWorkerMsg success:',workerMsg.msg);
            numBytes = await db.getNumBytes(workerMsg.req_id);
            if(numBytes > 0){
                successMsg = `File created with ${numBytes} bytes.\n\nClick on Analysis button to plot elevation of individual tracks.`;
                useSrToastStore().success('Success',successMsg,15000); // 15 seconds
            } else {
                successMsg = 'File created with no data.\nAdjust your parameters or region and try again.';
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
                    const targetMsg = workerMsg.progress.target_numSvrExceptions ? `/${workerMsg.progress.target_numSvrExceptions}` : ''; 
                    requestsStore.setConsoleMsg(`Received ${workerMsg.progress.numSvrExceptions} ${targetMsg} exceptions`);
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
                    const serverReq = await duckDbLoadOpfsParquetFile(fileName);
                    await db.updateRequestRecord( {req_id:workerMsg.req_id, svr_parms: serverReq });
                    await duckDbReadAndUpdateElevationData(workerMsg.req_id);
            
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
        console.log('runFetchToFileWorker srReqRec:',srReqRec);
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
                    requestsStore.setConsoleMsg('Worker faced an unexpected error');
                    requestsStore.setSvrMsg('');
                }
            };
            let srJWT = useJwtStore().getJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization());
            let accessToken = '';
            if(srJWT){
                accessToken = srJWT.accessToken;
            }
            const cmd = {type:'run',req_id:srReqRec.req_id, sysConfig: {domain:sysConfigStore.getDomain(),organization:sysConfigStore.getOrganization(), jwt:accessToken}, func:srReqRec.func, parameters:srReqRec.parameters} as WebWorkerCmd;
            console.log('runFetchToFileWorker cmd:',cmd);
            worker.postMessage(JSON.stringify(cmd));
            const arp = srReqRec.parameters as AtlxxReqParams;
            if(arp.parms.poly){
                db.addOrUpdateOverlayByPolyHash(arp.parms.poly, {req_ids:[srReqRec.req_id]});
            }
        } else {
            console.error('runFetchToFileWorker req_id is undefined');
            //toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
            useSrToastStore().error('Error','There was an error');
            requestsStore.setConsoleMsg('There was an error');
            requestsStore.setSvrMsg('');
        }
    } catch (error) {
        console.error('runFetchToFileWorker error:',error);
        //toast.add({severity: 'error',summary: 'Error', detail: 'An error occurred running the worker', life: srToastStore.getLife() });
        useSrToastStore().error('Error','An error occurred running the worker');
        requestsStore.setConsoleMsg('There was an error');
        requestsStore.setSvrMsg('');
    }
}

// Function that is called when the "Run SlideRule" button is clicked
export async function processRunSlideRuleClicked() {

    if(!checkAreaOfConvexHullError()){
        return;
    }

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
        const srViewKey = findSrViewKey(useMapStore().selectedView, useMapStore().selectedBaseLayer);
        if(srViewKey.value){
            srReqRec.srViewName = srViewKey.value;
        } else {
            console.error('runSlideRuleClicked srViewKey was undefined');
            useSrToastStore().error('Error','There was an error. srViewKey was undefined');
            requestsStore.setConsoleMsg('stopped...');
            mapStore.isLoading = false;
            return;
        }
        if(useReqParamsStore().getMissionValue() === 'ICESat-2') {
            if((useReqParamsStore().getIceSat2API() !== undefined) || (useReqParamsStore().getIceSat2API() !== null) || (useReqParamsStore().getIceSat2API() !== '')){
                console.log('runSlideRuleClicked IceSat2API:',useReqParamsStore().getIceSat2API());
                srReqRec.func = useReqParamsStore().getIceSat2API();
                srReqRec.parameters = reqParamsStore.getAtlxxReqParams(srReqRec.req_id);

                if(srViewKey.value){
                    srReqRec.start_time = new Date();
                    srReqRec.end_time = new Date();
                    runFetchToFileWorker(srReqRec);
                } else {
                    console.error('runSlideRuleClicked srviewName was undefined');
                    useSrToastStore().error('Error','There was an error. srviewName was undefined');
                    requestsStore.setConsoleMsg('stopped...');
                    mapStore.isLoading = false;
                }
        } else {
                console.error('runSlideRuleClicked IceSat2API was undefined');
                useSrToastStore().error('Error','There was an error. IceSat2API was undefined');
                requestsStore.setConsoleMsg('stopped...');
                mapStore.isLoading = false;
            }
        } else if(useReqParamsStore().getMissionValue() === 'GEDI') {
            if(useReqParamsStore().getGediAPI() || (useReqParamsStore().getGediAPI() !== undefined) || (useReqParamsStore().getGediAPI() !== null) || (useReqParamsStore().getGediAPI() !== '')){
                console.log('runSlideRuleClicked GediAPI:',useReqParamsStore().getGediAPI());
                srReqRec.func = useReqParamsStore().getGediAPI();
                srReqRec.parameters = reqParamsStore.getAtlxxReqParams(srReqRec.req_id);
                srReqRec.start_time = new Date();
                srReqRec.end_time = new Date();
                runFetchToFileWorker(srReqRec);
            } else {
                console.error('runSlideRuleClicked GediAPI was undefined');
                useSrToastStore().error('Error','There was an error. GediAPI was undefined');
                requestsStore.setConsoleMsg('stopped...');
                mapStore.isLoading = false;
            }
        }
    } else {
        console.error('runSlideRuleClicked srReqRec was undefined');
        useSrToastStore().error('Error','There was an error');
        requestsStore.setConsoleMsg('stopped...');
        mapStore.isLoading = false;
    }
};
