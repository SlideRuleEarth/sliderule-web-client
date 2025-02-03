import type { SrRequestRecord, SrRunContext } from '@/db/SlideRuleDb';
import { checkAreaOfConvexHullError } from './SrMapUtils';
import { useSysConfigStore} from "@/stores/sysConfigStore";
import { type TimeoutHandle } from '@/stores/mapStore';    
import { useCurReqSumStore } from "@/stores/curReqSumStore";
import { useMapStore } from '@/stores/mapStore';
import { useRequestsStore } from "@/stores/requestsStore";
import { useReqParamsStore,useAutoReqParamsStore } from "@/stores/reqParamsStore";
import { useSrToastStore } from "@/stores/srToastStore";
import { db } from '@/db/SlideRuleDb';
import type { WorkerMessage, WorkerSummary, WebWorkerCmd } from '@/workers/workerUtils';
import { useSrSvrConsoleStore } from '@/stores/SrSvrConsoleStore';
import { duckDbLoadOpfsParquetFile,prepareDbForReqId,readOrCacheSummary } from '@/utils/SrDuckDbUtils';
import { findSrViewKey } from "@/composables/SrViews";
import { useJwtStore } from '@/stores/SrJWTStore';
import router from '@/router/index.js';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useChartStore } from '@/stores/chartStore';
import { callPlotUpdateDebounced,updateChartStore } from '@/utils/plotUtils';
import { useRecTreeStore } from '@/stores/recTreeStore';

const consoleStore = useSrSvrConsoleStore();
const sysConfigStore = useSysConfigStore();
const curReqSumStore = useCurReqSumStore();
const mapStore = useMapStore();
const requestsStore = useRequestsStore();
const atlChartFilterStore = useAtlChartFilterStore();
const chartStore = useChartStore();

let worker: Worker | null = null;
let workerTimeoutHandle: TimeoutHandle | null = null; // Handle for the timeout to clear it when necessary
let percentComplete: number | null = null;

async function getReqParamStore(reqId:number):Promise<ReturnType<typeof useReqParamsStore>> {
    const rc = await db.getRunContext(reqId)
    if(rc){
        if(rc.parentReqId && rc.parentReqId > 0){
            return useAutoReqParamsStore();
        } else {
            console.warn('getReqParamStore using useReqParamsStore for reqId:',reqId,' invalid rc?:',rc);
            return useReqParamsStore();
        }
    } else {
        return useReqParamsStore();
    }
}

