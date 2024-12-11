<script setup lang="ts">

    import Button from 'primevue/button';
    import { onMounted,onBeforeUnmount,ref } from 'vue';
    import ProgressSpinner from 'primevue/progressspinner';
    import { useMapStore } from '@/stores/mapStore';
    import { db } from '@/db/SlideRuleDb';
    import { useRequestsStore } from "@/stores/requestsStore";
    import { useCurReqSumStore } from '@/stores/curReqSumStore';
    import { processRunSlideRuleClicked, processAbortClicked } from  "@/utils/workerDomUtils";    
    import SrModeSelect from './SrModeSelect.vue';
    import { useToast } from "primevue/usetoast";
    import { useSrToastStore } from "@/stores/srToastStore";
    import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
    import router from '@/router/index.js';
    import { computed } from 'vue';
    import SrCustomTooltip from './SrCustomTooltip.vue';
    import { elIsLoaded } from '@/utils/SrParquetUtils';

    const toast = useToast();
    const srToastStore = useSrToastStore();
    const atlChartFilterStore = useAtlChartFilterStore();
    const requestsStore = useRequestsStore();
    const mapStore = useMapStore();
    const tooltipRef = ref();

    const emit = defineEmits(['run-sliderule-clicked', 'abort-clicked']);
    const computedDataLoaded = computed(() =>(elIsLoaded()));
    onMounted(async () => {
        console.log('SrRunControl onMounted');
        mapStore.isAborting = false;
        requestsStore.displayHelpfulMapAdvice("1) Select a geographic region of about several square Km.    Then:\n 2) Click 'Run SlideRule' to start the process");
        requestsStore.setSvrMsg('');
        requestsStore.setSvrMsgCnt(0);
        requestsStore.setConsoleMsg(`Select a geographic region (several sq Km).  Then click 'Run SlideRule' to start the process`);
    });
    onBeforeUnmount(() => {
        console.log('SrRunControl unmounted');
    });
    function toggleRunAbort() {
        if (mapStore.isLoading) {
            console.log('abortClicked');
            processAbortClicked();
        } else {
            console.log('runSlideRuleClicked');
            emit('run-sliderule-clicked');
            processRunSlideRuleClicked();
        }
    }
    const getActiveReqId = async () => {
        const items = await requestsStore.getMenuItems();
        if (items.length === 0) {
            return 0;
        }
        const reqIdStr = items[0].value;
        return Number(reqIdStr);
    };

    const goToAnalysisForCurrent = async () => {
        const reqId = await getActiveReqId();
        if (reqId > 0) {
            atlChartFilterStore.setReqId(reqId);
            router.push(`/analyze/${reqId}`);
        } else {
            toast.add({ severity: 'warn', summary: 'No Requests Found', detail: 'Please create a request first', life: srToastStore.getLife() });
        }
    };
    const analysisButtonClick = async () => {
        if (atlChartFilterStore.getReqId()) {
            router.push(`/analyze/${atlChartFilterStore.getReqId()}`);
        } else {
            goToAnalysisForCurrent();
        }
    };

    const exportButtonClick = async () => {
        let req_id = 0;
        try {
            req_id = await getActiveReqId();
            const fileName = await db.getFilename(req_id);
            const opfsRoot = await navigator.storage.getDirectory();
            const folderName = 'SlideRule'; 
            const directoryHandle = await opfsRoot.getDirectoryHandle(folderName, { create: false });
            const fileHandle = await directoryHandle.getFileHandle(fileName, {create:false});
            const file = await fileHandle.getFile();
            const url = URL.createObjectURL(file);
            // Create a download link and click it programmatically
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Revoke the object URL
            URL.revokeObjectURL(url);
            const msg = `File ${fileName} exported successfully!`;
            console.log(msg);
            alert(msg);

        } catch (error) {
            console.error(`Failed to expport req_id:${req_id}`, error);
            alert(`Failed to export file for req_id:${req_id}`);
            throw error;
        }
    };
</script>
<template>
    <div class="sr-run-abort-panel">
        <div class="control-container">
            <SrModeSelect class="sr-mode-select" />
            <div class="button-spinner-container">
                <div v-if="mapStore.isLoading" class="loading-indicator">
                    <ProgressSpinner animationDuration="1.25s" style="width: 2rem; height: 2rem"/>
                    <span class="loading-percentage">{{ useCurReqSumStore().getPercentComplete() }}%</span>
                </div>
                <Button
                    v-if=computedDataLoaded
                    icon="pi pi-chart-line"
                    @mouseover="tooltipRef.showTooltip($event, 'Analyze the current request')"
                    @mouseleave="tooltipRef.hideTooltip()"
                    @click="analysisButtonClick"
                    rounded 
                    aria-label="Analyze"
                    size="small"
                    severity="text" 
                    variant="text"
                >
                </Button>
                <Button
                    v-if=computedDataLoaded
                    icon="pi pi-file-export"
                    @mouseover="tooltipRef.showTooltip($event, 'Export the current request')"
                    @mouseleave="tooltipRef.hideTooltip()"
                    @click="exportButtonClick"
                    rounded 
                    aria-label="Export"
                    size="small"
                    severity="text" 
                    variant="text"
                >
                </Button>
                <SrCustomTooltip ref="tooltipRef"/>

                <Button 
                    class="sr-run-abort-button" 
                    :class="{ 'abort-mode': mapStore.isLoading }"
                    :label="mapStore.isLoading ? 'Abort' : 'Run SlideRule'" 
                    @click="toggleRunAbort" 
                    :disabled="mapStore.isAborting"
                >
                    <template #icon>
                        <i :class="mapStore.isLoading ? 'pi pi-times' : 'pi pi-play'"></i>
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