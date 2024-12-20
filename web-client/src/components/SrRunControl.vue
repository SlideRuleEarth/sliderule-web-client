<script setup lang="ts">

    import Button from 'primevue/button';
    import { onMounted,onBeforeUnmount,ref,computed } from 'vue';
    import ProgressSpinner from 'primevue/progressspinner';
    import { useMapStore } from '@/stores/mapStore';
    import { useRequestsStore } from "@/stores/requestsStore";
    import { useReqParamsStore } from '@/stores/reqParamsStore';
    import { useCurReqSumStore } from '@/stores/curReqSumStore';
    import { processRunSlideRuleClicked, processAbortClicked } from  "@/utils/workerDomUtils";    
    import SrModeSelect from './SrModeSelect.vue';
    import SrCustomTooltip from './SrCustomTooltip.vue';
    import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
    import Card from 'primevue/card';

    const props = defineProps({
        includeAdvToggle: {
            type: Boolean,
            default: true
        },
        buttonLabel: {
            type: String,
            default: 'Run SlideRule'
        }
    });

    const requestsStore = useRequestsStore();
    const reqParamsStore = useReqParamsStore();
    const mapStore = useMapStore();
    const tooltipRef = ref();

    const highlightedTrackDetails = computed(() => {
        return `rgt:${useAtlChartFilterStore().getRgts()[0].value} cycle:${useAtlChartFilterStore().getCycles()[0].value} track:${useAtlChartFilterStore().getTracks()[0].value} beam:${useAtlChartFilterStore().getBeams()[0].label}`;
    });

    onMounted(async () => {
        console.log('SrRunControl onMounted');
        mapStore.setIsAborting(false);
        requestsStore.setSvrMsg('');
        requestsStore.setSvrMsgCnt(0);
        if(props.includeAdvToggle) { // this means it is the Request Run button
            requestsStore.displayHelpfulMapAdvice("1) Select a geographic region of about several square Km.    Then:\n 2) Click 'Run SlideRule' to start the process");
            requestsStore.setConsoleMsg(`Select a geographic region (several sq Km).  Then click 'Run SlideRule' to start the process`);
            reqParamsStore.presetForMainRequest();
        } else { // this means it is the Overlay Photon Cloud button
            const msg = `Click ${props.buttonLabel} Button to fetch and overlay Photon Cloud Data on plot using highlighted track`;
            requestsStore.displayHelpfulMapAdvice(msg);
            requestsStore.setConsoleMsg(msg);
            reqParamsStore.presetForScatterPlotOverlay();
        }
    });
    onBeforeUnmount(() => {
        console.log(`SrRunControl for ${props.buttonLabel} unmounted`);
    });
    function toggleRunAbort() {
        if (mapStore.isLoading) {
            console.log(`abortClicked for ${props.buttonLabel} calling processAbortClicked`);
            processAbortClicked();
        } else {
            console.log(`Run clicked for ${props.buttonLabel} calling processRunSlideRuleClicked`);
            processRunSlideRuleClicked();
        }
    }
</script>
<template>
    <div class="sr-run-abort-panel">
        <div class="control-container">
            <SrModeSelect class="sr-mode-select" v-if="props.includeAdvToggle"/>
            <div class="button-spinner-container">
                <div v-if="mapStore.isLoading" class="loading-indicator">
                    <ProgressSpinner animationDuration="1.25s" style="width: 2rem; height: 2rem"/>
                    <span class="loading-percentage">{{ useCurReqSumStore().getPercentComplete() }}%</span>
                </div>
                <SrCustomTooltip ref="tooltipRef"/>

                <Button 
                    class="sr-run-abort-button" 
                    :class="{ 'abort-mode': mapStore.isLoading }"
                    :label="mapStore.isLoading ? 'Abort' : props.buttonLabel" 
                    @click="toggleRunAbort" 
                    :disabled="mapStore.isAborting"
                >
                    <template #icon>
                        <i :class="mapStore.isLoading ? 'pi pi-times' : 'pi pi-play'"></i>
                    </template>
                </Button>
                <Card>
                    <template #title>
                        <div class="sr-card-title-center">Highlighted Track</div>
                    </template>
                    <template #content>
                        <p class="m-0">
                            {{ highlightedTrackDetails }}
                        </p>
                    </template>                    
                </Card>
                
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
    .sr-card-title-center {
        text-align: center;
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