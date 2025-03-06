<script setup lang="ts">

    import Button from 'primevue/button';
    import { onMounted,onBeforeUnmount,ref,computed } from 'vue';
    import ProgressSpinner from 'primevue/progressspinner';
    import { useMapStore } from '@/stores/mapStore';
    import { useRequestsStore } from "@/stores/requestsStore";
    import { useCurReqSumStore } from '@/stores/curReqSumStore';
    import { processRunSlideRuleClicked, processAbortClicked } from  "@/utils/workerDomUtils";    
    import SrModeSelect from './SrModeSelect.vue';
    import SrCustomTooltip from './SrCustomTooltip.vue';
    import { useSrToastStore } from "@/stores/srToastStore";
    import { useServerStateStore } from '@/stores/serverStateStore';

    const props = defineProps({
        includeAdvToggle: {
            type: Boolean,
            default: false
        },
        buttonLabel: {
            type: String,
            default: 'Run SlideRule'
        },
    });

    const srToastStore = useSrToastStore();
    const requestsStore = useRequestsStore();
    const serverStateStore = useServerStateStore();
    const mapStore = useMapStore();
    const tooltipRef = ref();
    const enableRunButton = computed(() => {
        return (((mapStore.isAborting ||  serverStateStore.isFetching ) && !props.includeAdvToggle) || props.includeAdvToggle);
    });
    const showRunButton = computed(() => {
        return (((mapStore.isAborting || serverStateStore.isFetching ) && !props.includeAdvToggle) || props.includeAdvToggle);
    });

    onMounted(async () => {
        console.log('SrRunControl onMounted props.includeAdvToggle:',props.includeAdvToggle);
        mapStore.setIsAborting(false);
        requestsStore.setSvrMsg('');
        requestsStore.setSvrMsgCnt(0);
        if(props.includeAdvToggle) { // this means it is the Request Run button
            requestsStore.displayHelpfulMapAdvice("1) Zoom in\n 2) Select a geographic region of about several square Km.    Then:\n 3) Click 'Run SlideRule' to start the process");
            requestsStore.setConsoleMsg(`Zoom in and select a geographic region (several sq Km).  Then click 'Run SlideRule' to start the process`);
        } else { // this means it is the Overlay Photon Cloud button
            const msg = `Click 'Show Atl03 Photons' to fetch highlighted track Photon Cloud data and overlay on plot`;
            requestsStore.displayHelpfulMapAdvice(msg);
            requestsStore.setConsoleMsg(msg);
        }
        //console.log(`SrRunControl for ${props.buttonLabel} mounted show button:`,enableRunButton.value);
    });

    onBeforeUnmount(() => {
        console.log(`SrRunControl for ${props.buttonLabel} unmounted`);
    });

    async function toggleRunAbort() {
        if (serverStateStore.isFetching) {
            console.log(`abortClicked for ${props.buttonLabel} calling processAbortClicked`);
            processAbortClicked();
        } else {
            console.log(`Run button pressed for ${props.buttonLabel} calling processRunSlideRuleClicked`);
            if(props.includeAdvToggle){
                try{
                    await processRunSlideRuleClicked();
                } catch (error) {
                    console.error('Error in processRunSlideRuleClicked:',error);
                    srToastStore.error(`There was a software error:${error}`);
                }
            } else {
                console.error('SrRunControl clicked for Overlay Photon Cloud?');
            }
        }
    }
</script>
<template>
    <div class="sr-run-abort-panel">
        <div class="control-container">
            <SrModeSelect class="sr-mode-select" v-if="props.includeAdvToggle"/>
            <div class="button-spinner-container">
                <div v-if="serverStateStore.isFetching" class="loading-indicator">
                    <ProgressSpinner animationDuration="1.25s" style="width: 2rem; height: 2rem"/>
                    <span class="loading-percentage">{{ useCurReqSumStore().getPercentComplete() }}%</span>
                </div>
                <SrCustomTooltip ref="tooltipRef"/>
               <Button
                    v-show="showRunButton"
                    class="sr-run-abort-button" 
                    :class="{ 'abort-mode':  serverStateStore.isFetching }"
                    :label=" serverStateStore.isFetching ? 'Abort' : props.buttonLabel" 
                    @click="toggleRunAbort" 
                    :disabled="!enableRunButton"
                >
                    <template #icon>
                        <i :class=" serverStateStore.isFetching ? 'pi pi-times' : 'pi pi-play'"></i>
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
        justify-content:flex-start;
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