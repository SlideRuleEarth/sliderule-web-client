import { type SrRequestRecord } from '@/db/SlideRuleDb';
import { readAndUpdateElevationData } from '@/utils/SrParquetUtils';
import { useSysConfigStore} from "@/stores/sysConfigStore";
import { type TimeoutHandle } from '@/stores/mapStore';    
import { useCurReqSumStore } from "@/stores/curReqSumStore";
import { useMapStore } from '@/stores/mapStore';
import { useRequestsStore } from "@/stores/requestsStore";
import { useReqParamsStore } from "@/stores/reqParamsStore";
import { useSrToastStore } from "@/stores/srToastStore";
import { db } from '@/db/SlideRuleDb';
import type { SopWorkerCmdMsg, SopWorkerRspMsg, FtfWorkerMessage, WorkerSummary, FtfWebWorkerCmd } from '@/workers/workerUtils';
import { useSrSvrConsoleStore } from '@/stores/SrSvrConsoleStore';
import { duckDbLoadOpfsParquetFile } from '@/utils/SrDuckDbUtils';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { shallowRef } from 'vue';

const consoleStore = useSrSvrConsoleStore();
const sysConfigStore = useSysConfigStore();
const curReqSumStore = useCurReqSumStore();
const mapStore = useMapStore();
const requestsStore = useRequestsStore();
const reqParamsStore = useReqParamsStore();
export const optionsRef = shallowRef();

let ftfWorker: Worker | null = null;
let sopWorker: Worker | null = null;
let ftfWorkerTimeoutHandle: TimeoutHandle | null = null; // Handle for the timeout to clear it when necessary
let sopWorkerTimeoutHandle: TimeoutHandle | null = null; // Handle for the timeout to clear it when necessary
let percentComplete: number | null = null;
let sopWorkerStartTime = performance.now();

function startFetchToFileWorker(){
    ftfWorker =  new Worker(new URL('../workers/fetchToFile', import.meta.url), { type: 'module' }); // new URL must be inline? per documentation: https://vitejs.dev/guide/features.html#web-workers
    const timeoutDuration = reqParamsStore.totalTimeoutValue*1000; // Convert to milliseconds
    console.log('runFetchToFileWorker with timeoutDuration:',timeoutDuration, ' milliseconds redraw Elevations every:',mapStore.redrawTimeOutSeconds, ' seconds for req_id:',curReqSumStore.req_id);
    ftfWorkerTimeoutHandle = setTimeout(() => {
        if (ftfWorker) {
            const msg = `Timeout: Worker operation timed out in:${timeoutDuration} secs`;
            console.error(msg); // add thirty seconds to the timeout to let server timeout first
            //toast.add({ severity: 'info', summary: 'Timeout', detail: msg, life: srToastStore.getLife() });
            useSrToastStore().info('Timeout',msg);
            cleanupFtfWorker();
            ftfWorker = null;
        }
    }, timeoutDuration);
    reqParamsStore.using_worker = true;
    return ftfWorker;
} 

