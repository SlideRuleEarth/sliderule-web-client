<script setup lang="ts">
import { onMounted,ref,watch,computed } from 'vue';
import SrAnalysisMap from '@/components/SrAnalysisMap.vue';
import SrMenuInput from '@/components/SrMenuInput.vue';
import SrRecIdReqDisplay from '@/components/SrRecIdReqDisplay.vue';
import SrSliderInput from '@/components/SrSliderInput.vue';
import router from '@/router/index.js';
import { db } from '@/db/SlideRuleDb';
import { duckDbReadAndUpdateElevationData } from '@/utils/SrDuckDbUtils';
import { formatBytes } from '@/utils/SrParquetUtils';
import { useMapStore } from '@/stores/mapStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useDeckStore } from '@/stores/deckStore';
import { getDetailsFromSpotNumber } from '@/utils/spotUtils';
import { debounce } from "lodash";
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { getColorMapOptions } from '@/utils/colorUtils';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { useToast } from 'primevue/usetoast';
import { useSrToastStore } from "@/stores/srToastStore";
import SrEditDesc from '@/components/SrEditDesc.vue';
import SrPlotConfig from "@/components/SrPlotConfig.vue";
import { useChartStore } from '@/stores/chartStore';
import SrCustomTooltip from '@/components/SrCustomTooltip.vue';
import Button from 'primevue/button';
import type { ElevationDataItem } from '@/utils/SrMapUtils';
import SrFilterCntrl from './SrFilterCntrl.vue';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useGlobalChartStore } from '@/stores/globalChartStore';

const atlChartFilterStore = useAtlChartFilterStore();
const mapStore = useMapStore();
const deckStore = useDeckStore();
const elevationColorMapStore = useElevationColorMapStore();
const recTreeStore = useRecTreeStore();
const globalChartStore = useGlobalChartStore();

const spotPatternDetailsStr = "Each ground track is \
numbered according to the laser spot number that generates it, with ground track 1L (GT1L) on the \
far left and ground track 3R (GT3R) on the far right. Left/right spots within each pair are \
approximately 90 m apart in the across-track direction and 2.5 km in the along-track \
direction. Higher level ATLAS/ICESat-2 data products (ATL03 and above) are organized by ground \
track, with ground tracks 1L and 1R forming pair one, ground tracks 2L and 2R forming pair two, \
and ground tracks 3L and 3R forming pair three. Each pair also has a Pair Track—an imaginary \
line halfway between the actual location of the left and right beams. Pair tracks are \
approximately 3 km apart in the across-track direction. \
The beams within each pair have different transmit energies—so-called weak and strong beams—\
with an energy ratio between them of approximately 1:4. The mapping between the strong and \
weak beams of ATLAS, and their relative position on the ground, depends on the orientation (yaw) \
of the ICESat-2 observatory, which is changed approximately twice per year to maximize solar \
illumination of the solar panels. The forward orientation corresponds to ATLAS traveling along the \
+x coordinate in the ATLAS instrument reference frame. In this orientation, the \
weak beams lead the strong beams and a weak beam is on the left edge of the beam pattern. In \
the backward orientation, ATLAS travels along the -x coordinate, in the instrument reference frame, \
with the strong beams leading the weak beams and a strong beam on the left edge of the beam \
pattern."
const spotPatternBriefStr = "fields related to spots and beams patterns";
const props = defineProps({
    startingReqId: {
        type:Number, 
        default:0
    }
});
const tooltipRef = ref();
const selectedElevationColorMap = ref({name:'viridis', value:'viridis'});
const loading = ref(true);
const toast = useToast();
const srToastStore = useSrToastStore();
const isMounted = ref(false);

const computedInitializing = computed(() => {
    return !isMounted.value || loading.value || recTreeStore.reqIdMenuItems.length === 0;
});


const highlightedTrackDetails = computed(() => {
    return `rgt:${globalChartStore.getRgts()} spots:${globalChartStore.getSpots()} beam:${globalChartStore.getGtLabels()} cycle:${globalChartStore.getCycles()}`;
});

onMounted(async () => {
    // the router sets the startingReqId and the recTreeStore.reqIdMenuItems
    console.log(`onMounted SrAnalyzeOptSidebar startingReqId: ${props.startingReqId}`);
    await processNewReqId();
});


const updateElevationMap = async (req_id: number) => {
    console.log('updateElevationMap req_id:', req_id);
    let firstRec = null as ElevationDataItem | null;
    //const reqIdStr = req_id.toString();
    if(req_id <= 0){
        console.warn(`updateElevationMap Invalid request ID:${req_id}`);
        return;
    }
    try {
        //console.log('Request:', request);
        deckStore.deleteSelectedLayer();
        //updateFilter([req_id]); // query to set all options for all 
        mapStore.setIsLoading(true);
        firstRec = await duckDbReadAndUpdateElevationData(req_id);
        mapStore.setIsLoading(false);
        mapStore.setMapInitialized(true);
    } catch (error) {
        console.warn('Failed to update selected request:', error);
        //toast.add({ severity: 'warn', summary: 'No points in file', detail: 'The request produced no points', life: srToastStore.getLife()});
    }
    try {
        await router.push(`/analyze/${recTreeStore.selectedReqId}`);
        console.log('Successfully navigated to analyze:', recTreeStore.selectedReqId);
    } catch (error) {
        console.error('Failed to navigate to analyze:', error);
    }
    
};