async function startFetchToFileWorker(reqId:number):Promise<Worker> {
    worker =  new Worker(new URL('../workers/fetchToFile', import.meta.url), { type: 'module' }); // new URL must be inline? per documentation: https://vitejs.dev/guide/features.html#web-workers

    const reqParamsStore = await getReqParamStore(reqId);

    const timeoutDuration = reqParamsStore.getWorkerThreadTimeout(); 
    console.log('startFetchToFileWorker with timeoutDuration:',timeoutDuration, ' milliseconds');
    workerTimeoutHandle = setTimeout(async () => {
        if (worker) {
            const msg = `Timeout: Worker operation timed out in:${(timeoutDuration/1000)} secs`;
            console.error(msg); // added to the timeout to let server timeout first
            //toast.add({ severity: 'info', summary: 'Timeout', detail: msg, life: srToastStore.getLife() });
            useSrToastStore().info('Timeout',msg);
            await cleanUpWorker(reqId);
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
                successMsg = `Record ${workerMsg.req_id} created with ${numBytes} bytes.\n\nClick on another track to plot elevation of that track.`;
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
            await cleanUpWorker(workerMsg.req_id);
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
                await cleanUpWorker(workerMsg.req_id);
            }
            console.log('Error... isLoading:',mapStore.isLoading);
            break;

        case 'opfs_ready':
            console.log('handleWorkerMsg opfs_ready for req_id:',workerMsg.req_id);
            if(workerMsg && workerMsg.req_id > 0){
                const reqIdStr = workerMsg.req_id.toString();
                let rc:SrRunContext|undefined = undefined;
                try{
                    rc = await db.getRunContext(workerMsg.req_id);
                    fileName = await db.getFilename(workerMsg.req_id);
                    chartStore.setFile(reqIdStr,fileName);
                    const serverReqStr = await duckDbLoadOpfsParquetFile(fileName);
                    await db.updateRequestRecord( {req_id:workerMsg.req_id, svr_parms: serverReqStr });
                    if(rc?.parentReqId && rc.parentReqId > 0){
                        await useRecTreeStore().updateRecMenu('opfs_ready');// update the tree menu but not the selected node
                    } else {
                        const newReqId = await useRecTreeStore().updateRecMenu('opfs_ready',workerMsg.req_id); // update the tree menu and use this as selected node
                        if(newReqId != workerMsg.req_id){
                            console.error('handleWorkerMsg opfs_ready newReqId:',newReqId,' does not match workerMsg.req_id:',workerMsg.req_id);
                        }
                    }
                } catch (error) {
                    const emsg = `Error loading file,reading metadata or creating/updating polyhash for req_id:${workerMsg.req_id}`;
                    console.error('handleWorkerMsg opfs_ready error:',error,emsg);
                    useSrToastStore().error('Error',emsg);
                }
                try {
                    console.log('handleWorkerMsg opfs_ready rc:',rc);
                    if(rc && rc.parentReqId>0){ // this was a Photon Cloud request
                        await updateChartStore(workerMsg.req_id);
                        await readOrCacheSummary(workerMsg.req_id);
                        await prepareDbForReqId(workerMsg.req_id);
                        await callPlotUpdateDebounced('Overlayed Photon Cloud');
                        atlChartFilterStore.setSelectedOverlayedReqIds([workerMsg.req_id]);
                    } else {
                        console.log('handleWorkerMsg opfs_ready router push to analyze:',workerMsg.req_id);
                        router.push(`/analyze/${workerMsg.req_id}`);//see views/AnalyzeView.vue
                    }
                } catch (error) {
                    console.error('handleWorkerMsg opfs_ready error:',error);
                    useSrToastStore().error('Error','Error loading file');
                }
            } else {
                console.error('handleWorkerMsg opfs_ready req_id is undefined or 0');
            }
            if(worker){
                await cleanUpWorker(workerMsg.req_id);
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
       mapStore.setIsAborting(true); 
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
    mapStore.setIsLoading(false); // controls spinning progress
}

function handleWorkerError(reqId:number,error:ErrorEvent, errorMsg:string) {
    console.error('Error:', error);
    //toast.add({ severity: 'error', summary: 'Error', detail: errorMsg, life: srToastStore.getLife() });
    useSrToastStore().error('Error',errorMsg);
    cleanUpWorker(reqId);
}

async function cleanUpWorker(reqId:number){
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
    mapStore.setIsLoading(false); // controls spinning progress
    mapStore.setIsAborting(false);
    const reqParamsStore = await getReqParamStore(reqId);
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
            mapStore.setIsLoading(true); // controls spinning progress
            mapStore.setTotalRows(0);
            mapStore.setCurrentRows(0);
            worker = await startFetchToFileWorker(srReqRec.req_id);
            worker.onmessage = handleWorkerMsgEvent;
            worker.onerror = async (error) => {
                if(worker){
                    console.error('Worker error:', error);
                    if(srReqRec.req_id){
                        handleWorkerError(srReqRec.req_id, error, 'Worker faced an unexpected error');
                    } else {
                        console.error('runFetchToFileWorker req_id is undefined FAILED to handleWorkerError');
                    }
                    if(srReqRec.req_id){
                        await cleanUpWorker(srReqRec.req_id);
                    } else {
                        console.error('runFetchToFileWorker req_id is undefined FAILED to cleanup worker');
                    }
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
export async function processRunSlideRuleClicked(rc:SrRunContext|null = null) : Promise<void> {
    let runContext = rc as SrRunContext;
    if(!checkAreaOfConvexHullError()){
        return;
    }

    mapStore.setIsLoading(true);
    mapStore.setIsAborting(false);
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
    const srReqRec = await requestsStore.createNewSrRequestRecord();
    if (srReqRec) {
        console.log('runSlideRuleClicked srReqRec:', srReqRec);
        if (srReqRec.req_id) {
            requestsStore.setConsoleMsg('loading params...');
            if (rc) {
                rc.reqId = srReqRec.req_id;
                await db.addSrRunContext(rc);
            }
            const reqParamsStore = await getReqParamStore(srReqRec.req_id);
            if (!reqParamsStore.ignorePolygon && (reqParamsStore.poly === null || reqParamsStore.poly.length === 0)) {
                console.warn('No geographic region defined reqParamsStore.poly:', reqParamsStore.poly, ' reqParamsStore.ignorePolygon:', reqParamsStore.ignorePolygon);
                if (rc === null) {
                    useSrToastStore().error('Error', 'You must define a geographic region.');
                    requestsStore.setConsoleMsg('You need to supply a geographic region...');
                } else {
                    console.error('runSlideRuleClicked INVALID reqParamsStore.poly:', reqParamsStore.poly, ' reqParamsStore.ignorePolygon:', reqParamsStore.ignorePolygon);
                }
                mapStore.setIsLoading(false);
                return;
            }
            const srViewKey = findSrViewKey(useMapStore().selectedView, useMapStore().selectedBaseLayer);
            if (srViewKey.value) {
                srReqRec.srViewName = srViewKey.value;
            } else {
                console.error('runSlideRuleClicked srViewKey was undefined');
                useSrToastStore().error('Error', 'There was an error. srViewKey was undefined');
                requestsStore.setConsoleMsg('stopped...');
                mapStore.setIsLoading(false);
                return;
            }

            if (reqParamsStore.getMissionValue() === 'ICESat-2') {
                if (reqParamsStore.getIceSat2API()) {
                    console.log('runSlideRuleClicked IceSat2API:', reqParamsStore.getIceSat2API());
                    srReqRec.func = reqParamsStore.getIceSat2API();
                    srReqRec.parameters = reqParamsStore.getAtlxxReqParams(srReqRec.req_id);
                    if (srViewKey.value) {
                        srReqRec.start_time = new Date();
                        srReqRec.end_time = new Date();
                        runFetchToFileWorker(srReqRec);
                    }
                } else {
                    console.error('runSlideRuleClicked IceSat2API was undefined');
                    useSrToastStore().error('Error', 'There was an error. IceSat2API was undefined');
                    requestsStore.setConsoleMsg('stopped...');
                    mapStore.setIsLoading(false);
                }
            } else if (reqParamsStore.getMissionValue() === 'GEDI') {
                if (reqParamsStore.getGediAPI()) {
                    console.log('runSlideRuleClicked GediAPI:', reqParamsStore.getGediAPI());
                    srReqRec.func = reqParamsStore.getGediAPI();
                    srReqRec.parameters = reqParamsStore.getAtlxxReqParams(srReqRec.req_id);
                    srReqRec.start_time = new Date();
                    srReqRec.end_time = new Date();
                    requestsStore.setConsoleMsg('running...');
                    runFetchToFileWorker(srReqRec);
                } else {
                    console.error('runSlideRuleClicked GediAPI was undefined');
                    useSrToastStore().error('Error', 'There was an error. GediAPI was undefined');
                    requestsStore.setConsoleMsg('stopped...');
                    mapStore.setIsLoading(false);
                }
            }
        } else {
            console.error('runSlideRuleClicked req_id is undefined');
            useSrToastStore().error('Error', 'There was an error');
            return;
        }
    } else {
        console.error('runSlideRuleClicked srReqRec was undefined');
        useSrToastStore().error('Error', 'There was an error');
        requestsStore.setConsoleMsg('stopped...');
        mapStore.setIsLoading(false);
    }
};
