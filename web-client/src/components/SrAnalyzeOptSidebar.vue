<script setup lang="ts">
import { onMounted,ref,watch,computed } from 'vue';
import SrAnalysisMap from '@/components/SrAnalysisMap.vue';
import SrRecIdReqDisplay from '@/components/SrRecIdReqDisplay.vue';
//import router from '@/router/index.js';
import { db } from '@/db/SlideRuleDb';
//import { duckDbReadAndUpdateElevationData } from '@/utils/SrDuckDbUtils';
import { formatBytes } from '@/utils/SrParquetUtils';
import { useMapStore } from '@/stores/mapStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useDeckStore } from '@/stores/deckStore';
//import { debounce } from "lodash";
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { useToast } from 'primevue/usetoast';
import { useSrToastStore } from "@/stores/srToastStore";
import SrEditDesc from '@/components/SrEditDesc.vue';
import SrPlotConfig from "@/components/SrPlotConfig.vue";
import { useChartStore } from '@/stores/chartStore';
import SrCustomTooltip from '@/components/SrCustomTooltip.vue';
import Button from 'primevue/button';
import SrFilterCntrl from './SrFilterCntrl.vue';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useGlobalChartStore } from '@/stores/globalChartStore';
//import { processNewReqId } from "@/utils/SrMapUtils";

const atlChartFilterStore = useAtlChartFilterStore();
const mapStore = useMapStore();
const recTreeStore = useRecTreeStore();


const props = defineProps({
    startingReqId: {
        type:Number, 
        default:0
    }
});
const tooltipRef = ref();
const loadingThisSFC = ref(true);
const isMounted = ref(false);

const computedInitializing = computed(() => {
    return !isMounted.value || loadingThisSFC.value || recTreeStore.reqIdMenuItems.length == 0 || recTreeStore.selectedReqId <= 0;
});


onMounted(async () => {
    // the router sets the startingReqId and the recTreeStore.reqIdMenuItems
    console.log(`onMounted SrAnalyzeOptSidebar startingReqId: ${props.startingReqId}`);
    // await processNewReqId();
    loadingThisSFC.value = false;
    isMounted.value = true;
});


const exportButtonClick = async () => {
    let req_id = recTreeStore.selectedReqId;
    try {
        if(req_id>0){
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
        } else {
            console.error("useAtlChartFilterStore().selectedReqIdMenuItem is undefined")
        }
    } catch (error) {
        console.error(`Failed to expport req_id:${req_id}`, error);
        alert(`Failed to export file for req_id:${req_id}`);
        throw error;
    }
};


</script>

<template>
    <div class="sr-analysis-opt-sidebar">
        <SrCustomTooltip ref="tooltipRef"/>
        <div class="sr-analysis-opt-sidebar-container" v-if="loadingThisSFC">Loading...</div>
        <div class="sr-analysis-opt-sidebar-container" v-else>
            <div class="sr-map-descr">
                <div class="sr-analysis-opt-sidebar-map" ID="AnalysisMapDiv">
                    <div v-if="computedInitializing">Loading...{{ recTreeStore.selectedApi }}</div>
                    <SrAnalysisMap 
                        v-else-if="(recTreeStore.selectedReqId > 0)"
                        :selectedReqId="recTreeStore.selectedReqId"
                    />
                </div>
                <div class="sr-req-description">
                    <SrEditDesc :reqId="recTreeStore.selectedReqId"/>
                    <Button
                        icon="pi pi-file-export"
                        class="sr-export-button"
                        label="Export"
                        @mouseover="tooltipRef.showTooltip($event, 'Export the parquet file of this record')"
                        @mouseleave="tooltipRef.hideTooltip()"
                        @click="exportButtonClick"
                        rounded 
                        aria-label="Export"
                        variant="text"
                    >
                    </Button>

                </div>
            </div>
            <div class="sr-sidebar-analysis-opt">
                <div class="sr-analysis-rec-parms">
                    <SrRecIdReqDisplay :reqId=recTreeStore.selectedReqId :label="`Show req parms for record:${recTreeStore.selectedReqId}`"/>
                </div>
                <div class="sr-filter-cntrl-container">
                    <SrFilterCntrl></SrFilterCntrl>
                </div>
                <div class="sr-scatterplot-cfg-container">
                    <!-- SrPlotConfig for the main req_id -->
                    <div class="sr-scatterplot-cfg">
                        <SrPlotConfig
                            v-if="mapStore.analysisMapInitialized" 
                            :reqId="recTreeStore.selectedReqId"
                        />
                    </div>

                    <!-- SrPlotConfig for each overlayed req_id -->
                    <div class="sr-scatterplot-cfg" v-for="overlayedReqId in atlChartFilterStore.selectedOverlayedReqIds" :key=overlayedReqId>
                        <SrPlotConfig
                            v-if="mapStore.analysisMapInitialized" 
                            :reqId="overlayedReqId"
                            :isOverlay="true" 
                        />
                    </div>
                </div> 
            </div>       
        </div>
    </div>
</template>
<style scoped>
    


    .sr-analysis-opt-sidebar {
        display: flex;
        flex-direction: column;
        width: auto;
        overflow: auto; 
    }
    .sr-analysis-opt-sidebar-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        min-width: 20vw;
        min-height: 20vh;
        max-width: 75vw;
    }
    .sr-map-descr {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        width: 100%;
    }
    .sr-analysis-opt-sidebar-map {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between; 
        min-height: 200px; /* or any suitable value */
        min-width: 200px; /* or any suitable value */;
        width: 100%;
        height: 100%;
        overflow: auto;
    }
    
    .sr-req-description {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 0rem;
        margin: 0rem;
        margin-top: 1.0rem;
        font-size: medium;
    }

    .sr-export-button {
        margin: 1rem;
        width:10rem;
    }

    .sr-sidebar-analysis-opt {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        width: 100%;
        margin-top: 1.0rem;
    }

    .sr-filter-cntrl-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .sr-pnts-colormap {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
    }
    .sr-analysis-max-pnts {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
    }
    .sr-analysis-color-map {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content:flex-start;
    }
    .sr-debug-fieldset-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        margin-top: 0.5rem;
    }
    .sr-fieldset {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
    }
    .sr-user-guide-link {
        display: flex;
        flex-direction: col;
        justify-content:center;
    }
    .sr-tracks-beams {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
    }
    .sr-pair-sc-orient {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }
    .sr-sc-orientation {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: flex-start;
        font-size: smaller;
    }


    :deep(.sr-listbox-control){
        min-height: fit-content;
    }

    .sr-tracks-beams-panel {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items:flex-start;
    }

    :deep(.sr-analyze-filters) {
        display: flex;
        flex-direction: row;
        justify-content: center;
        min-height: fit-content;
    }
    .sr-sc-orient-panel {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
    }
    .sr-link-small-text {
        font-size: smaller;
    }

    .sr-analysis-rec-parms{
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        margin: 0.5rem;
        
    }
    :deep(.p-multiselect-option) {
        font-size: smaller;
    }
    :deep(.p-multiselect) {
        font-size: smaller;
    }
    :deep(.optionLabel) {
        font-size: smaller;
    }
    :deep(.p-multiselect-option) {
        font-size: smaller;
    }
    .sr-analysis-rec-parms {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        margin: 0.5rem;
    }
    .sr-fieldset {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        margin: 0.25rem;
    }
    .sr-scatterplot-cfg-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        width: fit-content;
        max-width: 100%; 
        margin: 0.25rem;
    }
    .sr-scatterplot-cfg {
        margin: 0 auto;    /*  center it */
    }


</style>