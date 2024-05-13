<script setup lang="ts">

    import SrMenuInput from "@/components/SrMenuInput.vue";
    import SrAdvOptAccordion from "@/components/SrAdvOptAccordion.vue";
    import Button from 'primevue/button';
    import { onMounted, ref, watch } from 'vue';
    import {useToast} from "primevue/usetoast";
    //import { REC_VERSION, init, populateAllDefinitions, set_num_defs_fetched, get_num_defs_fetched } from '@/sliderule/core';
    import { init } from '@/sliderule/core';
    import ProgressSpinner from 'primevue/progressspinner';
    import { useMapStore } from '@/stores/mapStore';
    import  SrGraticuleSelect  from "@/components/SrGraticuleSelect.vue";
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import { useSysConfigStore} from "@/stores/sysConfigStore";
    import { useRequestsStore } from "@/stores/requestsStore";
    import { type SrRequestRecord } from '@/db/SlideRuleDb';
    import { useSrToastStore } from "@/stores/srToastStore";
    import { useCurAtl06ReqSumStore } from '@/stores/curAtl06ReqSumStore';
    import { WorkerSummary } from '@/workers/workerUtils';
    import { WorkerMessage } from '@/workers/workerUtils';
    import { WebWorkerCmd } from "@/workers/workerUtils";
    import { type TimeoutHandle } from '@/stores/mapStore';
    import { fetchAndUpdateElevationData } from '@/composables/SrMapUtils';
    import SrProgress  from "@/components/SrProgress.vue";

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
        } else if (newValue.value.value === 'GEDI') {
            gediSelectedAPI.value.value = 'gedi01b'; // Reset to default when mission changes
        }
    });


    const handleAtl06WorkerMsg = async (event: MessageEvent) => {
        if(worker){
            const workerMsg:WorkerMessage = event.data;
            //console.log('handleAtl06WorkerMsg Worker event:',event);
            switch(workerMsg.status){
                case 'success':
                    console.log('handleAtl06WorkerMsg success:',workerMsg.msg);
                    toast.add({severity: 'info',summary: 'Download success', detail: 'loading rest of points into db...', life: srToastStore.getLife() });
                    toast.add({severity: 'success',summary: 'Success', detail: workerMsg.msg, life: srToastStore.getLife() });
                    cleanUpWorker(worker);
                    fetchAndUpdateElevationData(mapStore.getCurrentReqId());
                    break;
                case 'started':
                    console.log('handleAtl06WorkerMsg started');
                    toast.add({severity: 'info',summary: 'Started', detail: workerMsg.msg, life: srToastStore.getLife() });
                    await mapStore.drawElevations();
                    break;
                case 'aborted':
                    console.log('handleAtl06WorkerMsg aborted');
                    toast.add({severity: 'warn',summary: 'Aborted', detail: workerMsg.msg, life: srToastStore.getLife() });
                    requestsStore.setMsg('Job aborted');
                    cleanUpWorker(worker);
                    break;
                case 'server_msg':
                    console.log('handleAtl06WorkerMsg server_msg:',workerMsg.msg);
                    if(workerMsg.msg){
                        requestsStore.setMsg(workerMsg.msg);
                    }
                    break;
                case 'progress':
                    console.log('handleAtl06WorkerMsg progress:',workerMsg.progress);
                    if(workerMsg.progress){
                        curReqSumStore.setReadState(workerMsg.progress.read_state);
                        curReqSumStore.setNumRecs(workerMsg.progress.numAtl06Recs); 
                        curReqSumStore.setTgtRecs(workerMsg.progress.target_numAtl06Recs);
                        curReqSumStore.setNumExceptions(workerMsg.progress.numAtl06Exceptions);
                        curReqSumStore.setTgtExceptions(workerMsg.progress.target_numAtl06Exceptions);
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
                    console.log('handleAtl06WorkerMsg summary:',workerMsg);
                    if(workerMsg){
                        const sMsg = workerMsg as WorkerSummary;
                        curReqSumStore.setSummary(sMsg);
                    }
                    break;
                case 'error':
                    if(workerMsg.error){
                        console.log('handleAtl06WorkerMsg error:',workerMsg.error);
                        toast.add({severity: 'error',summary: workerMsg.error?.type, detail: workerMsg.error?.message, life: srToastStore.getLife() });
                    }
                    cleanUpWorker(worker);
                    console.log('Error... isLoading:',mapStore.isLoading);
                    break;
                default:
                    console.error('handleAtl06WorkerMsg unknown status?:',workerMsg.msg);
                    break;
            }
        } else {
            console.error('handleAtl06WorkerMsg worker was undefined');
        }
    }

    function handleError(worker, error, errorMsg) {
        console.error('Error:', error);
        toast.add({ severity: 'error', summary: 'Error', detail: errorMsg, life: srToastStore.getLife() });
        cleanUpWorker(worker);
    }

    function cleanUpWorker(worker){
        //mapStore.unsubscribeLiveElevationQuery();
        if (workerTimeoutHandle) {
            clearTimeout(workerTimeoutHandle);
            workerTimeoutHandle = null;
        }        if(worker){
            worker.terminate();
            worker = null;
        }

        //mapStore.clearRedrawElevationsTimeoutHandle();
        mapStore.isLoading = false; // controls spinning progress
        mapStore.isAborting = false;
        console.log('cleanUpWorker -- isLoading:',mapStore.isLoading);
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

    async function runAtl06Worker(req:SrRequestRecord){
        try{
            if(req.req_id){
                mapStore.setCurrentReqId(req.req_id);
                mapStore.isLoading = true; // controls spinning progress
                worker = new Worker(new URL('../workers/atl06ToDb', import.meta.url), { type: 'module' }); // new URL must be inline? per documentation: https://vitejs.dev/guide/features.html#web-workers
                worker.onmessage = handleAtl06WorkerMsg;
                worker.onerror = (error) => {
                    if(worker){
                        handleError(worker, error, 'Worker faced an unexpected error');
                        worker = null;
                    }
                };
                const cmd = {type:'run',req_id:req.req_id, parameters:req.parameters} as WebWorkerCmd;
                curReqSumStore.setNumRecs(0);
                curReqSumStore.setTgtRecs(0);
                curReqSumStore.setNumExceptions(0);
                curReqSumStore.setTgtExceptions(0);
                requestsStore.setMsg('Running...');
                worker.postMessage(JSON.stringify(cmd));
                const timeoutDuration = reqParamsStore.totalTimeoutValue*1000; // Convert to milliseconds
                console.log('runAtl06Worker with timeoutDuration:',timeoutDuration, ' milliseconds redraw Elevations every:',mapStore.redrawTimeOutSeconds, ' seconds for req_id:',req.req_id);
                workerTimeoutHandle = setTimeout(() => {
                    if (worker) {
                        console.error('Timeout: Worker operation timed out in:',timeoutDuration+30000); // add thirty seconds to the timeout to let server timeout first
                        handleError(worker, 'Timeout', 'Worker operation timed out');
                        worker = null;
                    }
                }, timeoutDuration);
            } else {
                console.error('runAtl06Worker req_id is undefined');
                toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
            }
        } catch (error) {
            console.error('runAtl06Worker error:',error);
            toast.add({severity: 'error',summary: 'Error', detail: 'An error occurred running the worker', life: srToastStore.getLife() });
        }
    }

    // Function that is called when the "Run SlideRule" button is clicked
    async function runSlideRuleClicked() {
        mapStore.isLoading = true;
        init(sysConfigStore.getSysConfig());
        console.log('runSlideRuleClicked isLoading:',mapStore.isLoading);
        let req = await requestsStore.createNewReq();
        if(req) {
            console.log('runSlideRuleClicked req:',req);
            if(missionValue.value.value === 'ICESat-2') {
                if(iceSat2SelectedAPI.value.value === 'atl06') {
                    console.log('atl06 selected');
                    req.parameters = reqParamsStore.getAtl06pReqParams();
                    req.start_time = new Date();
                    req.end_time = new Date();
                    if(!req.req_id) {
                        console.error('runAtl06 req_id is undefined');
                        toast.add({severity: 'error',summary: 'Error', detail: 'There was an error' });
                        return;
                    }
                    runAtl06Worker(req);
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
            console.error('runSlideRuleClicked req was undefined');
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
                <span v-if="mapStore.isLoading">Loading... {{ curReqSumStore.getNumRecs() }}</span>
            </div>
            <div class="sr-svr-msg-console">
                <span class="sr-svr-msg">{{requestsStore.getConsoleMsg()}}</span>
            </div>
            <div class="progress">
                <SrProgress />
            </div>
            <SrAdvOptAccordion
                title="Advanced Options"
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
    .sr-svr-msg-console {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        margin: 0.25rem;
        padding: 0.25rem;
        overflow-x: auto;
        overflow-y: hidden;
        max-width: 20rem;
        height: 2rem;
    } 
    .sr-svr-msg {
        font-size: x-small;
        white-space: nowrap;
    }  
</style>