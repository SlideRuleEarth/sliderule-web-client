<script setup lang="ts">

    import SrMenuInput from "@/components/SrMenuInput.vue";
    import SrAdvOptAccordion from "@/components/SrAdvOptAccordion.vue";
    import Button from 'primevue/button';
    import { onMounted, watch } from 'vue';
    import ProgressSpinner from 'primevue/progressspinner';
    import { useMapStore } from '@/stores/mapStore';
    import  SrGraticuleSelect  from "@/components/SrGraticuleSelect.vue";
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import { useRequestsStore } from "@/stores/requestsStore";
    import { useCurReqSumStore } from '@/stores/curReqSumStore';
    import ProgressBar from 'primevue/progressbar';
    import SrReqDisplay from '@/components/SrReqDisplay.vue';
    import { processRunSlideRuleClicked } from "@/utils/workerDomUtils"
    import { processAbortClicked } from "@/utils/workerDomUtils"

    const reqParamsStore = useReqParamsStore();
    const requestsStore = useRequestsStore();
    const mapStore = useMapStore();
    
    const graticuleClick = () => {
        mapStore.toggleGraticule();
    }

    onMounted(async () => {
        //console.log('SrAdvOptSidebar onMounted totalTimeoutValue:',reqParamsStore.totalTimeoutValue);
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

    watch(() => useReqParamsStore().missionValue,(newValue,oldValue) => {
        //console.log(`missionValue changed from ${oldValue} to ${newValue}`);
        if (newValue.value === 'ICESat-2') {
            useReqParamsStore().iceSat2SelectedAPI = useReqParamsStore().iceSat2APIsItems[0]; // Reset to default when mission changes
            reqParamsStore.asset ='icesat2';
        } else if (newValue.value === 'GEDI') {
            useReqParamsStore().gediSelectedAPI = useReqParamsStore().gediAPIsItems[0]; // Reset to default when mission changes
            reqParamsStore.asset ='gedi';
        }
    });

    function runSlideRuleClicked() {
        //console.log('runSlideRuleClicked');
        processRunSlideRuleClicked();
    }

    function abortClicked() {
        //console.log('abortClicked');
        processAbortClicked();
    }

</script>
<template>
    <div class="sr-adv-option-sidebar-container">
        <div class="sr-adv-option-sidebar-options">
            <SrMenuInput
                v-model="useReqParamsStore().missionValue"
                label="Mission:"
                :menuOptions="useReqParamsStore().missionItems"
                tooltipText="Select a mission to determine which APIs are available."
                tooltipUrl="https://slideruleearth.io/web/rtd/index.html" 
            />
            <SrMenuInput
                v-model="useReqParamsStore().iceSat2SelectedAPI"
                v-if="useReqParamsStore().missionValue.value === 'ICESat-2'"
                label="ICESat-2 Api:"
                :menuOptions="useReqParamsStore().iceSat2APIsItems"
                :initial-value="useReqParamsStore().iceSat2APIsItems[0]" 
                tootipText="Select an API to use for the selected mission."
                tooltipUrl="https://slideruleearth.io/web/rtd/api_reference/icesat2.html#icesat2"
            />
            <SrMenuInput
                v-model="useReqParamsStore().gediSelectedAPI"
                v-if="useReqParamsStore().missionValue.value === 'GEDI'"
                label="GEDI Api:"
                :menuOptions="useReqParamsStore().gediAPIsItems"
                :initial-value="useReqParamsStore().gediAPIsItems[0]" 
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
                    <ProgressBar v-if="mapStore.isLoading" :value="useCurReqSumStore().getPercentComplete()" />
                </div>  
            </div>
            <div>
                <SrReqDisplay />
            </div>
            <SrAdvOptAccordion
                title="Options"
                ariaTitle="advanced-options"
                :mission="useReqParamsStore().missionValue"
                :iceSat2SelectedAPI="useReqParamsStore().iceSat2SelectedAPI"
                :gediSelectedAPI="useReqParamsStore().gediSelectedAPI"
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