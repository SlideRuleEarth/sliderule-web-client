<script setup lang="ts">
    import SrSideBar from "@/components/SrSideBar.vue";
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import SrMenuInput from "@/components/SrMenuInput.vue";
    import SrAdvOptAccordion from "@/components/SrAdvOptAccordion.vue";
    import Button from 'primevue/button';
    import { onMounted, ref, watch } from 'vue';
    import {useToast} from "primevue/usetoast";
    import { atl06p } from '@/sliderule/icesat2.js';
    import { init } from '@/sliderule/core';
    import ProgressSpinner from 'primevue/progressspinner';
    import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
    import { createLegend } from '@/composables/SrMapUtils';
    import { createElevationDeckGLLayer, pnt_cnt } from '@/composables/SrMapUtils';
    import { type ElevationData } from '@/composables/SrMapUtils';
    import { useMapStore } from '@/stores/mapStore';
    import {useElevationStore} from "@/stores/elevationStore";
    import { Map as OLMap } from 'ol';
    import  SrGraticuleSelect  from "@/components/SrGraticuleSelect.vue";
    import { useSrToastStore } from '@/stores/srToastStore.js';
    import { useReqParamsStore } from "@/stores/reqParamsStore";

    const reqParamsStore = useReqParamsStore();
    const toastStore = useSrToastStore();
    const graticuleClick = () => {
        const mapStore = useMapStore();
        mapStore.toggleGraticule();
    }
    const advancedModeStore = useAdvancedModeStore();
    const elevationStore = useElevationStore();

    const toast = useToast();
    const missionValue = ref({name:'ICESat-2',value:'ICESat-2'});
    const missionItems = ref([{name:'ICESat-2',value:'ICESat-2'},{name:'GEDI',value:'GEDI'}]);
    const iceSat2SelectedAPI = ref({name:'atl06',value:'atl06'});
    const iceSat2APIsItems = ref([{name:'atl03',value:'atl03'},{name:'atl06',value:'atl06'},{name:'atl06s',value:'atl06s'},{name:'atl08',value:'atl08'},{name:'atl24s',value:'atl24s'}]);
    const gediSelectedAPI = ref({name:'gedi01b',value:'gedi01b'});
    const gediAPIsItems = ref([{name:'gedi01b',value:'gedi01b'},{name:'gedi02a',value:'gedi02a'},{name:'gedi04a',value:'gedi04a'}]);
    const isLoading = ref(false);
    const cb_count = ref(0);

    onMounted(() => {
        advancedModeStore.advanced = true;
        init({});
    });

    watch(() => missionValue,(newValue,oldValue) => {
        console.log(`missionValue changed from ${oldValue} to ${newValue}`);
        if (newValue.value.value === 'ICESat-2') {
            iceSat2SelectedAPI.value.value = 'atl06'; // Reset to default when mission changes
        } else if (newValue.value.value === 'GEDI') {
            gediSelectedAPI.value.value = 'gedi01b'; // Reset to default when mission changes
        }
    });

    // Function that is called when the "Run SlideRule" button is clicked
    const runSlideRuleClicked = () => {
        // console.log('logoClick');
        toast.add({ severity: 'info', summary: 'Run', detail: 'RunSlideRule was clicked',  life: toastStore.getLife()});
        console.log("runSlideRuleClicked typeof atl06p:",typeof atl06p);
        //console.log("runSlideRuleClicked atl06p:", atl06p);
        //const recs: any[] = [];
        // Create the legend
        let recs:ElevationData[] = [];
        const callbacks = {
            atl06rec: (result:any) => {
                if(cb_count.value === 0) {
                    console.log('first atl06p cb result["elevation"]:', result["elevation"]); // result["elevation"] is an array of ElevationData');
                }
                const currentRecs = result["elevation"];
                const curFlatRecs = currentRecs.flat();
                recs.push(curFlatRecs);
                cb_count.value += 1;
                if(cb_count.value === 1) {
                    console.log("atl06p cb first result:", result)
                    const r = curFlatRecs[0];
                    console.log(`h_mean:${r.h_mean}  min:${elevationStore.getMin()} max:${elevationStore.getMax()}`)
                }
                for (let i = 0; i < curFlatRecs.length; i++) {
                    let rec = curFlatRecs[i];
                    if(rec.h_mean < elevationStore.getMin()) {
                        elevationStore.setMin(rec.h_mean);
                    }
                    if(rec.h_mean > elevationStore.getMax()) {
                        elevationStore.setMax(rec.h_mean);
                    }
                }
            },
        };
        const mapStore = useMapStore();
        const map = mapStore.getMap() as OLMap ;
        if (map){
            console.log("atl06p cb_count:",cb_count.value)        
            isLoading.value = true; 
            console.log("runSlideRuleClicked reqParamsStore:",reqParamsStore);
            atl06p({ 
                    "cnf": reqParamsStore.signalConfidence,   // 'atl03_high'
                    "ats": reqParamsStore.alongTrackSpread,   // 20.0,
                    "cnt": reqParamsStore.minimumPhotonCount, // 10,
                    "len": reqParamsStore.lengthValue,        // 40.0,
                    "res": reqParamsStore.stepValue,          // 20.0,
                    "maxi": reqParamsStore.maxIterations      // 1 
                }, 
                reqParamsStore.resources,
                callbacks
                )
            .then(
                () => { // result
                    // Log the result to the console

                    // Display a toast message indicating successful completion
                    toast.add({
                        severity: 'success', // Use 'success' severity for successful operations
                        summary: 'Success', // A short summary of the outcome
                        detail: 'RunSlideRule completed successfully.', // A more detailed success message
                        life: 10000 // Adjust the duration as needed
                    });
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
                }
            ).catch((error => {
                // Log the error to the console
                console.error('runSlideRuleClicked Error = ', error);

                // Display a toast message indicating the error
                toast.add({
                    severity: 'error', // Use 'error' severity for error messages
                    summary: 'Error', // A short summary of the error
                    detail: 'An error occurred while running SlideRule.', // A more detailed error message
                });
            })).finally(() => {
                const flatRecs = recs.flat();
                const tgt = map.getViewport() as HTMLDivElement; 
                const deckLayer = createElevationDeckGLLayer(flatRecs,tgt);
                map.addLayer(deckLayer);
                isLoading.value = false;
                console.log(`cb_count:${cb_count.value} pnt_cnt: ${pnt_cnt.value}`)
                createLegend();
            });
        }
    };