export function startSopWorker(){
    console.log('startSopWorker');
    sopWorkerStartTime =  performance.now();
    sopWorker =  new Worker(new URL('../workers/optionsWorker', import.meta.url), { type: 'module' }); // new URL must be inline? per documentation: https://vitejs.dev/guide/features.html#web-workers
    const timeoutDuration = reqParamsStore.totalTimeoutValue*1000; // Convert to milliseconds
    sopWorker.onmessage = handleSopWorkerMsgEvent;
    sopWorker.onerror = (error) => {
        if(sopWorker){
            console.error('Worker error:', error);
            handleSopWorkerError(error, 'sop Worker faced an unexpected error');
            cleanupSopWorker();
        }
    };
    console.log('startSopWorker with timeoutDuration:',timeoutDuration, ' req_id:',curReqSumStore.req_id);
    sopWorkerTimeoutHandle = setTimeout(() => {
        if (sopWorker) {
            const msg = `Timeout: fetchScatterOptions Worker operation timed out in:${timeoutDuration} secs`;
            console.error(msg); // add thirty seconds to the timeout to let server timeout first
            //toast.add({ severity: 'info', summary: 'Timeout', detail: msg, life: srToastStore.getLife() });
            useSrToastStore().info('Timeout',msg);
            cleanupSopWorker();
            sopWorker = null;
        }
    }, timeoutDuration);
    return sopWorker;
}
const handleFtfWorkerMsg = async (workerMsg:FtfWorkerMessage) => {
    //console.log('handleFtfWorkerMsg workerMsg:',workerMsg);
    let fileName:string;
    switch(workerMsg.status){
        case 'success':
            console.log('handleFtfWorkerMsg success:',workerMsg.msg);
            //toast.add({severity: 'success',summary: 'Success', detail: workerMsg.msg, life: srToastStore.getLife() });
            useSrToastStore().success('Success',workerMsg.msg);
            // if(worker){
            //     cleanupFtfWorker();
            // }
            //fetchAndUpdateElevationData(mapStore.getCurrentReqId());
           break;
        case 'started':
            console.log('handleFtfWorkerMsg started');
            //toast.add({severity: 'info',summary: 'Started', detail: workerMsg.msg, life: srToastStore.getLife() });
            useSrToastStore().info('Started',workerMsg.msg);
            //await mapStore.drawElevations();
            break;
        case 'aborted':
            console.log('handleFtfWorkerMsg aborted');
            //toast.add({severity: 'warn',summary: 'Aborted', detail: workerMsg.msg, life: srToastStore.getLife() });
            useSrToastStore().warn('Aborted',workerMsg.msg);
            requestsStore.setMsg('Job aborted');
            cleanupFtfWorker();
            break;
        case 'server_msg':
            //console.log('handleFtfWorkerMsg server_msg:',workerMsg.msg);
            if(workerMsg.msg){
                consoleStore.addLine(workerMsg.msg);
            }
            if(workerMsg.msg){
                requestsStore.setMsg(workerMsg.msg);
                percentComplete = parseCompletionPercentage(workerMsg.msg);
                if (percentComplete !== null) {
                    curReqSumStore.setPercentComplete(percentComplete);
                } 
            }
            break;
        case 'progress':
            //console.log('handleFtfWorkerMsg progress:',workerMsg.progress);
            if(workerMsg.progress){
                curReqSumStore.setReadState(workerMsg.progress.read_state);
                curReqSumStore.setNumExceptions(workerMsg.progress.numSvrExceptions);
                curReqSumStore.setTgtExceptions(workerMsg.progress.target_numSvrExceptions);
                curReqSumStore.setNumArrowDataRecs(workerMsg.progress.numArrowDataRecs);
                curReqSumStore.setTgtArrowDataRecs(workerMsg.progress.target_numArrowDataRecs);
                curReqSumStore.setNumArrowMetaRecs(workerMsg.progress.numArrowMetaRecs);
                curReqSumStore.setTgtArrowMetaRecs(workerMsg.progress.target_numArrowMetaRecs);

                if(workerMsg.msg){
                    requestsStore.setMsg(workerMsg.msg);
                } else {
                    requestsStore.setMsg(`Received ${workerMsg.progress} records`);
                }
            }
            break;
        case 'summary':
            console.log('handleFtfWorkerMsg summary:',workerMsg);
            if(workerMsg){
                const sMsg = workerMsg as WorkerSummary;
                curReqSumStore.setSummary(sMsg);
            }
            break;
        case 'error':
            if(workerMsg.error){
                console.error('handleFtfWorkerMsg error:',workerMsg.error);
                //toast.add({severity: 'error',summary: workerMsg.error?.type, detail: workerMsg.error?.message, life: srToastStore.getLife() });
                useSrToastStore().error(workerMsg.error?.type,workerMsg.error?.message);
            }
            if(ftfWorker){
                cleanupFtfWorker();
            }
            console.log('Error... isLoading:',mapStore.isLoading);
            break;

        case 'opfs_ready':
            console.log('handleFtfWorkerMsg opfs_ready for req_id:',workerMsg.req_id);
            try {
                if(workerMsg?.req_id > 0){
                    fileName = await db.getFilename(workerMsg.req_id);
                    await duckDbLoadOpfsParquetFile(fileName);
                    await readAndUpdateElevationData(workerMsg.req_id);
                } else {
                    console.error('handleFtfWorkerMsg opfs_ready req_id is undefined or 0');
                }
            } catch (error) {
                console.error('handleFtfWorkerMsg opfs_ready error:',error);
                useSrToastStore().error('Error','Error loading file');
            }
            if(ftfWorker){
                cleanupFtfWorker();
            }
            break;

        default:
            console.error('handleFtfWorkerMsg unknown status?:',workerMsg.status);
            break;
    }     
}

const handleSopWorkerRspMsg = async (workerMsg:SopWorkerRspMsg) => {
    // Set the scatter options in the store?
    console.log('handleSopWorkerRspMsg workerMsg:',workerMsg);
    if(workerMsg.scatterOptions){
        //console.log('handleSopWorkerRspMsg scatterOptions:',workerMsg.scatterOptions);
        optionsRef.value = workerMsg.scatterOptions;
        console.log(`handleSopWorkerRspMsg  worker took ${performance.now() - sopWorkerStartTime} milliseconds.`);
    } else {
        console.error('handleSopWorkerRspMsg scatterOptions was undefined');
    }
}

