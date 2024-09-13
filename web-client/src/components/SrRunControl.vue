<script setup lang="ts">

    import Button from 'primevue/button';
    import { onMounted } from 'vue';
    import ProgressSpinner from 'primevue/progressspinner';
    import { useMapStore } from '@/stores/mapStore';
    import { useReqParamsStore } from "@/stores/reqParamsStore";
    import { useRequestsStore } from "@/stores/requestsStore";
    import { useCurReqSumStore } from '@/stores/curReqSumStore';
    import ProgressBar from 'primevue/progressbar';
    import { processRunSlideRuleClicked } from  "@/utils/workerDomUtils";
    import { processAbortClicked } from  "@/utils/workerDomUtils";    
    import { useAdvancedModeStore } from '@/stores/advancedModeStore';
    import SrModeSelect from './SrModeSelect.vue';

    const reqParamsStore = useReqParamsStore();
    const requestsStore = useRequestsStore();
    const mapStore = useMapStore();
    const advancedModeStore = useAdvancedModeStore();

    const emit = defineEmits(['run-sliderule-clicked', 'abort-clicked']);

    onMounted(async () => {
        console.log('SrRunControl onMounted totalTimeoutValue:',reqParamsStore.totalTimeoutValue);
        mapStore.isAborting = false;
        requestsStore.displayHelpfulMapAdvice("1) Select a geographic region of about several square miles.    Then:\n 2) Click 'Run SlideRule' to start the process");
        requestsStore.setSvrMsg('');
        requestsStore.setSvrMsgCnt(0);
        requestsStore.setConsoleMsg(`Select a geographic region ( a couple sq miles).  Then click 'Run SlideRule' to start the process`);
    });

    function runSlideRuleClicked() {
        console.log('runSlideRuleClicked');
        emit('run-sliderule-clicked');
        if (advancedModeStore.getAdvanced()) {
            //console.log('runSlideRuleClicked advancedMode');
        } else {
            reqParamsStore.initParmsForGenUser();
        }
        processRunSlideRuleClicked();
    }

    function abortClicked() {
        console.log('abortClicked');
        processAbortClicked();
    }

</script>
<template>
    <div class="sr-run-abort-panel">
        <div class="button-spinner-container">
            <Button class="sr-run-button" label="Run SlideRule" @click="runSlideRuleClicked" :disabled="mapStore.isLoading"></Button>
            <Button class="sr-abort-button" label="Abort" @click="abortClicked" :disabled="(mapStore.isAborting || !mapStore.isLoading) "></Button>
            <ProgressSpinner v-if="mapStore.isLoading" animationDuration="1.25s" style="width: 3rem; height: 3rem"/>
        </div>
        <div class="sr-progressbar-panel ">
            <div>
                <span class="sr-console-msg">{{requestsStore.getConsoleMsg()}}</span>
            </div>
            <div>
                <span class="sr-svr-msg">{{requestsStore.getSvrMsg()}}</span>
            </div>
            <div class="sr-progressbar">
                <span></span>
                <ProgressBar v-if="mapStore.isLoading" :value="useCurReqSumStore().getPercentComplete()" />
            </div>
        </div>
        <div>
            <SrModeSelect />
        </div>  
    </div>  
</template>
<style scoped>

    .sr-run-abort-panel {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    .sr-run-button {
        margin: 0.25rem;
    }   
    .sr-abort-button {
        margin: 0.25rem;
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

    .sr-console-msg {
        display: block;
        font-size: x-small;
        white-space: nowrap;
        overflow: hidden;
        overflow-x: auto;
        overflow-y: hidden;
        /* text-overflow: ellipsis; */
        max-width: 25rem; 
        justify-content:center;
        align-items: left;
    } 

    .sr-svr-msg {
        display: block;
        font-size: x-small;
        white-space: nowrap;
        overflow: hidden;
        overflow-x: auto;
        overflow-y: hidden;
        /* text-overflow: ellipsis; */
        max-width: 25rem; 
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
        max-width: 25rem;
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