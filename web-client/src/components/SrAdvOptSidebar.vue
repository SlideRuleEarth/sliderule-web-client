<script setup lang="ts">

    import SrMenuInput from "@/components/SrMenuInput.vue";
    import SrAdvOptAccordion from "@/components/SrAdvOptAccordion.vue";
    import Button from 'primevue/button';
    import { onMounted, ref, watch } from 'vue';
    import {useToast} from "primevue/usetoast";
    import ProgressSpinner from 'primevue/progressspinner';
    import { useMapStore } from '@/stores/mapStore';
    import  SrGraticuleSelect  from "@/components/SrGraticuleSelect.vue";
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import { useSysConfigStore} from "@/stores/sysConfigStore";
    import { useRequestsStore } from "@/stores/requestsStore";
    import { type SrRequestRecord } from '@/db/SlideRuleDb';
    import { useSrToastStore } from "@/stores/srToastStore";
    import { useCurAtl06ReqSumStore } from '@/stores/curAtl06ReqSumStore';
    import { type TimeoutHandle } from '@/stores/mapStore';    
    import { WorkerMessage } from '@/workers/workerUtils';
    import { WebWorkerCmd } from "@/workers/workerUtils";
    import type { WorkerSummary } from '@/workers/workerUtils';
    import ProgressBar from 'primevue/progressbar';
    import { processOpfsFile } from '@/utils/SrParquetUtils';


    const reqParamsStore = useReqParamsStore();
    const sysConfigStore = useSysConfigStore();
    const requestsStore = useRequestsStore();
    const srToastStore = useSrToastStore();
    const mapStore = useMapStore();
    

    const graticuleClick = () => {
        mapStore.toggleGraticule();
    }
    const curReqSumStore = useCurAtl06ReqSumStore();

    const toast = useToast();
    const missionValue = ref({name:'ICESat-2',value:'ICESat-2'});
    const missionItems = ref([{name:'ICESat-2',value:'ICESat-2'},{name:'GEDI',value:'GEDI'}]);
    const iceSat2SelectedAPI = ref({name:'atl06',value:'atl06'});
    const iceSat2APIsItems = ref([{name:'atl06',value:'atl06'},{name:'atl06s',value:'atl06s'},{name:'atl03',value:'atl03'},{name:'atl08',value:'atl08'},{name:'atl24s',value:'atl24s'}]);
    const gediSelectedAPI = ref({name:'gedi01b',value:'gedi01b'});
    const gediAPIsItems = ref([{name:'gedi01b',value:'gedi01b'},{name:'gedi02a',value:'gedi02a'},{name:'gedi04a',value:'gedi04a'}]);
    let worker: Worker | null = null;
    let workerTimeoutHandle: TimeoutHandle | null = null; // Handle for the timeout to clear it when necessary
    let percentComplete: number | null = null;

    onMounted(async () => {
        console.log('SrAdvOptSidebar onMounted totalTimeoutValue:',reqParamsStore.totalTimeoutValue);
        mapStore.isAborting = false;
        // try{
        //     console.log('calling db.getDefinitionsByVersion REC_VERSION:',REC_VERSION);
        //     let db_definitions = await db.getDefinitionsByVersion(REC_VERSION);
        //     console.log('db_definitions:',db_definitions);
        //     if(!db_definitions || db_definitions.length === 0){
        //         const network_definitions = await populateAllDefinitions()
        //         // Once definitions are retrieved from the server, store them in the database
        //         const new_db_defs_id = await db.addDefinitions(network_definitions,REC_VERSION);
        //         console.log('network_definitions:',network_definitions, 'new_db_defs_id:',new_db_defs_id , ' with version:',REC_VERSION);
        //     } else {
        //         console.log('db_definitions:',db_definitions, ' with version:',REC_VERSION);
        //     }
        // } catch (error) {
        //     console.error('Error:', error);
        // }
        //console.log('num_defs_fetched:',get_num_defs_fetched());
        //set_num_defs_fetched(0);
    });

    watch(() => missionValue,(newValue,oldValue) => {
        console.log(`missionValue changed from ${oldValue} to ${newValue}`);
        if (newValue.value.value === 'ICESat-2') {
            iceSat2SelectedAPI.value.value = 'atl06'; // Reset to default when mission changes
            reqParamsStore.asset ='icesat2';
        } else if (newValue.value.value === 'GEDI') {
            gediSelectedAPI.value.value = 'gedi01b'; // Reset to default when mission changes
            reqParamsStore.asset ='gedi';
        }
    });

    const handleAtl06WorkerMsgEvent = async (event: MessageEvent) => {
        if(worker){
            const workerMsg:WorkerMessage = event.data;
            handleAtl06Msg(workerMsg);
        } else {
            console.error('handleAtl06MsgEvent: worker was undefined?');
        }
    }

    function abortClicked() {
        if(worker){
            mapStore.isAborting = true; 
            const cmd = {type:'abort',req_id:mapStore.currentReqId} as WebWorkerCmd;
            worker.postMessage(JSON.stringify(cmd));
            console.log('abortClicked isLoading:',mapStore.isLoading);
            requestsStore.setMsg('Abort Clicked');
        } else {
            console.error('abortClicked worker was undefined');
            toast.add({severity: 'error',summary: 'Error', detail: 'Worker was undefined', life: srToastStore.getLife() });
        }
    }

    function handleAtl06Error(error:ErrorEvent, errorMsg:string) {
        console.error('Error:', error);
        toast.add({ severity: 'error', summary: 'Error', detail: errorMsg, life: srToastStore.getLife() });
        cleanUpWorker();
    }

    function startAtl06Worker(){
        worker =  new Worker(new URL('../workers/atl06ToDb', import.meta.url), { type: 'module' }); // new URL must be inline? per documentation: https://vitejs.dev/guide/features.html#web-workers
        const timeoutDuration = reqParamsStore.totalTimeoutValue*1000; // Convert to milliseconds
        console.log('runAtl06Worker with timeoutDuration:',timeoutDuration, ' milliseconds redraw Elevations every:',mapStore.redrawTimeOutSeconds, ' seconds for req_id:',curReqSumStore.req_id);
        workerTimeoutHandle = setTimeout(() => {
            if (worker) {
                const msg = `Timeout: Worker operation timed out in:${timeoutDuration} secs`;
                console.error(msg); // add thirty seconds to the timeout to let server timeout first
                toast.add({ severity: 'info', summary: 'Timeout', detail: msg, life: srToastStore.getLife() });
                cleanUpWorker();
                worker = null;
            }
        }, timeoutDuration);
        reqParamsStore.using_worker = true;
        return worker;
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
            const completed = parseInt(match[1], 10);
            const total = parseInt(match[2], 10);

            if (!isNaN(completed) && !isNaN(total) && total !== 0) {
                return (completed / total) * 100;
            }
        }
        return null; // Return null if the message does not match the expected format or total is zero
    }

    const handleAtl06Msg = async (workerMsg:WorkerMessage) => {
        console.log('handleAtl06Msg workerMsg:',workerMsg);
        switch(workerMsg.status){
            // case 'success':// Deprecated
            //     console.log('handleAtl06Msg success:',workerMsg.msg);
            //     toast.add({severity: 'info',summary: 'Download success', detail: 'loading rest of points into db...', life: srToastStore.getLife() });
            //     toast.add({severity: 'success',summary: 'Success', detail: workerMsg.msg, life: srToastStore.getLife() });
            //     if(worker){
            //         cleanUpWorker();
            //     }
            //     //fetchAndUpdateElevationData(mapStore.getCurrentReqId());
            //     break;
            case 'started':
                console.log('handleAtl06Msg started');
                toast.add({severity: 'info',summary: 'Started', detail: workerMsg.msg, life: srToastStore.getLife() });
                //await mapStore.drawElevations();
                break;
            case 'aborted':
                console.log('handleAtl06Msg aborted');
                toast.add({severity: 'warn',summary: 'Aborted', detail: workerMsg.msg, life: srToastStore.getLife() });
                requestsStore.setMsg('Job aborted');
                cleanUpWorker();
                break;
            case 'server_msg':
                console.log('handleAtl06Msg server_msg:',workerMsg.msg);
                if(workerMsg.msg){
                    requestsStore.setMsg(workerMsg.msg);
                    percentComplete = parseCompletionPercentage(workerMsg.msg);
                    if (percentComplete !== null) {
                        curReqSumStore.setPercentComplete(percentComplete);
                    } 
                }
                break;
            case 'progress':
                console.log('handleAtl06Msg progress:',workerMsg.progress);
                if(workerMsg.progress){
                    curReqSumStore.setReadState(workerMsg.progress.read_state);
                    curReqSumStore.setNumExceptions(workerMsg.progress.numAtl06Exceptions);
                    curReqSumStore.setTgtExceptions(workerMsg.progress.target_numAtl06Exceptions);
                    curReqSumStore.setNumArrowDataRecs(workerMsg.progress.numArrowDataRecs);
                    curReqSumStore.setTgtArrowDataRecs(workerMsg.progress.target_numArrowDataRecs);
                    curReqSumStore.setNumArrowMetaRecs(workerMsg.progress.numArrowMetaRecs);
                    curReqSumStore.setTgtArrowMetaRecs(workerMsg.progress.target_numArrowMetaRecs);

                    const sMsg = workerMsg as WorkerSummary;
                    curReqSumStore.setSummary(sMsg);
                    if(workerMsg.msg){
                        requestsStore.setMsg(workerMsg.msg);
                    } else {
                        requestsStore.setMsg(`Received ${workerMsg.progress} records`);
                    }
                }
                break;
            case 'summary':
                console.log('handleAtl06Msg summary:',workerMsg);
                if(workerMsg){
                    const sMsg = workerMsg as WorkerSummary;
                    curReqSumStore.setSummary(sMsg);
                }
                break;
            case 'error':
                if(workerMsg.error){
                    console.log('handleAtl06Msg error:',workerMsg.error);
                    toast.add({severity: 'error',summary: workerMsg.error?.type, detail: workerMsg.error?.message, life: srToastStore.getLife() });
                }
                if(worker){
                    cleanUpWorker();
                }
                console.log('Error... isLoading:',mapStore.isLoading);
                break;

            // case 'geoParquet_rcvd': //DEPRECATED

            //     console.log('handleAtl06Msg geoParquet_rcvd blob:',workerMsg.blob);
            //     if(worker){
            //         cleanUpWorker();
            //     }
            //     if(workerMsg.blob){
            //         let filename = 'atl06.parquet';
            //         if (workerMsg.metadata) {
            //             filename = workerMsg.metadata;
            //         } else {
            //             console.error('handleAtl06Msg metadata is undefined using default filename:', filename);
            //         }
            //         triggerDownload(workerMsg.blob,filename);
            //         db.updateRequest(workerMsg.req_id,{file:filename});
            //     } else {
            //         console.error('handleAtl06Msg geoParquet_rcvd blob is undefined');
            //     }
            //     break;

            // case 'feather_rcvd': // DEPRECATED

            //     console.log('handleAtl06Msg feather_rcvd blob:',workerMsg.blob);
            //     if(worker){
            //         cleanUpWorker();
            //     }
            //     if(workerMsg.blob){
            //         let filename = 'atl06.feather';
            //         if (workerMsg.metadata) {
            //             filename = workerMsg.metadata;
            //         } else {
            //             console.error('handleAtl06Msg metadata is undefined using default filename:', filename);
            //         }
            //         triggerDownload(workerMsg.blob,filename);
            //         db.updateRequest(workerMsg.req_id,{file:filename});
            //     } else {
            //         console.error('handleAtl06Msg feather_rcvd blob is undefined');
            //     }
            //     break;

            case 'opfs_ready':
                console.log('handleAtl06Msg opfs_ready');
                if(worker){
                    cleanUpWorker();
                }
                ;
                if (!workerMsg.metadata) { // filename
                    console.error('handleAtl06Msg metadata is undefined');
                    return;
                }
                await processOpfsFile(workerMsg.req_id,workerMsg.metadata)
                break;

            default:
                console.error('handleAtl06Msg unknown status?:',workerMsg.status);
                break;
        }     
    }


    async function runAtl06Worker(srReqRec:SrRequestRecord){
        try{
            if(srReqRec.req_id){
                mapStore.setCurrentReqId(srReqRec.req_id);
                mapStore.isLoading = true; // controls spinning progress
                //worker = new Worker(new URL(path, import.meta.url), { type: 'module' }); // new URL must be inline? per documentation: https://vitejs.dev/guide/features.html#web-workers
                worker = startAtl06Worker();
                worker.onmessage = handleAtl06WorkerMsgEvent;
                worker.onerror = (error) => {
                    if(worker){
                        console.error('Worker error:', error);
                        handleAtl06Error(error, 'Worker faced an unexpected error');
                        cleanUpWorker();
                    }
                };
                const cmd = {type:'run',req_id:srReqRec.req_id, sysConfig: sysConfigStore.getSysConfig(), parameters:srReqRec.parameters} as WebWorkerCmd;
                worker.postMessage(JSON.stringify(cmd));
            } else {
                console.error('runAtl06Worker req_id is undefined');
                toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
            }
        } catch (error) {
            console.error('runAtl06Worker error:',error);
            toast.add({severity: 'error',summary: 'Error', detail: 'An error occurred running the worker', life: srToastStore.getLife() });
        }
    }

    // Types for the Fetch Initialization Options and Blob Construction
    //interface DownloadFileOptions extends RequestInit {}

    // Function to download a file and return it as a Blob
    // async function downloadFile(url: string, options: DownloadFileOptions): Promise<Blob> {
    //     const response = await fetch(url, options);
    //     if (!response.ok) {
    //         throw new Error(`Network response was not ok. Status: ${response.status}`);
    //     }
    //     if (!response.body) {
    //         throw new Error('ReadableStream not supported in this browser.');
    //     }

    //     const reader = response.body.getReader();
    //     const chunks: Uint8Array[] = [];
    //     let loop_done = false;
    //     while (!loop_done) {
    //         const { done, value } = await reader.read();
    //         if (done){
    //             loop_done = true;
    //             break;
    //         }
    //         chunks.push(value);
    //     }
    //     //return new Blob(chunks, { type: 'application/x-parquet' });
    //     return new Blob(chunks, { type: 'application/vnd.apache.parquet' });
    // }
 
    // Function to handle file downloads
    // const handleDownloadParquetFile = async (url:string, filename: string, srRecord:SrRequestRecord ) => {
    //     try {
            
    //         const pReqParms:Atl06pReqParams = srRecord.parameters as Atl06pReqParams;
    //         if(srRecord.req_id){
    //             mapStore.setCurrentReqId(srRecord.req_id);
            
    //             const pparms = {parms: pReqParms.parms } as Atl06pReqParams;
    //             let contentType=''; 
    //             if(pparms.parms.output?.format==='geoparquet' || pparms.parms.output?.format==='parquet'){
    //                 contentType='application/vnd.apache.parquet'; 
    //             } else if(pparms.parms.output?.format==='csv'){
    //                 contentType='text/csv';
    //             } else {
    //                 throw new Error('Unknown output format');
    //             }
    //             const options: RequestInit = {
    //                 method: 'POST',
    //                 headers: {
    //                     'Content-Type': contentType,
    //                     'x-sliderule-streaming': '1'
    //                 },
    //             };
    //             if (pparms != null) {
    //                 options.body = JSON.stringify(pparms);
    //             }
    //             const startedWorkerMsg = await startedMsg(srRecord.req_id,pparms);
    //             await handleAtl06Msg(startedWorkerMsg);
    //             // const response = await downloadFile(url,options);
    //             // if(!response.body){
    //             //     throw new Error('ReadableStream not yet supported in this browser.');
    //             // }
    //             // //const blob = await streamToBlob(response.body, 'application/x-parquet'); 
    //             // const blob = await streamToBlob(response.body, 'application/octet-stream');
    //             triggerDownload(await downloadFile(url,options), filename);
    //             const successWorkerMsg = await successMsg(srRecord.req_id,'Download success');
    //             await handleAtl06Msg(successWorkerMsg);
    //         } else {
    //             console.error('handleDownloadParquetFile req_id is undefined');
    //             toast.add({severity: 'error',summary: 'Error', detail: 'There was an error creating record' });
    //         }
    //     } catch (error) {
    //         console.error('Download failed:', error);
    //     } finally {
    //         mapStore.isLoading = false;
    //     }
    // };

    // // Function to initiate fetch streaming
    // async function downloadFile(url: string,options:RequestInit): Promise<Response> {
    //     console.log('downloadFile url:',url,' options:',options);
    //     const response = await fetch(url,options);
    //     if (!response.ok) {
    //         throw new Error('Network response was not ok.');
    //     }
    //     if (!response.body) {
    //         throw new Error('ReadableStream not yet supported in this browser.');
    //     }
    //     const reader = response.body.getReader();
    //     const stream = new ReadableStream({
    //         async start(controller) {
    //             let read_done = false;
    //             while (!read_done) {
    //                 const { done, value } = await reader.read();
    //                 if (done){
    //                     read_done = true;
    //                     break;
    //                 };
    //                 controller.enqueue(value);
    //             }
    //             controller.close();
    //             reader.releaseLock();
    //         }
    //     });

    //     return new Response(stream);
    // }

    // // Convert the streamed response to a blob
    // async function streamToBlob(stream: ReadableStream<Uint8Array>, mimeType: string): Promise<Blob> {
    //     const blob = await new Response(stream).blob();
    //     return new Blob([blob], { type: mimeType });
    // }

    // Trigger the download process by creating a temporary download link
    function triggerDownload(blob: Blob, filename: string): void {
        console.log('triggerDownload filename:',filename,' blob:',blob);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // function downloadParquetFile(srReqRec:SrRequestRecord) {
    //     const sysConfig = sysConfigStore.getSysConfig();
    //     console.log('sysConfig:', JSON.stringify(sysConfig));
    //     const host = sysConfig.organization && (sysConfig.organization + '.' + sysConfig.domain) || sysConfig.domain;
    //     const api_path = 'source/atl06p';
    //     const url = sysConfig.protocol+'://' + host + '/' + api_path;
    //     const filename = `atl06_${srReqRec.req_id}.parquet`;
    //     handleDownloadParquetFile(url, filename, srReqRec);
    // }

    // Function that is called when the "Run SlideRule" button is clicked
    async function runSlideRuleClicked() {
        mapStore.isLoading = true;
        console.log('runSlideRuleClicked isLoading:',mapStore.isLoading);
        curReqSumStore.setNumAtl06Recs(0);
        curReqSumStore.setTgtAtl06Recs(0);
        curReqSumStore.setNumExceptions(0);
        curReqSumStore.setTgtExceptions(0);
        curReqSumStore.setNumArrowDataRecs(0);
        curReqSumStore.setTgtArrowDataRecs(0);
        curReqSumStore.setNumArrowMetaRecs(0);
        curReqSumStore.setTgtArrowMetaRecs(0);

        requestsStore.setMsg('Running...');
        let srReqRec = await requestsStore.createNewSrRequestRecord();
        if(srReqRec) {
            console.log('runSlideRuleClicked srReqRec:',srReqRec);
            if(missionValue.value.value === 'ICESat-2') {
                if(iceSat2SelectedAPI.value.value === 'atl06') {
                    console.log('atl06 selected');
                    if(!srReqRec.req_id) {
                        console.error('runAtl06 req_id is undefined');
                        toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
                        return;
                    }
                    srReqRec.parameters = reqParamsStore.getAtl06pReqParams(srReqRec.req_id);
                    curReqSumStore.setIsArrowStream(reqParamsStore.isArrowStream);
                    srReqRec.start_time = new Date();
                    srReqRec.end_time = new Date();
                    runAtl06Worker(srReqRec);
                } else if(iceSat2SelectedAPI.value.value === 'atl03') {
                    console.log('atl03 TBD');
                    toast.add({severity: 'info',summary: 'Info', detail: 'atl03 TBD', life: srToastStore.getLife() });
                } else if(iceSat2SelectedAPI.value.value === 'atl08') {
                    console.log('atl08 TBD');
                    toast.add({severity: 'info',summary: 'Info', detail: 'atl08 TBD', life: srToastStore.getLife() });
                } else if(iceSat2SelectedAPI.value.value === 'atl24s') {
                    console.log('atl24s TBD');
                    toast.add({severity: 'info',summary: 'Info', detail: 'atl24s TBD', life: srToastStore.getLife() });
                }
            } else if(missionValue.value.value === 'GEDI') {
                console.log('GEDI TBD');
                toast.add({severity: 'info',summary: 'Info', detail: 'GEDI TBD', life: srToastStore.getLife() });
            }
        } else {
            mapStore.isLoading = false;
            console.error('runSlideRuleClicked srReqRec was undefined');
            toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
        }
    };

</script>
<template>
    <div class="sr-adv-option-sidebar-container">
        <div class="sr-adv-option-sidebar-options">
            <SrMenuInput
                v-model="missionValue"
                label="Mission:"
                :menuOptions="missionItems"
                tooltipText="Select a mission to determine which APIs are available."
                tooltipUrl="https://slideruleearth.io/web/rtd/index.html" 
            />
            <SrMenuInput
                v-model="iceSat2SelectedAPI"
                v-if="missionValue.value === 'ICESat-2'"
                label="ICESat-2 Api:"
                :menuOptions="iceSat2APIsItems"
                :initial-value="iceSat2APIsItems[0]" 
                tootipText="Select an API to use for the selected mission."
                tooltipUrl="https://slideruleearth.io/web/rtd/api_reference/icesat2.html#icesat2"
            />
            <SrMenuInput
                v-model="gediSelectedAPI"
                v-if="missionValue.value === 'GEDI'"
                label="GEDI Api:"
                :menuOptions="gediAPIsItems"
                :initial-value="gediAPIsItems[0]" 
                tooltipText="Select an API to use for the selected mission."
                tooltipUrl="https://slideruleearth.io/web/rtd/api_reference/gedi.html#gedi"
            />
            <div class="button-spinner-container">
                <Button label="Run SlideRule" @click="runSlideRuleClicked" :disabled="mapStore.isLoading"></Button>
                <Button label="Abort" @click="abortClicked" v-if:="mapStore.isLoading" :disabled="mapStore.isAborting"></Button>
                <ProgressSpinner v-if="mapStore.isLoading" animationDuration="1.25s" style="width: 3rem; height: 3rem"/>
            </div>
            <div class="sr-progressbar-panel ">
                <span class="sr-svr-msg">{{requestsStore.getConsoleMsg()}}</span>
                <div class="sr-progressbar">
                    <span></span>
                    <ProgressBar v-if="mapStore.isLoading" :value="useCurAtl06ReqSumStore().getPercentComplete()" />
                </div>  
            </div>
            <SrAdvOptAccordion
                title="Options"
                ariaTitle="advanced-options"
                :mission="missionValue"
                :iceSat2SelectedAPI="iceSat2SelectedAPI"
                :gediSelectedAPI="gediSelectedAPI"
            />
            <SrGraticuleSelect @graticule-click="graticuleClick"/>
        </div>  
    </div>
</template>
<style scoped>
    .sr-adv-option-sidebar-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
    }
    .sr-adv-option-sidebar-options {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    .button-spinner-container {
        display: flex;
        align-items: center; /* This will vertically center the spinner with the button */
        justify-content: center; /* Center the content horizontally */
    }
    .runtest-sr-button {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        margin: 2rem;
    }

    .sr-svr-msg {
        display: block;
        font-size: x-small;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 15rem; 
        justify-content:center;
        align-items: left;
    } 

    .sr-progressbar-panel {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        margin: 0.25rem;
        padding: 0.25rem;
        overflow-x: auto;
        overflow-y: hidden;
        max-width: 15rem;
        min-width: 15rem;
        height: 3rem;
    }

    .sr-progressbar {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: left;
        font-size: x-small;
        min-width: 15rem;
    } 
</style>