const handleFtfWorkerMsgEvent = async (event: MessageEvent) => {
    if(ftfWorker){
        const workerMsg:FtfWorkerMessage = event.data;
        handleFtfWorkerMsg(workerMsg);
    } else {
        console.error('handleFtfWorkerMsgEvent: worker was undefined?');
    }
}

const handleSopWorkerMsgEvent = async (event: MessageEvent) => {
    console.log('handleSopWorkerMsgEvent event:',event);
    if(sopWorker){
        const workerMsg:SopWorkerRspMsg = event.data;
        handleSopWorkerRspMsg(workerMsg);
    } else {
        console.error('handleSopWorkerMsgEvent: worker was undefined?');
    }
}
export function processFtfAbortClicked() {
    if(ftfWorker){
        mapStore.isAborting = true; 
        const cmd = {type:'abort',req_id:mapStore.currentReqId} as FtfWebWorkerCmd;
        ftfWorker.postMessage(JSON.stringify(cmd));
        console.log('abortClicked isLoading:',mapStore.isLoading);
        requestsStore.setMsg('Abort Clicked');
        useSrToastStore().info('Abort Clicked','Aborting request');
    } else {
        //toast.add({severity: 'error',summary: 'Error', detail: 'Worker was undefined', life: srToastStore.getLife() });
        useSrToastStore().error('Error','Worker was undefined');
        console.error('abortClicked worker was undefined');
        useRequestsStore().setMsg('Abort Clicked');
    }
    mapStore.isLoading = false; // controls spinning progress
}

function handleFtfWorkerError(error:ErrorEvent, errorMsg:string) {
    console.error('Error:', error);
    //toast.add({ severity: 'error', summary: 'Error', detail: errorMsg, life: srToastStore.getLife() });
    useSrToastStore().error('Error',errorMsg);
    cleanupFtfWorker();
}

function handleSopWorkerError(error:ErrorEvent, errorMsg:string) {
    console.error('Error:', error);
    //toast.add({ severity: 'error', summary: 'Error', detail: errorMsg, life: srToastStore.getLife() });
    useSrToastStore().error('Error',errorMsg);
    cleanupSopWorker();
}


function cleanupFtfWorker(){
    if (ftfWorkerTimeoutHandle) {
        clearTimeout(ftfWorkerTimeoutHandle);
        ftfWorkerTimeoutHandle = null;
    }        
    if(ftfWorker){
        ftfWorker.terminate();
        ftfWorker = null;
    }
    mapStore.isLoading = false; // controls spinning progress
    mapStore.isAborting = false;
    reqParamsStore.using_worker = false;
    console.log('cleanupFtfWorker -- isLoading:',mapStore.isLoading);
}

export function cleanupSopWorker(){
    if (sopWorkerTimeoutHandle) {
        clearTimeout(sopWorkerTimeoutHandle);
        sopWorkerTimeoutHandle = null;
    }        
    if(sopWorker){
        sopWorker.terminate();
        sopWorker = null;
    }
    useAtlChartFilterStore().setIsLoading(false); // controls spinning progress
    useAtlChartFilterStore().setIsAborting(false);
    console.log('cleanupSopWorker -- isLoading:',mapStore.isLoading);
}

function parseCompletionPercentage(message: string): number | null {
    const regex = /\[(\d+) out of (\d+)\]/;
    const match = message.match(regex);

    if (match && match.length === 3) {
        const completed = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);

        if (!isNaN(completed) && !isNaN(total) && total !== 0) {
            return (completed / total) * 100;
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
            ftfWorker = startFetchToFileWorker();
            ftfWorker.onmessage = handleFtfWorkerMsgEvent;
            ftfWorker.onerror = (error) => {
                if(ftfWorker){
                    console.error('Worker error:', error);
                    handleFtfWorkerError(error, 'Ftf Worker faced an unexpected error');
                    cleanupFtfWorker();
                }
            };
            const cmd = {type:'run',req_id:srReqRec.req_id, sysConfig: sysConfigStore.getSysConfig(), func:srReqRec.func, parameters:srReqRec.parameters} as FtfWebWorkerCmd;
            ftfWorker.postMessage(JSON.stringify(cmd));
        } else {
            console.error('runFetchToFileWorker req_id is undefined');
            //toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
            useSrToastStore().error('Error','There was an error');
        }
    } catch (error) {
        console.error('runFetchToFileWorker error:',error);
        //toast.add({severity: 'error',summary: 'Error', detail: 'An error occurred running the worker', life: srToastStore.getLife() });
        useSrToastStore().error('Error','An error occurred running the ftf worker');
    }
}