const debouncedUpdateElevationMap = debounce(() => {
    const req_id = recTreeStore.selectedReqId;
    console.log("debouncedUpdateElevationMap called with req_id:", req_id);
    return updateElevationMap(req_id);
}, 500);

async function processNewReqId() {
    const startTime = performance.now(); // Start time
    mapStore.setTotalRows(0);
    mapStore.setCurrentRows(0);
    atlChartFilterStore.setDebugCnt(0);
    atlChartFilterStore.setSelectedOverlayedReqIds([]);
    try {
        const req_id = recTreeStore.selectedReqId;
        //console.log('processNewReqId selectedReqId:', req_id);
        if(req_id !== props.startingReqId){
            console.warn(`processNewReqId: req_id:${req_id} !== props.startingReqId:${props.startingReqId}`);
        }
        debouncedUpdateElevationMap();
        //console.log('onMounted recTreeStore.reqIdMenuItems:', recTreeStore.reqIdMenuItems);
    } catch (error) {
        if (error instanceof Error) {
            console.error('processNewReqId Failed:', error.message);
        } else {
            console.error('processNewReqId Unknown error occurred:', error);
        }
    } finally {
        loading.value = false;
        //console.log('Mounted SrAnalyzeOptSidebar with defaultReqIdMenuItemIndex:', defaultReqIdMenuItemIndex);
        const endTime = performance.now(); // End time
        isMounted.value = true;
        console.log(`processNewReqId took ${endTime - startTime} milliseconds.`);
    }
}

watch (selectedElevationColorMap, async (newColorMap, oldColorMap) => {    
    console.log('ElevationColorMap changed from:', oldColorMap ,' to:', newColorMap);
    elevationColorMapStore.setElevationColorMap(newColorMap.value);
    elevationColorMapStore.updateElevationColorMapValues();
    //console.log('Color Map:', colorMapStore.getElevationColorMap());
    try{
        //await debouncedUpdateElevationMap();
    } catch (error) {
        console.warn('ElevationColorMap Failed debouncedUpdateElevationMap:', error);
        toast.add({ severity: 'warn', summary: 'Failed to update Elevation Map', detail: `Failed to update Elevation Map exception`, life: srToastStore.getLife()});
    }
}, { deep: true });

watch(() => elevationColorMapStore.selectedElevationColorMap, async (newColorMap, oldColorMap) => {    
    console.log('ElevationColorMapStore changed from:', oldColorMap ,' to:', newColorMap);
    await debouncedUpdateElevationMap();
}, { deep: true });

watch(() => recTreeStore.selectedReqId,async (newValue, oldValue) => {
    console.log(`recTreeStore.selectedReqId changed from ${oldValue} to ${newValue}`);
    // Perform any additional actions on change
    if(newValue > 0 && (newValue !== oldValue)){
        await processNewReqId();
    } else {
        console.warn(`recTreeStore.selectedReqId is <= 0 or unchanged: ${newValue}`);
    }
  }
);
const getSize = computed(() => {
    return formatBytes(useChartStore().getSize());
});
const getCnt = computed(() => {
    return new Intl.NumberFormat().format(parseInt(String(useChartStore().getRecCnt())));
});

const tooltipTextStr = computed(() => {
    return "Has " + getCnt.value + " records and is " + getSize.value + " in size";
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
        <div class="sr-analysis-opt-sidebar-container" v-if="computedInitializing">Loading...</div>
        <div class="sr-analysis-opt-sidebar-container" v-else>
            <div class="sr-map-descr">
                <div class="sr-analysis-opt-sidebar-map" ID="AnalysisMapDiv">
                    <div v-if="loading">Loading...{{ recTreeStore.selectedApi }}</div>
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
                <div class="sr-filter-cntrl-container" v-if="!recTreeStore.selectedApi?.includes('atl03') && (!atlChartFilterStore.isLoading)">
                    <SrFilterCntrl></SrFilterCntrl>
                </div>
                <div class="sr-scatterplot-cfg-container">
                    <!-- SrPlotConfig for the main req_id -->
                    <div class="sr-scatterplot-cfg">
                        <SrPlotConfig
                            v-if="mapStore.mapInitialized" 
                            :reqId="recTreeStore.selectedReqId"
                        />
                    </div>

                    <!-- SrPlotConfig for each overlayed req_id -->
                    <div class="sr-scatterplot-cfg" v-for="overlayedReqId in atlChartFilterStore.selectedOverlayedReqIds" :key=overlayedReqId>
                        <SrPlotConfig
                            v-if="mapStore.mapInitialized" 
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