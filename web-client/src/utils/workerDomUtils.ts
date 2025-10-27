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
import { duckDbLoadOpfsParquetFile,prepareDbForReqId,readOrCacheSummary,getGeoMetadataFromFile } from '@/utils/SrDuckDbUtils';
import { findSrViewKey } from "@/composables/SrViews";
import { useJwtStore } from '@/stores/SrJWTStore';
import router from '@/router/index.js';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useChartStore } from '@/stores/chartStore';
import { callPlotUpdateDebounced,updateWhereClauseAndXData } from '@/utils/plotUtils';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useServerStateStore } from '@/stores/serverStateStore';
import { useGeoJsonStore } from '@/stores/geoJsonStore';
import type { AtlxxReqParams } from '@/types/SrTypes';
import { updateNumGranulesInRecord, updateAreaInRecord, updateReqParmsFromMeta } from '@/utils/SrParquetUtils';
import { createLogger } from '@/utils/logger';

const logger = createLogger('WorkerDomUtils');

const consoleStore = useSrSvrConsoleStore();
const sysConfigStore = useSysConfigStore();
const curReqSumStore = useCurReqSumStore();
const mapStore = useMapStore();
const requestsStore = useRequestsStore();
const atlChartFilterStore = useAtlChartFilterStore();
const chartStore = useChartStore();
const serverStateStore = useServerStateStore();

let worker: Worker | null = null;
let workerTimeoutHandle: TimeoutHandle | null = null; // Handle for the timeout to clear it when necessary
let percentComplete: number | null = null;

async function getReqParamStore(reqId:number):Promise<ReturnType<typeof useReqParamsStore> | undefined> {
    const rc = await db.getRunContext(reqId)
    if(rc){
        if(rc.parentReqId && rc.parentReqId > 0){
            return useAutoReqParamsStore();
        } else {
            logger.error('Using useReqParamsStore - invalid rc?', { reqId, rc });
            return undefined;
        }
    } else {
        return useReqParamsStore();
    }
}