export async function fetchScatterOptions(){
    try{
        //console.log('runFetchToFileWorker srReqRec:',srReqRec);
        if(sopWorker){
            const req_id = useAtlChartFilterStore().getReqId();
            const func = await db.getFunc(req_id);
            useAtlChartFilterStore().setFunc(func);
            useAtlChartFilterStore().setIsLoading(true);
            useAtlChartFilterStore().setHasError(false);
            const sopParms = useAtlChartFilterStore().getScatterOptionsParms();
            console.log('fetchScatterOptions sopParms:',sopParms);
            const cmd = {parms:sopParms} as SopWorkerCmdMsg;
            const cmdStr = JSON.stringify(cmd);
            sopWorker.postMessage(cmdStr);
        } else {
            useAtlChartFilterStore().setIsLoading(false);
            console.error('fetchScatterOptions worker is undefined');
            //toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
            useSrToastStore().error('fetchScatterOptions Error','There was an error');
        }
    } catch (error) {
        useAtlChartFilterStore().setIsLoading(false);
        useAtlChartFilterStore().setHasError(true);
        console.error('runFetchScatterOptionsWorker error:',error);
        //toast.add({severity: 'error',summary: 'Error', detail: 'An error occurred running the worker', life: srToastStore.getLife() });
        useSrToastStore().error('Error','An error occurred running the sop worker');
    }
}

// Function that is called when the "Run SlideRule" button is clicked
export async function processRunSlideRuleClicked() {
    mapStore.isLoading = true;
    console.log('processRunSlideRuleClicked isLoading:',mapStore.isLoading);
    curReqSumStore.setNumExceptions(0);
    curReqSumStore.setTgtExceptions(0);
    curReqSumStore.setNumArrowDataRecs(0);
    curReqSumStore.setTgtArrowDataRecs(0);
    curReqSumStore.setNumArrowMetaRecs(0);
    curReqSumStore.setTgtArrowMetaRecs(0);

    requestsStore.setMsg('Running...');
    const srReqRec = await requestsStore.createNewSrRequestRecord();
    if(srReqRec) {
        console.log('processRunSlideRuleClicked srReqRec:',srReqRec);
        if(useReqParamsStore().missionValue.value === 'ICESat-2') {
            if(useReqParamsStore().iceSat2SelectedAPI.value === 'atl06') {
                //console.log('processRunSlideRuleClicked atl06 selected');
                if(!srReqRec.req_id) {
                    console.error('runAtl06 req_id is undefined');
                    //toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
                    useSrToastStore().error('Error','There was an error');
                    return;
                }
                srReqRec.func = 'atl06';
                srReqRec.parameters = reqParamsStore.getAtlpReqParams(srReqRec.req_id);
                srReqRec.start_time = new Date();
                srReqRec.end_time = new Date();
                runFetchToFileWorker(srReqRec);
            } else if(useReqParamsStore().iceSat2SelectedAPI.value === 'atl03') {
                //console.log('processRunSlideRuleClicked atl03 selected');
                if(!srReqRec.req_id) {
                    console.error('runAtl03 req_id is undefined');
                    //toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
                    useSrToastStore().error('Error','There was an error');
                    return;
                }
                srReqRec.func = 'atl03';
                srReqRec.parameters = reqParamsStore.getAtlpReqParams(srReqRec.req_id);
                srReqRec.start_time = new Date();
                srReqRec.end_time = new Date();
                runFetchToFileWorker(srReqRec);
            } else if(useReqParamsStore().iceSat2SelectedAPI.value === 'atl08') {
                console.log('processRunSlideRuleClicked atl08 TBD');
                //toast.add({severity: 'info',summary: 'Info', detail: 'atl08 TBD', life: srToastStore.getLife() });
                useSrToastStore().info('Info','atl08 TBD');
            } else if(useReqParamsStore().iceSat2SelectedAPI.value === 'atl24s') {
                console.log('atl24s TBD');
                //toast.add({severity: 'info',summary: 'Info', detail: 'atl24s TBD', life: srToastStore.getLife() });
                useSrToastStore().info('Info','atl24s TBD');
            }
        } else if(useReqParamsStore().missionValue.value === 'GEDI') {
            console.log('GEDI TBD');
            //toast.add({severity: 'info',summary: 'Info', detail: 'GEDI TBD', life: srToastStore.getLife() });
            useSrToastStore().info('Info','GEDI TBD');
        }
    } else {
        mapStore.isLoading = false;
        console.error('runSlideRuleClicked srReqRec was undefined');
        //toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
        useSrToastStore().error('Error','There was an error');
    }
};