</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrSideBar>
                <template v-slot:sr-sidebar-body>
                    <div class="card flex justify-content-center">
                        <div class="card flex justify-content-center">
                            <SrMenuInput
                                v-model="missionValue"
                                label="Mission:"
                                :menuOptions="missionItems" 
                            />
                            <SrMenuInput
                                v-model="iceSat2SelectedAPI"
                                v-if="missionValue.value === 'ICESat-2'"
                                label="ICESat-2 Api:"
                                :menuOptions="iceSat2APIsItems"
                                :initial-value="iceSat2APIsItems[0]" 
                            />
                            <SrMenuInput
                                v-model="gediSelectedAPI"
                                v-if="missionValue.value === 'GEDI'"
                                label="GEDI Api:"
                                :menuOptions="gediAPIsItems"
                                :initial-value="gediAPIsItems[0]" 
                            />
                            <SrAdvOptAccordion
                                title="Advanced Options"
                                ariaTitle="advanced-options"
                                :mission="missionValue"
                                :iceSat2SelectedAPI="iceSat2SelectedAPI"
                                :gediSelectedAPI="gediSelectedAPI"
                            />
                            <SrGraticuleSelect @graticule-click="graticuleClick"/>
                        </div>  
                        <div class="button-spinner-container">
                            <Button label="Run SlideRule" @click="runSlideRuleClicked" :disabled="isLoading"></Button>
                            <ProgressSpinner v-if="isLoading" animationDuration="1.25s" style="width: 3rem; height: 3rem"  />
                        </div>
                        <!-- <div class="runtest-sr-button" >
                            <Button label="Run Test" @click="runTestClicked"></Button>
                        </div> -->
                    </div>
                </template>
            </SrSideBar>
        </template>
        <template v-slot:main>
            <SrMap />
        </template>
    </TwoColumnLayout>
</template>
<style scoped>
    .example-slider-input {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
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

</style>