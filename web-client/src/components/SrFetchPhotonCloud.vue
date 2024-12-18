<script setup lang="ts">

    import Button from 'primevue/button';
    import { onMounted,onBeforeUnmount,ref } from 'vue';
    import ProgressSpinner from 'primevue/progressspinner';
    import { processRunSlideRuleClicked, processAbortClicked } from  "@/utils/workerDomUtils";    
    import SrCustomTooltip from './SrCustomTooltip.vue';
    import { useAnalysisMapStore } from '@/stores/analysisMapStore';
    import { useCurReqSumStore } from '@/stores/curReqSumStore';
    import { useReqParamsStore } from '@/stores/reqParamsStore';
    import { useRequestsStore } from "@/stores/requestsStore";

    const tooltipRef = ref();
    const analysisMapStore = useAnalysisMapStore();
    const requestsStore = useRequestsStore();

    onMounted(async () => {
        console.log('SrFetchPhotonCloud onMounted');
        analysisMapStore.setIsAborting(false);
        requestsStore.setSvrMsg('');
        requestsStore.setConsoleMsg(`Click <Overlay Photon Cloud> to fetch and plot Photon Cloud Data`);
    });
    onBeforeUnmount(() => {
        console.log('SrFetchPhotonCloud unmounted');
    });
    function toggleRunAbort() {
        if (analysisMapStore.isLoading) {
            console.log('abortClicked');
            processAbortClicked();
        } else {
            console.log('runClicked for Photon Cloud');
            useReqParamsStore().setMissionValue("ICESat-2");
            useReqParamsStore().setIceSat2API("atl03sp");
            useReqParamsStore().setEnableGranuleSelection(true);
            useReqParamsStore().setUseRgt(true);
            useReqParamsStore().setUseCycle(true);
            processRunSlideRuleClicked();
        }
    }
</script>
<template>
    <div class="sr-run-abort-panel">
        <div class="control-container">
            <div class="button-spinner-container">
                <div v-if="analysisMapStore.isLoading" class="loading-indicator">
                    <ProgressSpinner animationDuration="1.25s" style="width: 2rem; height: 2rem"/>
                    <span class="loading-percentage">{{ useCurReqSumStore().getPercentComplete() }}%</span>
                </div>
                <SrCustomTooltip ref="tooltipRef"/>

                <Button 
                    class="sr-run-abort-button" 
                    :class="{ 'abort-mode': analysisMapStore.isLoading }"
                    :label="analysisMapStore.isLoading ? 'Abort' : 'Overlay Photon Cloud'" 
                    @click="toggleRunAbort" 
                    :disabled="analysisMapStore.isAborting"
                >
                    <template #icon>
                        <i :class="analysisMapStore.isLoading ? 'pi pi-times' : 'pi pi-play'"></i>
                    </template>
                </Button>
            </div>
        </div>
        <div class="sr-msg-panel">
                <span class="sr-console-msg">{{requestsStore.getConsoleMsg()}}</span>
                <span class="sr-svr-msg">{{requestsStore.getSvrMsg()}}</span>
        </div>
    </div>  
</template>
<style scoped>

    .sr-run-abort-panel {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: 1rem;
    }

    .control-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
    }

    .sr-mode-select {
        flex: 1;
    }

    .button-spinner-container {
        display: flex;
        align-items: center;
        flex-direction: row;
        gap: 0.5rem;
    }

    .loading-indicator {
        display: flex;
        align-items: center;
    }

    .loading-percentage {
        margin-left: 0.5rem;
        font-size: 0.9rem;
    }

    .sr-run-abort-button {
        height: 3rem;
        border-radius: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
    }

    button.p-button.p-component.sr-run-abort-button.abort-mode {
        color: #000000;
        background-color: red;
        opacity: 0.5;
    }

    button.p-button.p-component.sr-run-abort-button:not(.abort-mode) {
        color: #000000;
    }

    .sr-msg-panel {
        display: flex;
        flex-direction: column;
        width: 100%;
        background-color: #2c2c2c;
        border-radius: 0.5rem;
        padding: 0.5rem;
        margin-bottom: 0.25rem;
    }

    .sr-console-msg,
    .sr-svr-msg {
        display: block;
        font-size: x-small;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
    }

</style>