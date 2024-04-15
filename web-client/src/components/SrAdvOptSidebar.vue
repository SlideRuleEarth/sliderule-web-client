<script setup lang="ts">

    import SrMenuInput from "@/components/SrMenuInput.vue";
    import SrAdvOptAccordion from "@/components/SrAdvOptAccordion.vue";
    import Button from 'primevue/button';
    import { onMounted, ref, watch } from 'vue';
    import {useToast} from "primevue/usetoast";
    import { atl06p } from '@/sliderule/icesat2.js';
    import { init } from '@/sliderule/core';
    import ProgressSpinner from 'primevue/progressspinner';
    import { updateElevationLayer} from '@/composables/SrMapUtils';
    import { type Elevation } from '@/composables/db';
    import { useMapStore } from '@/stores/mapStore';
    import {useElevationStore} from "@/stores/elevationStore";
    import { Map as OLMap } from 'ol';
    import  SrGraticuleSelect  from "@/components/SrGraticuleSelect.vue";
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import { useSysConfigStore} from "@/stores/sysConfigStore";
    import { useJobsStore, type Job } from "@/stores/jobsStore";
    import { useSrToastStore } from "@/stores/srToastStore";
    import { type Atl06pReqParams } from '@/sliderule/icesat2';
    import { db } from '@/composables/db';
    import { updateElevationExtremes } from '@/composables/SrMapUtils';


    const reqParamsStore = useReqParamsStore();
    const sysConfigStore = useSysConfigStore();
    const jobsStore = useJobsStore();
    const srToastStore = useSrToastStore();
    const graticuleClick = () => {
        const mapStore = useMapStore();
        mapStore.toggleGraticule();
    }
    const elevationStore = useElevationStore();

    const toast = useToast();
    const missionValue = ref({name:'ICESat-2',value:'ICESat-2'});
    const missionItems = ref([{name:'ICESat-2',value:'ICESat-2'},{name:'GEDI',value:'GEDI'}]);
    const iceSat2SelectedAPI = ref({name:'atl06',value:'atl06'});
    const iceSat2APIsItems = ref([{name:'atl06',value:'atl06'},{name:'atl06s',value:'atl06s'},{name:'atl03',value:'atl03'},{name:'atl08',value:'atl08'},{name:'atl24s',value:'atl24s'}]);
    const gediSelectedAPI = ref({name:'gedi01b',value:'gedi01b'});
    const gediAPIsItems = ref([{name:'gedi01b',value:'gedi01b'},{name:'gedi02a',value:'gedi02a'},{name:'gedi04a',value:'gedi04a'}]);
    const isLoading = ref(false);
    const cb_count = ref(0);


    onMounted(() => {
        console.log('SrAdvOptSidebar onMounted');
    });

    watch(() => missionValue,(newValue,oldValue) => {
        console.log(`missionValue changed from ${oldValue} to ${newValue}`);
        if (newValue.value.value === 'ICESat-2') {
            iceSat2SelectedAPI.value.value = 'atl06'; // Reset to default when mission changes
        } else if (newValue.value.value === 'GEDI') {
            gediSelectedAPI.value.value = 'gedi01b'; // Reset to default when mission changes
        }
    });

    async function runAtl06(job:Job){
        console.log('runAtl06');
        const atl06pParams: Atl06pReqParams = reqParamsStore.getAtl06pReqParams();
        jobsStore.updateJob({id: job.id, parameters:atl06pParams, func:'atl06', status: 'pending'});
        init(sysConfigStore.getSysConfig());
        //console.log("runSlideRuleClicked typeof atl06p:",typeof atl06p);
        //console.log("runSlideRuleClicked atl06p:", atl06p);
        let recs:Elevation[] = [];
        const callbacks = {
            atl06rec: (result:any) => {
                // if(cb_count.value === 0) {
                //     console.log('first atl06p cb result["elevation"]:', result["elevation"]); // result["elevation"] is an array of Elevation');
                // }
                const currentRecs = result["elevation"];
                const curFlatRecs = currentRecs.flat();
                elevationStore.addNumRecs(curFlatRecs.length);
                recs.push(curFlatRecs);
                cb_count.value += 1;
                // if(cb_count.value === 1) {
                //     console.log("FIRST: atl06p cb", cb_count.value," result:", result)
                //     const r = curFlatRecs[0];
                //     console.log(`h_mean:${r.h_mean}  min:${elevationStore.getMin()} max:${elevationStore.getMax()}`)
                // }
                // for (let i = 0; i < curFlatRecs.length; i++) {
                //     let rec = curFlatRecs[i];
                //     if(rec.h_mean < elevationStore.getMin()) {
                //         elevationStore.setMin(rec.h_mean);
                //     }
                //     if(rec.h_mean > elevationStore.getMax()) {
                //         elevationStore.setMax(rec.h_mean);
                //     }
                // }
                updateElevationExtremes(curFlatRecs);
                const flatRecs = recs.flat();
                //console.log(`flatRecs.length:${flatRecs.length} lastOne:`,flatRecs[flatRecs.length - 1]);
                updateElevationLayer(flatRecs);
                db.transaction('rw', db.elevations, async () => {
                    try {
                        // Adding req_id to each record in curFlatRecs
                        const updatedFlatRecs: Elevation[] = curFlatRecs.map((rec: Elevation) => ({
                            ...rec,
                            req_id: jobsStore.currentJobId, 
                        }));
                        //console.log('flatRecs.length:', updatedFlatRecs.length, 'curFlatRecs:', updatedFlatRecs);
                        await db.elevations.bulkAdd(updatedFlatRecs);
                        //console.log('Bulk add successful');
                    } catch (error) {
                        console.error('Bulk add failed: ', error);
                        jobsStore.setMsg('DB txn failed');                    
                    }
                }).catch((error) => {
                    console.error('Transaction failed: ', error);
                    jobsStore.setMsg('Transaction failed');
                    toast.add({severity: 'error', summary: 'Transaction failed', detail: error.toString(), life: srToastStore.getLife() });
                });            
            },
            exceptrec: (result:any) => {
                console.log('atl06p cb exceptrec result:', result);
                toast.add({severity: 'error',summary: 'Exception', detail: result['text'], life: srToastStore.getLife() });
                jobsStore.setMsg(result['text']);
                jobsStore.updateJob({id: job.id, status:'processing'});
                jobsStore.setMsg(result['text']);                    },
            eventrec: (result:any) => {
                console.log('atl06p cb eventrec result:', result);
                const this_detail = `Level:${result['level']}  ${result['attr']}`;
                //toast.add({severity: 'info',summary: 'Progress', detail: this_detail, life: srToastStore.getLife() });
                jobsStore.setMsg(this_detail)
                jobsStore.updateJob({id: job.id, status:'processing'});
            },
        };
        const mapStore = useMapStore();
        const map = mapStore.getMap() as OLMap ;
        if (map){
            console.log("atl06p cb_count:",cb_count.value)        
            isLoading.value = true; 
            console.log("atl06pParams:",atl06pParams);
            atl06p(atl06pParams,callbacks)
            .then(
                () => { // result
                    // Log the result to the console
                    // Display a toast message indicating successful completion
                    const flatRecs = recs.flat();
                    console.log(`flatRecs.length:${flatRecs.length} lastOne:`,flatRecs[flatRecs.length - 1]);
                    updateElevationLayer(flatRecs);
                    toast.add({
                        severity: 'success', // Use 'success' severity for successful operations
                        summary: 'Success', // A short summary of the outcome
                        detail: `RunSlideRule completed successfully. recieved ${recs.flat().length} pnts`, 
                        life: 10000 // Adjust the duration as needed
                    });
                    jobsStore.updateJob({id: job.id,status: 'success'});
                },
                error => {
                    // Log the error to the console
                    console.log('runSlideRuleClicked Error = ', error);
                    // Display a toast message indicating the error
                    toast.add({
                        severity: 'error', // Use 'error' severity for error messages
                        summary: 'Error', // A short summary of the error
                        detail: `An error occurred while running SlideRule: ${error}`, // A more detailed error message
                    });
                    let emsg = '';
                    if (navigator.onLine) {
                        emsg =  'Network error: Possible DNS resolution issue or server down.';
                    } else {
                        emsg = 'Network error: your browser appears to be offline.';
                    }
                    toast.add({
                        severity: 'error',   
                        summary: 'Error',   
                        detail: emsg,      
                    });
                    jobsStore.updateJob({id: job.id,status: 'error'});
                }
            ).catch((error => {
                // Log the error to the console
                console.error('runSlideRuleClicked Error = ', error);
                jobsStore.updateJob({id: job.id,status: 'error'});

                // Display a toast message indicating the error
                toast.add({
                    severity: 'error', // Use 'error' severity for error messages
                    summary: 'Error', // A short summary of the error
                    detail: 'An error occurred while running SlideRule.', // A more detailed error message
                });
            })).finally(() => {
                isLoading.value = false;
                console.log(`cb_count:${cb_count.value}`)
            });
        }
    }

    // Function that is called when the "Run SlideRule" button is clicked
    async function runSlideRuleClicked() {
        const job = await jobsStore.createNewJob();
        if(missionValue.value.value === 'ICESat-2') {
            if(iceSat2SelectedAPI.value.value === 'atl06') {
                console.log('atl06 selected');
                await runAtl06(job);
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
        jobsStore.updateJobElapsedTime(job.id);
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
                <Button label="Run SlideRule" @click="runSlideRuleClicked" :disabled="isLoading"></Button>
                <ProgressSpinner v-if="isLoading" animationDuration="1.25s" style="width: 3rem; height: 3rem"/>
                <span v-if="isLoading">Loading... {{ elevationStore.getNumRecs() }}</span>
            </div>
            <div class="sr-svr-msg-console">
                <span class="sr-svr-msg">{{jobsStore.getConsoleMsg()}}</span>
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