function formatBigIntWithCommas(value: any): string {
    return value.toString().replace(/n$/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatBytes(bytes: bigint | number, decimals = 2): string {
    if (typeof bytes === "bigint") {
        bytes = Number(bytes); // Convert BigInt to Number if safe
    }
    if (bytes === 0) return "0 Bytes";
    if (isNaN(bytes)) return "Invalid Size";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

async function startFetchToFileWorker(reqId:number):Promise<Worker> {
    worker =  new Worker(new URL('../workers/fetchToFile', import.meta.url), { type: 'module' }); // new URL must be inline? per documentation: https://vitejs.dev/guide/features.html#web-workers

    const reqParamsStore = await getReqParamStore(reqId);
    if(!reqParamsStore){
        throw new Error('startFetchToFileWorker reqParamsStore was undefined');
    }
    const timeoutDuration = reqParamsStore.getWorkerThreadTimeout();
    logger.debug('startFetchToFileWorker', { timeoutDuration_ms: timeoutDuration });
    workerTimeoutHandle = setTimeout(async () => {
        if (worker) {
            const msg = `Timeout: Worker operation timed out in:${(timeoutDuration/1000)} secs`;
            logger.error('Worker operation timed out', { timeout_seconds: timeoutDuration/1000 });
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
            logger.debug('Worker success', { msg: workerMsg.msg });
           break;
        case 'started':
            logger.debug('Worker started');
            useSrToastStore().info('Started',workerMsg.msg);
            break;
        case 'aborted':
            logger.debug('Worker aborted');
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
                    requestsStore.setConsoleMsg(`Received ${workerMsg.progress.numSvrExceptions} ${targetMsg} notifications`);
                }
            }
            break;
        case 'summary':
            logger.debug('Worker summary', { workerMsg });
            if(workerMsg){
                const sMsg = workerMsg as WorkerSummary;
                curReqSumStore.setSummary(sMsg);
            }
            break;
        case 'error':
            if(workerMsg.error){
                logger.error('Worker error', { error: workerMsg.error });
                //toast.add({severity: 'error',summary: workerMsg.error?.type, detail: workerMsg.error?.message, life: srToastStore.getLife() });
                useSrToastStore().error(workerMsg.error?.type,workerMsg.error?.message);
            }
            if(worker){
                await cleanUpWorker(workerMsg.req_id);
            }
            logger.debug('Error state', { isFetching: serverStateStore.isFetching });
            break;

        case 'opfs_ready':
            logger.debug('OPFS ready for req_id', { req_id: workerMsg.req_id });
            if(workerMsg && workerMsg.req_id > 0){
                const reqIdStr = workerMsg.req_id.toString();
                let rc:SrRunContext|undefined = undefined;
                try{
                    rc = await db.getRunContext(workerMsg.req_id);
                    fileName = await db.getFilename(workerMsg.req_id);
                    chartStore.setFile(reqIdStr,fileName);
                    const serverReqStr = await duckDbLoadOpfsParquetFile(fileName);
                    const geoMetadata = await getGeoMetadataFromFile(fileName);
                    await db.updateRequestRecord( {req_id:workerMsg.req_id, svr_parms: serverReqStr, geo_metadata: geoMetadata });
                    if(rc?.parentReqId && rc.parentReqId > 0){
                        await useRecTreeStore().updateRecMenu('opfs_ready');// update the tree menu but not the selected node
                        numBytes = await db.getNumBytes(workerMsg.req_id);
                        const summary = await readOrCacheSummary(workerMsg.req_id);
                        if(numBytes > 0){
                            successMsg = `Record ${workerMsg.req_id} created with ${formatBigIntWithCommas(summary?.numPoints ?? 0n)} points\n size:${formatBytes(numBytes)}.\nClick on another track to plot the elevation of that track.`;
                            useSrToastStore().success('Success',successMsg,5000); // 5 seconds
                        } else {
                            successMsg = 'File created with no data.\nAdjust your parameters or region and try again.';
                            useSrToastStore().warn('No data found',successMsg);
                        }
                        if (summary?.numPoints === 0) {
                            useSrToastStore().warn('No data found', 'File created with no points.\nAdjust your parameters or region and try again.');
                        }
                        logger.debug('OPFS ready success', { successMsg });
                    } else {
                        const newReqId = await useRecTreeStore().updateRecMenu('opfs_ready',workerMsg.req_id); // update the tree menu and use this as selected node
                        if(newReqId != workerMsg.req_id){
                            logger.error('newReqId does not match workerMsg.req_id', { newReqId, workerReqId: workerMsg.req_id });
                        }
                    }
                    await updateAreaInRecord(workerMsg.req_id);
                    await updateNumGranulesInRecord(workerMsg.req_id);
                    await updateReqParmsFromMeta(workerMsg.req_id); // for x endpoints
                } catch (error) {
                    const emsg = `Error loading file,reading metadata or creating/updating polyhash for req_id:${workerMsg.req_id}`;
                    logger.error('OPFS ready error', { error: error instanceof Error ? error.message : String(error), emsg });
                    useSrToastStore().error('Error',emsg);
                }
                try {
                    logger.debug('OPFS ready rc', { rc });
                    if(rc && rc.parentReqId>0){ // this was a Photon Cloud request
                        await updateWhereClauseAndXData(workerMsg.req_id);
                        await readOrCacheSummary(workerMsg.req_id);
                        await prepareDbForReqId(workerMsg.req_id);
                        atlChartFilterStore.setSelectedOverlayedReqIds([workerMsg.req_id]);
                        void callPlotUpdateDebounced(`opfs_ready ${workerMsg.req_id}`);
                    } else {
                        logger.debug('OPFS ready router push to analyze', { req_id: workerMsg.req_id });
                        await router.push(`/analyze/${workerMsg.req_id}`);//see views/AnalyzeView.vue
                    }
                } catch (error) {
                    logger.error('OPFS ready error', { error: error instanceof Error ? error.message : String(error) });
                    useSrToastStore().error('Error','Error loading file');
                }
            } else {
                logger.error('OPFS ready req_id is undefined or 0');
            }
            if(worker){
                await cleanUpWorker(workerMsg.req_id);
            }
            break;

        default:
            logger.error('Unknown worker status', { status: workerMsg.status });
            break;
    }     
}

const handleWorkerMsgEvent = (event: MessageEvent) => {
    if(worker){
        const workerMsg:WorkerMessage = event.data;
        void handleWorkerMsg(workerMsg);
    } else {
        logger.error('handleWorkerMsgEvent: worker was undefined');
    }
}

export function processAbortClicked() {
    if(worker){
        serverStateStore.isAborting = true; 
        const cmd = {type:'abort',req_id:mapStore.currentReqId} as WebWorkerCmd;
        worker.postMessage(JSON.stringify(cmd));
        logger.debug('abortClicked', { isAborting: serverStateStore.isAborting, isFetching: serverStateStore.isFetching });
        requestsStore.setConsoleMsg('Abort Clicked');
        useSrToastStore().info('Abort Clicked','Aborting request');
    } else {
        //toast.add({severity: 'error',summary: 'Error', detail: 'Worker was undefined', life: srToastStore.getLife() });
        useSrToastStore().error('Error','Worker was undefined');
        logger.error('abortClicked worker was undefined');
        useRequestsStore().setConsoleMsg('Abort Clicked');
    }
}

function handleWorkerError(reqId:number,error:ErrorEvent, errorMsg:string) {
    logger.error('Worker error', { error: error.message, errorMsg });
    //toast.add({ severity: 'error', summary: 'Error', detail: errorMsg, life: srToastStore.getLife() });
    useSrToastStore().error('Error',errorMsg);
    void cleanUpWorker(reqId);
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
    //mapStore.setIsLoading(false); // controls spinning progress
    serverStateStore.isAborting = false;
    const reqParamsStore = await getReqParamStore(reqId);
    if(reqParamsStore){
        reqParamsStore.using_worker = false;
    } else {
        logger.error('cleanUpWorker reqParamsStore was undefined');
    }
    serverStateStore.isFetching = false;
    logger.debug('cleanUpWorker', { isFetching: serverStateStore.isFetching });
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

async function runFetchToFileWorker(srReqRec:SrRequestRecord) : Promise<void> {
    try{
        logger.debug('runFetchToFileWorker', { srReqRec });
        if(srReqRec.req_id){
            await db.updateRequest(srReqRec.req_id,srReqRec);
            mapStore.setCurrentReqId(srReqRec.req_id);
            const reqParamsStore = await getReqParamStore(srReqRec.req_id);
            if(reqParamsStore){
                serverStateStore.isFetching = true;
            } else {
                logger.error('reqParamsStore was undefined');
            }
            worker = await startFetchToFileWorker(srReqRec.req_id);
            worker.onmessage = handleWorkerMsgEvent;
            worker.onerror = async (error) => {
                if(worker){
                    logger.error('Worker error', { error });
                    if(srReqRec.req_id){
                        handleWorkerError(srReqRec.req_id, error, 'Worker faced an unexpected error');
                    } else {
                        logger.error('req_id is undefined, failed to handleWorkerError');
                    }
                    if(srReqRec.req_id){
                        await cleanUpWorker(srReqRec.req_id);
                    } else {
                        logger.error('req_id is undefined, failed to cleanup worker');
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
            logger.debug('runFetchToFileWorker cmd', { cmd });
            worker.postMessage(JSON.stringify(cmd));
        } else {
            logger.error('req_id is undefined');
            //toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
            useSrToastStore().error('Error','There was an error');
            requestsStore.setConsoleMsg('There was an error');
            requestsStore.setSvrMsg('');
        }
    } catch (error) {
        logger.error('runFetchToFileWorker error', { error: error instanceof Error ? error.message : String(error) });
        //toast.add({severity: 'error',summary: 'Error', detail: 'An error occurred running the worker', life: srToastStore.getLife() });
        useSrToastStore().error('Error','An error occurred running the worker');
        requestsStore.setConsoleMsg('There was an error');
        requestsStore.setSvrMsg('');
    }
}

// Function that is called when the "Run SlideRule" button is clicked
export async function processRunSlideRuleClicked(rc:SrRunContext|null = null) : Promise<void> {
    if(!(useReqParamsStore().getMissionValue() === 'ICESat-2' && useReqParamsStore().getIceSat2API().includes('atl13'))){
        const rsp = checkAreaOfConvexHullError();
        if(!rsp.ok){
            //needed here for geojson upload
            useSrToastStore().error('Error', rsp.msg ?? 'The area of the convex hull is too large.');
            return;
        }
    }
    //mapStore.setIsLoading(true);
    serverStateStore.isAborting = false;
    logger.debug('runSlideRuleClicked');
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
        logger.debug('runSlideRuleClicked srReqRec', { srReqRec });
        if (srReqRec.req_id) {
            requestsStore.setConsoleMsg('loading params...');
            if (rc) {
                rc.reqId = srReqRec.req_id;
                await db.addSrRunContext(rc);
                //console.log('runSlideRuleClicked srReqRec.req_id:', srReqRec.req_id, 'runContext:', rc);
            }
            const reqParamsStore = await getReqParamStore(srReqRec.req_id);
            if(!reqParamsStore){
                throw new Error('runSlideRuleClicked reqParamsStore was undefined');
            }
            if(!reqParamsStore.enableGranuleSelection){ // granule selection is not enabled
                if (!reqParamsStore.ignorePolygon && 
                    (reqParamsStore.poly === null || reqParamsStore.poly.length === 0) &&
                    (useGeoJsonStore().reqHasPoly() === false) &&
                    !(reqParamsStore.getMissionValue() === 'ICESat-2' && reqParamsStore.getIceSat2API().includes('atl13'))
                ) {
                    logger.warn('No geographic region defined', { poly: reqParamsStore.poly, ignorePolygon: reqParamsStore.ignorePolygon });
                    if (rc === null) {
                        useSrToastStore().error('Error', 'You must define a geographic region or a resource or use advanced filters');
                        useSrToastStore().info('Helpful Advice', 'To start: Try zooming in and selecting a geographic region about 10x10 km or smaller');
                        requestsStore.setConsoleMsg('You need to supply a geographic region or a resource or advanced filters...');
                    } else {
                        logger.error('runSlideRuleClicked INVALID poly', { poly: reqParamsStore.poly, ignorePolygon: reqParamsStore.ignorePolygon });
                    }
                    return;
                }
            } else {
                // with granule selection enabled, polygon is not required
            }
            const srViewKey = findSrViewKey(useMapStore().selectedView, useMapStore().selectedBaseLayer);
            if (srViewKey.value) {
                srReqRec.srViewName = srViewKey.value;
            } else {
                logger.error('runSlideRuleClicked srViewKey was undefined');
                useSrToastStore().error('Error', 'There was an error. srViewKey was undefined');
                requestsStore.setConsoleMsg('stopped...');
                return;
            }

            if (reqParamsStore.getMissionValue() === 'ICESat-2') {
                if (reqParamsStore.getIceSat2API()) {
                    srReqRec.parameters = reqParamsStore.getAtlxxReqParams(srReqRec.req_id) as AtlxxReqParams;
                    if((reqParamsStore.getIceSat2API() === 'atl03') && (srReqRec.parameters?.parms?.fit)){
                        srReqRec.func = 'atl03x-surface';
                    } else if ((reqParamsStore.getIceSat2API() === 'atl03') && (srReqRec.parameters?.parms?.phoreal)) {
                        srReqRec.func = 'atl03x-phoreal';
                    } else {
                        srReqRec.func = reqParamsStore.getIceSat2API();
                    }
                    //console.log('runSlideRuleClicked IceSat2API:', reqParamsStore.getIceSat2API(), ' srReqRec.func:', srReqRec.func);
                    const fileName = srReqRec.parameters?.parms?.output?.path;
                    srReqRec.file = fileName;
                    //console.log('runSlideRuleClicked will create fileName:', fileName, srReqRec);
                    if (srViewKey.value) {
                        srReqRec.start_time = new Date();
                        srReqRec.end_time = new Date();
                        await runFetchToFileWorker(srReqRec);
                    }
                } else {
                    logger.error('runSlideRuleClicked IceSat2API was undefined');
                    useSrToastStore().error('Error', 'There was an error. IceSat2API was undefined');
                    requestsStore.setConsoleMsg('stopped...');
                }
            } else if (reqParamsStore.getMissionValue() === 'GEDI') {
                if (reqParamsStore.getGediAPI()) {
                    logger.debug('runSlideRuleClicked GediAPI', { gediAPI: reqParamsStore.getGediAPI() });
                    srReqRec.func = reqParamsStore.getGediAPI();
                    srReqRec.parameters = reqParamsStore.getAtlxxReqParams(srReqRec.req_id);
                    const fileName = srReqRec.parameters?.parms?.output?.path;
                    srReqRec.file = fileName;
                    logger.debug('runSlideRuleClicked will create fileName', { fileName, srReqRec });
                    if (srViewKey.value) {
                        srReqRec.start_time = new Date();
                        srReqRec.end_time = new Date();
                        await runFetchToFileWorker(srReqRec);
                    }
                } else {
                    logger.error('runSlideRuleClicked GediAPI was undefined');
                    useSrToastStore().error('Error', 'There was an error. GediAPI was undefined');
                    requestsStore.setConsoleMsg('stopped...');
                }
            } else {
                logger.error('runSlideRuleClicked mission was undefined');
                useSrToastStore().error('Error', 'There was an error. Mission was undefined');
                requestsStore.setConsoleMsg('stopped...');
            }
        } else {
            logger.error('runSlideRuleClicked req_id is undefined');
            useSrToastStore().error('Error', 'There was an error');
            return;
        }
    } else {
        logger.error('runSlideRuleClicked srReqRec was undefined');
        useSrToastStore().error('Error', 'There was an error');
        requestsStore.setConsoleMsg('stopped...');
    }
};
