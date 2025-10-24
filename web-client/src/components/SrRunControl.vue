<script setup lang="ts">

    import Button from 'primevue/button';
    import { onMounted,onBeforeUnmount,ref,computed } from 'vue';
    import ProgressSpinner from 'primevue/progressspinner';
    import { useRequestsStore } from "@/stores/requestsStore";
    import { useCurReqSumStore } from '@/stores/curReqSumStore';
    import { processRunSlideRuleClicked, processAbortClicked } from  "@/utils/workerDomUtils";    
    import SrModeSelect from './SrModeSelect.vue';
    import SrCustomTooltip from './SrCustomTooltip.vue';
    import { useSrToastStore } from "@/stores/srToastStore";
    import { useServerStateStore } from '@/stores/serverStateStore';
    import { createLogger } from '@/utils/logger';

    const logger = createLogger('SrRunControl');

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
    const tooltipRef = ref();
    const enableRunButton = computed(() => {
        return (((serverStateStore.isAborting ||  serverStateStore.isFetching ) && !props.includeAdvToggle) || props.includeAdvToggle);
    });
    const showRunButton = computed(() => {
        return (((serverStateStore.isAborting || serverStateStore.isFetching ) && !props.includeAdvToggle) || props.includeAdvToggle);
    });

    onMounted(() => {
        logger.debug('onMounted', { includeAdvToggle: props.includeAdvToggle });
        requestsStore.setSvrMsg('');
        requestsStore.setSvrMsgCnt(0);
        if(props.includeAdvToggle) { // this means it is the Request Run button
            requestsStore.displayHelpfulMapAdvice("1) Zoom in\n 2) Select a geographic region of about several square Km.    Then:\n 3) Click 'Run SlideRule' to start the process");
            requestsStore.setConsoleMsg(`Zoom in and select a geographic region (several sq Km).  Then click 'Run SlideRule' to start the process`);
        } else { // this means it is the Overlay Photon Cloud button
            const msg = `Click 'Show Atl03 Photon Cloud' to fetch highlighted track Photon Cloud data and overlay on plot`;
            requestsStore.displayHelpfulMapAdvice(msg);
            requestsStore.setConsoleMsg(msg);
        }
        //console.log(`SrRunControl for ${props.buttonLabel} mounted show button:`,enableRunButton.value);
    });

    onBeforeUnmount(() => {
        logger.debug('onBeforeUnmount', { buttonLabel: props.buttonLabel });
    });

    async function toggleRunAbort() {
        if (serverStateStore.isFetching) {
            logger.debug('abortClicked calling processAbortClicked', { buttonLabel: props.buttonLabel });
            processAbortClicked();
        } else {
            logger.debug('Run button pressed calling processRunSlideRuleClicked', { buttonLabel: props.buttonLabel });
            if(props.includeAdvToggle){
                try{
                    await processRunSlideRuleClicked();
                } catch (error) {
                    logger.error('Error in processRunSlideRuleClicked', { error: error instanceof Error ? error.message : String(error) });
                    srToastStore.error(`There was a software error:${error}`);
                }
            } else {
                logger.error('SrRunControl clicked for Overlay Photon Cloud?');
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
                <SrCustomTooltip ref="tooltipRef" id="runControlTootip"/>
                <Button
                    v-show="showRunButton"
                    class="sr-run-abort-button p-button-rounded p-button-text"
                    :class="{ 'abort-mode': serverStateStore.isFetching }"
                    @click="toggleRunAbort"
                    :disabled="!enableRunButton"
                >
                    <div class="button-content">
                        <i :class="serverStateStore.isFetching ? 'pi pi-times' : 'pi pi-play'"></i>
                        <div
                            class="button-label-text"
                            :class="{ 'no-wrap': serverStateStore.isFetching }"
                            v-html="(serverStateStore.isFetching ? 'Abort' : props.buttonLabel).replaceAll('\n', '<br>')"
                        ></div>
                    </div>
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
        background-color: #333;
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
        /* color: #000000; */
        color: var(--p-button-text-primary-color);
        border-color: var(--p-button-primary-border-color);
        border-width: 1px;
    }

    :deep(.p-button-rounded:hover) {
        border-width: 1px;
        border-color: var(--primary-color);
        box-shadow: 0 0 12px var(--p-button-primary-border-color), 0 0 20px var(--p-button-primary-border-color);
        transition: box-shadow 0.3s ease;
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
    .button-content {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 0.25rem;
    }

    .button-content .button-label-text {
        white-space: normal;
        line-height: 1.2;
    }
</style>
<style>
    .button-content {
        display: flex;
        flex-direction: row; 
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        text-align: center;
    }

    .button-label-text {
        white-space: normal; 
        line-height: 1.2;
        text-align: center;
    }

    .button-label-text.no-wrap {
        white-space: nowrap;
    }
</style>