<script setup lang="ts">
import { onMounted,ref,watch,computed } from 'vue';
import SrAnalysisMap from '@/components/SrAnalysisMap.vue';
import SrMenuInput from '@/components/SrMenuInput.vue';
import SrRecReqDisplay from '@/components/SrRecIdReqDisplay.vue';
import SrListbox from '@/components/SrListbox.vue';
import SrSliderInput from '@/components/SrSliderInput.vue';
import Fieldset from 'primevue/fieldset';
import router from '@/router/index.js';
import { db } from '@/db/SlideRuleDb';
import { duckDbReadAndUpdateElevationData, duckDbReadOrCacheSummary, prepareDbForReqId } from '@/utils/SrDuckDbUtils';
import { formatBytes } from '@/utils/SrParquetUtils';
import { spotsOptions } from '@/utils/parmUtils';
import { useMapStore } from '@/stores/mapStore';
import { SrMenuNumberItem, useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useDeckStore } from '@/stores/deckStore';
import { updateCycleOptions, updateRgtOptions, updatePairOptions, updateScOrientOptions, updateTrackOptions } from '@/utils/SrDuckDbUtils';
import { getDetailsFromSpotNumber } from '@/utils/spotUtils';
import { debounce } from "lodash";
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { getColorMapOptions } from '@/utils/colorUtils';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { useToast } from 'primevue/usetoast';
import { useSrToastStore } from "@/stores/srToastStore";
import SrEditDesc from '@/components/SrEditDesc.vue';
import SrScatterPlotOptions from "@/components/SrScatterPlotOptions.vue";
import { useChartStore } from '@/stores/chartStore';
import { updateChartStore } from '@/utils/plotUtils';
import SrCustomTooltip from '@/components/SrCustomTooltip.vue';
import Button from 'primevue/button';
import { clicked } from '@/utils/SrMapUtils'
import type { ElevationDataItem } from '@/utils/SrMapUtils';
import { useDebugStore } from '@/stores/debugStore';
import { beamsOptions, tracksOptions } from '@/utils/parmUtils';
import { getHeightFieldname } from "@/utils/SrParquetUtils";
import { initChartStore } from '@/utils/plotUtils';
import { useRequestsStore } from '@/stores/requestsStore';
import Card from 'primevue/card';


const atlChartFilterStore = useAtlChartFilterStore();
const chartStore = useChartStore();
const mapStore = useMapStore();
const deckStore = useDeckStore();
const colorMapStore = useElevationColorMapStore();
const requestsStore = useRequestsStore();

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
const rgtsOptions = computed(() => atlChartFilterStore.getRgtOptions());
const cyclesOptions = computed(() => atlChartFilterStore.getCycleOptions());
const toast = useToast();
const srToastStore = useSrToastStore();
const isMounted = ref(false);

const computedInitializing = computed(() => {
    return !isMounted.value || loading.value || atlChartFilterStore.reqIdMenuItems.length === 0;
});

const computedReqIdStr = computed(() => {
    return atlChartFilterStore.selectedReqIdMenuItem.value.toString();
});
const selectedReqIdValue = computed(() => atlChartFilterStore.selectedReqIdMenuItem.value);

const highlightedTrackDetails = computed(() => {
    if(chartStore.getRgts(computedReqIdStr.value) && chartStore.getRgts(computedReqIdStr.value).length > 0 && chartStore.getCycles(computedReqIdStr.value) && chartStore.getCycles(computedReqIdStr.value).length > 0 && chartStore.getTracks(computedReqIdStr.value) && chartStore.getTracks(computedReqIdStr.value).length > 0 && chartStore.getBeams(computedReqIdStr.value) && chartStore.getBeams(computedReqIdStr.value).length > 0) {
        return `rgt:${chartStore.getRgts(computedReqIdStr.value)[0].value} cycle:${chartStore.getCycles(computedReqIdStr.value)[0].value} track:${chartStore.getTracks(computedReqIdStr.value)[0].value} beam:${chartStore.getBeams(computedReqIdStr.value)[0].label}`;
    } else {
        return '';
    }
});
const computedFunc = computed(() => chartStore.getFunc(computedReqIdStr.value));

async function syncRouteToChartStore(newReqId: number) : Promise<number> {
    let finalReqId = newReqId;
    try{
        if (isNaN(newReqId)) {
            console.error("Invalid (NaN) route parameter for 'id':", newReqId);
            toast.add({ severity: 'error', summary: 'Invalid route', detail: `Invalid (NaN) route parameter for record:${newReqId}`, life: srToastStore.getLife()});
            return 0;
        }
        atlChartFilterStore.reqIdMenuItems = await requestsStore.getMenuItems();
        if(atlChartFilterStore.reqIdMenuItems.length === 0){
            console.warn("Invalid (no records) route parameter for 'id':", newReqId);
            toast.add({ severity: 'warn', summary: 'No records', detail: `There are no records. Make a request first`, life: srToastStore.getLife()});
            return 0;
        }
        const newMenuItem = atlChartFilterStore.reqIdMenuItems.find(item => item.value === newReqId);
        if(newMenuItem){
            if(atlChartFilterStore.setReqId(newReqId)){
                console.log('Route ID changed to:', newReqId);
                initChartStore();
            } else {
                console.error("Invalid 1 (not in records) route parameter for 'id':", newReqId);
                toast.add({ severity: 'error', summary: 'Invalid route', detail: `Invalid (not in records) route parameter for record:${newReqId}`, life: srToastStore.getLife()});
                return 0;
            }
        } else {
            finalReqId = atlChartFilterStore.reqIdMenuItems[0].value;
            console.warn("Invalid (not in records) route parameter for 'id':", newReqId, "Setting to first record:", newReqId);
            toast.add({ severity: 'error', summary: 'Invalid route', detail: `Invalid (not in records) route parameter for record:${newReqId} setting to first record${newReqId}`, life: srToastStore.getLife()});
        }
        console.log('Route ID changed to:', newReqId);
    } catch (error) {
        console.error('Error processing route ID change:', error);
        console.error("exception setting route parameter for 'id':", newReqId);
        toast.add({ severity: 'error', summary: 'exception', detail: `Invalid (exception) route parameter for record:${newReqId}`, life: srToastStore.getLife()});
    }
    return finalReqId;
}

async function initAnalysisMap() {
    const req_id = selectedReqIdValue.value;
    try{
        if(req_id > 0){
            const reqIdStr = req_id.toString();
            atlChartFilterStore.setSelectedOverlayedReqIds([]);
            deckStore.deleteSelectedLayer();
            chartStore.setSpots(reqIdStr,[]);
            chartStore.setRgts(reqIdStr,[]);
            chartStore.setCycles(reqIdStr,[]);
            await updateFilter([req_id]);
            await debouncedUpdateElevationMap(req_id);
            await updateChartStore(req_id);
        } else {
            console.warn('watch useAtlChartFilterStore().selectedReqIdMenuItem/newSelection --> Request Id is <= 0',req_id);
        }
    } catch (error) {
        console.error(`Failed to update with selected record ${req_id}:`, error);
    }    
}

onMounted(async () => {
    // the router sets the startingReqId and the atlChartFilterStore.reqIdMenuItems
    console.log(`onMounted SrAnalyzeOptSidebar startingReqId: ${props.startingReqId}`);
    const startTime = performance.now(); // Start time
    mapStore.setTotalRows(0);
    mapStore.setCurrentRows(0);
    atlChartFilterStore.setDebugCnt(0);
    atlChartFilterStore.setSelectedOverlayedReqIds([]);
    try {
        //console.log('onMounted selectedReqId:', req_id, 'func:', chartStore.getFunc(computedReqIdStr.value));
        let req_id = await syncRouteToChartStore(props.startingReqId);
        const height_fieldname = await getHeightFieldname(req_id);
        const summary = await duckDbReadOrCacheSummary(req_id, height_fieldname);
        console.log('onMounted summary:', summary, 'req_id:', req_id);
        await updateChartStore(req_id);
        await initAnalysisMap();
        //console.log('onMounted atlChartFilterStore.reqIdMenuItems:', atlChartFilterStore.reqIdMenuItems);
    } catch (error) {
        if (error instanceof Error) {
            console.error('onMounted Failed to load menu items:', error.message);
        } else {
            console.error('onMounted Unknown error occurred:', error);
        }
    } finally {
        loading.value = false;
        //console.log('Mounted SrAnalyzeOptSidebar with defaultReqIdMenuItemIndex:', defaultReqIdMenuItemIndex);
        const endTime = performance.now(); // End time
        isMounted.value = true;
        console.log(`onMounted took ${endTime - startTime} milliseconds.`);
    }
});

const onSpotSelection = async() => {
    const spots = chartStore.getSpots(computedReqIdStr.value);
    //console.log('onSpotSelection spots:', spots);
    spots.forEach((spot) => {
        const d = getDetailsFromSpotNumber(spot.value);

        if(d[0].sc_orient >= 0){
            chartStore.appendScOrientWithNumber(computedReqIdStr.value,d[0].sc_orient);
        }
        if(d[0].track > 0){
            chartStore.appendTrackWithNumber(computedReqIdStr.value,d[0].track);
        }
        if(d[0].pair >= 0){
            chartStore.appendPairWithNumber(computedReqIdStr.value,d[0].pair);
        }
        if(d[1].sc_orient >= 0){
            chartStore.appendScOrientWithNumber(computedReqIdStr.value,d[1].sc_orient);
        }
        if(d[1].track > 0){
            chartStore.appendTrackWithNumber(computedReqIdStr.value,d[1].track);
        }
        if(d[1].pair >= 0){
            chartStore.appendPairWithNumber(computedReqIdStr.value,d[1].pair);
        }
        
    });
};

const BeamSelection = () => {
    console.log('BeamSelection:');
    //debouncedOnSelection("BeamSelection");
};

const CyclesSelection = () => {
    //console.log('CyclesSelection:');
};

const RgtsSelection = () => {
    //console.log('RgtsSelection:');
};

const scOrientsSelection = () => {
    console.log('scOrientsSelection:');
};

const pairsSelection = () => {
    console.log('pairsSelection:');
};

const tracksSelection = () => {
    console.log('tracksSelection:');
};

const updateElevationMap = async (req_id: number) => {
    console.log('updateElevationMap req_id:', req_id);
    let firstRec = null as ElevationDataItem | null;
    const reqIdStr = req_id.toString();
    if(req_id <= 0){
        console.warn(`updateElevationMap Invalid request ID:${req_id}`);
        return;
    }
    try {
        if(atlChartFilterStore.setReqId(req_id)){
            const request = await db.getRequest(req_id);
            //console.log('Request:', request);

            deckStore.deleteSelectedLayer();
            //console.log('Request ID:', req_id, 'func:', chartStore.getFunc(reqIdStr));
            useAtlChartFilterStore().setReqId(req_id);
            //console.log('watch req_id SrAnalyzeOptSidebar');
            const rgts = await updateRgtOptions(req_id);
            //console.log('watch req_id rgts:',rgts);
            const cycles = await updateCycleOptions(req_id);
            //console.log('watch req_id cycles:',cycles);
            if(chartStore.getFunc(reqIdStr)==='atl03sp'){
                const pairs = await updatePairOptions(req_id);
                //console.log('watch req_id pairs:',pairs);
                const scOrients = await updateScOrientOptions(req_id);
                //console.log('watch req_id scOrients:',scOrients);
                const tracks = await updateTrackOptions(req_id);
                //console.log('watch req_id tracks:',tracks);
            }

            updateFilter([req_id]);
            mapStore.setIsLoading(true);
            firstRec = await duckDbReadAndUpdateElevationData(req_id);
            mapStore.setIsLoading(false);
        } else {
            console.warn(`updateElevationMap Invalid request ID:${req_id}`);
        }
    } catch (error) {
        console.warn('Failed to update selected request:', error);
        //toast.add({ severity: 'warn', summary: 'No points in file', detail: 'The request produced no points', life: srToastStore.getLife()});
    }
    try {
        //console.log('pushing selectedReqId:', req_id);
        router.push(`/analyze/${useAtlChartFilterStore().getReqId()}`);
        console.log('Successfully navigated to analyze:', useAtlChartFilterStore().getReqId());
        if(firstRec){
            clicked(firstRec); // preset filters using the first row
        }
    } catch (error) {
        console.error('Failed to navigate to analyze:', error);
    }
    
};

const debouncedUpdateElevationMap = debounce((req_id: number) => {
  console.log("debouncedUpdateElevationMap called with req_id:", req_id);
  return updateElevationMap(req_id);
}, 500);

const updateRecordSelection = async (item: SrMenuNumberItem) => {
    console.log('updateRecordSelection item:', item);
    if(atlChartFilterStore.selectedReqIdMenuItem.value > 0){
        console.log('handleUpdateReqId selectedReqId:', useAtlChartFilterStore().selectedReqIdMenuItem);
        await prepareDbForReqId(atlChartFilterStore.selectedReqIdMenuItem.value);
    } else {
        console.warn("useAtlChartFilterStore().selectedReqIdMenuItem is undefined");
    }
};

const updateFilter = async (req_ids: number[]) => {
    try {
        // Process each request ID and aggregate results
        let rgts:number[] = [];
        let cycles:number[] = [];
        for (const req_id of req_ids) {
            const rgtOptions = await updateRgtOptions(req_id);
            const cycleOptions = await updateCycleOptions(req_id);
            rgts.push(...rgtOptions); // Append rgt options
            cycles.push(...cycleOptions); // Append cycle options
        }
        
        // Remove duplicates from the aggregated results (if needed)
        rgts = [...new Set(rgts)];
        cycles = [...new Set(cycles)];

        // Update the store with the aggregated results
        const atlChartFilterStore = useAtlChartFilterStore();
        atlChartFilterStore.setRgtOptionsWithNumbers(rgts);
        atlChartFilterStore.setCycleOptionsWithNumbers(cycles);

    } catch (error) {
        console.error('Failed to update selected requests:', error);
    }
};

watch (selectedElevationColorMap, async (newColorMap, oldColorMap) => {    
    console.log('ElevationColorMap changed from:', oldColorMap ,' to:', newColorMap);
    colorMapStore.setElevationColorMap(newColorMap.value);
    colorMapStore.updateElevationColorMapValues();
    //console.log('Color Map:', colorMapStore.getElevationColorMap());
    try{
        const req_id = atlChartFilterStore.getReqId();
        if(req_id > 0){
            await debouncedUpdateElevationMap(req_id);
        } else {
            const emsg =  `invalid req id:${req_id}`;
            console.warn(`watch selectedElevationColorMap ${emsg}`);
            if(oldColorMap){
                toast.add({ severity: 'warn', summary: `Failed to update Elevation Map`, detail: emsg, life: srToastStore.getLife()});
            }
        }
    } catch (error) {
        console.warn('ElevationColorMap Failed debouncedUpdateElevationMap:', error);
        toast.add({ severity: 'warn', summary: 'Failed to update Elevation Map', detail: `Failed to update Elevation Map exception`, life: srToastStore.getLife()});
    }
}, { deep: true });

watch(selectedReqIdValue, async (newSelection, oldSelection) => {
    console.log('watch useAtlChartFilterStore().selectedReqIdMenuItem --> Request ID changed from:', oldSelection ,' to:', newSelection, ' selectedReqIdMenuItem:',atlChartFilterStore.selectedReqIdMenuItem);
    await initAnalysisMap();
}, );

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
    let req_id = 0;
    try {
        if(Number(useAtlChartFilterStore().selectedReqIdMenuItem.value)>0){
            req_id = Number(useAtlChartFilterStore().selectedReqIdMenuItem.value);
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
        <div class="sr-analysis-opt-sidebar-container" v-if="computedInitializing">Loading...{{ computedInitializing }}</div>
        <div class="sr-analysis-opt-sidebar-container" v-else>
            <div class="sr-map-descr">
                <div class="sr-analysis-opt-sidebar-map" ID="AnalysisMapDiv">
                    <div v-if="loading">Loading...{{ chartStore.getFunc(computedReqIdStr) }}</div>
                    <SrAnalysisMap 
                        v-else :selectedReqIdItem="atlChartFilterStore.selectedReqIdMenuItem"
                        @update-record-selection="updateRecordSelection"
                    />
                </div>
                <div class="sr-req-description">
                    <!-- <SrMenuInput
                        label="Record" 
                        labelFontSize="medium"
                        :justify_center="true"
                        :menuOptions="atlChartFilterStore.reqIdMenuItems" 
                        v-model="selectedReqId"
                        @update:modelValue="handleUpdateReqId"
                        :defaultOptionIndex="Number(defaultReqIdMenuItemIndex)"
                        :tooltipText=tooltipTextStr
                    /> -->
                    <SrEditDesc :reqId="atlChartFilterStore.selectedReqIdMenuItem.value"/>
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
            <div class="sr-pnts-colormap">
                <div class="sr-analysis-max-pnts">
                    <SrSliderInput
                        v-model="useSrParquetCfgStore().maxNumPntsToDisplay"
                        label="Max Num Elevation Pnts"
                        :min="10000"
                        :max="5000000"
                        :defaultValue="100000"
                        :decimalPlaces=0
                        tooltipText="Maximum number of points to display"
                    />
                </div>
                <div class="sr-analysis-color-map">
                    <SrMenuInput 
                        label="Color Map" 
                        :menuOptions="getColorMapOptions()" 
                        v-model="selectedElevationColorMap"
                        tooltipText="Color Map for elevation plot"
                    /> 
                </div>  
            </div>
            <div v-if="useDebugStore().enableSpotPatternDetails && !chartStore.getFunc(computedReqIdStr).includes('gedi')">            
                <!-- <Fieldset  legend="Track Filter" :toggleable="true" :collapsed="true">
                    <div class="sr-analyze-filters">
                        <SrListbox id="spots"
                            v-if = "!chartStore.getFunc(computedReqIdStr).includes('gedi')" 
                            label="Spot(s)" 
                            v-model="chartStore.getSpots(computedReqIdStr)"
                            :getSelectedMenuItem="atlChartFilterStore.getSpots"
                            :setSelectedMenuItem="atlChartFilterStore.setSpots"
                            :menuOptions="spotsOptions"
                            tooltipText="Laser pulses from ATLAS illuminate three left/right pairs of spots on the surface that \
            trace out six approximately 14 m wide ground tracks as ICESat-2 orbits Earth. Each ground track is \
            numbered according to the laser spot number that generates it, with ground track 1L (GT1L) on the \
            far left and ground track 3R (GT3R) on the far right. Left/right spots within each pair are \
            approximately 90 m apart in the across-track direction and 2.5 km in the along-track \
            direction."
                            @update:modelValue="onSpotSelection"
                            :justify_center="true"
                        />
                        <SrListbox id="rgts"
                            v-if = "!chartStore.getFunc(computedReqIdStr).includes('gedi')" 
                            label="Rgt(s)" 
                            v-model="atlChartFilterStore.rgts" 
                            :getSelectedMenuItem="atlChartFilterStore.getRgts"
                            :setSelectedMenuItem="atlChartFilterStore.setRgts"
                            :menuOptions="rgtsOptions" 
                            tooltipText="Reference Ground Track: The imaginary track on Earth at which a specified unit
            vector within the observatory is pointed" 
                            @update:modelValue="RgtsSelection"
                        />
                        <SrListbox id="cycles" 
                            v-if = "!chartStore.getFunc(computedReqIdStr).includes('gedi')" 
                            label="Cycle(s)" 
                            v-model="chartStore.cycles"
                            :getSelectedMenuItem="atlChartFilterStore.getCycles"
                            :setSelectedMenuItem="atlChartFilterStore.setCycles" 
                            :menuOptions="cyclesOptions" 
                            tooltipText="Counter of 91-day repeat cycles completed by the mission" 
                            @update:modelValue="CyclesSelection"
                        />
                    </div>
                </Fieldset> -->

                <!-- <Fieldset class = "sr-fieldset" legend="Spot Pattern Details" :toggleable="true" :collapsed="true" >
                    <div class="sr-debug-fieldset-panel" >
                        <div class="sr-user-guide-link">
                            <a class="sr-link-small-text" href="https://nsidc.org/sites/default/files/documents/user-guide/atl03-v006-userguide.pdf" target="_blank">Photon Data User Guide</a>
                        </div>
                        <div class="sr-sc-orient-panel">
                            <div class="sr-sc-orientation">
                                <p>
                                    <span v-if="atlChartFilterStore.getScOrients().length===1  && atlChartFilterStore.getScOrients()[0].value===1">S/C Orientation: Forward</span>
                                    <span v-if="atlChartFilterStore.getScOrients().length===1  && atlChartFilterStore.getScOrients()[0].value===0">S/C Orientation: Backward</span>
                                    <span v-if="atlChartFilterStore.getScOrients().length!=0">S/C Orientation: Both</span>
                                </p>
                            </div>
                            <div class="sr-pair-sc-orient">
                                <SrListbox id="scOrients"
                                    label="scOrient(s)" 
                                    v-if="chartStore.getFunc(computedReqIdStr) === 'atl03sp'"
                                    v-model="atlChartFilterStore.scOrients" 
                                    :getSelectedMenuItem="atlChartFilterStore.getScOrients"
                                    :setSelectedMenuItem="atlChartFilterStore.setScOrients"
                                    :menuOptions="atlChartFilterStore.scOrientOptions" 
                                    tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/Background.html"
                                    tooltipText="SC orientation is the orientation of the spacecraft relative to the surface normal at the time of the photon measurement."
                                    @update:modelValue="scOrientsSelection"
                                    />
                                <SrListbox id="pairs"
                                    label="pair(s)" 
                                    v-if="chartStore.getFunc(computedReqIdStr) === 'atl03sp'"
                                    v-model="atlChartFilterStore.pairs" 
                                    :getSelectedMenuItem="atlChartFilterStore.getPairs"
                                    :setSelectedMenuItem="atlChartFilterStore.setPairs"
                                    :menuOptions="atlChartFilterStore.pairOptions" 
                                    tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/Background.html"
                                    tooltipText="A pair is a set of weak and strong beams."
                                    @update:modelValue="pairsSelection"
                                />
                            </div>
                        </div> 
                        <div class="sr-tracks-beams-panel">
                            <SrListbox id="tracks" 
                                label="Track(s)" 
                                v-model="atlChartFilterStore.tracks" 
                                :getSelectedMenuItem="atlChartFilterStore.getTracks"
                                :setSelectedMenuItem="atlChartFilterStore.setTracks"
                                :menuOptions="tracksOptions" 
                                tooltipText="Weak and strong spots are determined by orientation of the satellite"
                                @update:modelValue="tracksSelection"
                            />
                            <SrListbox id="beams" 
                                v-if=" !chartStore.getFunc(computedReqIdStr).includes('gedi')"
                                :insensitive="true"
                                label="Beam(s)" 
                                v-model="atlChartFilterStore.beams"
                                :getSelectedMenuItem="atlChartFilterStore.getBeams"
                                :setSelectedMenuItem="atlChartFilterStore.setBeams"
                                :menuOptions="beamsOptions" 
                                tooltipText="ATLAS laser beams are divided into weak and strong beams"
                                @update:modelValue="BeamSelection"
                            />
                        </div>
                    </div>
                </Fieldset> -->
            </div>
            <div class="sr-analysis-rec-parms">
                <SrRecReqDisplay :reqId="Number(computedReqIdStr)"/>
            </div>
            <div class="sr-photon-cloud" v-if="!computedFunc.includes('atl03') && (!atlChartFilterStore.isLoading)">
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
            <div class="sr-scatterplot-options-container">
                <!-- SrScatterPlotOptions for the main req_id -->
                <div class="sr-scatterplot-options">
                    <SrScatterPlotOptions
                        v-if="isMounted" 
                        :req_id="Number(computedReqIdStr)"
                    />
                </div>

                <!-- SrScatterPlotOptions for each overlayed req_id -->
                <div class="sr-scatterplot-options" v-for="overlayedReqId in atlChartFilterStore.selectedOverlayedReqIds" :key=overlayedReqId>
                    <SrScatterPlotOptions 
                        :req_id="overlayedReqId" 
                    />
                </div>
            </div>        
        </div>
    </div>
</template>
<style scoped>
    


    :deep(.sr-analysis-opt-sidebar) {
        display: flex;
        flex-direction: column;
        width: auto;
        overflow: auto; 
    }
    :deep(.sr-analysis-opt-sidebar-container) {
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
    :deep(.sr-export-button) {
        margin: 1rem;

        width:10rem;
    }
    .sr-photon-cloud {
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

    :deep(.p-listbox-option) {
        padding-top: 0.125rem;
        padding-bottom: 0rem;
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
    .sr-scatterplot-options-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        width: fit-content;
        max-width: 100%; 
        margin: 0.25rem;
    }
    .sr-scatterplot-options {
        margin: 0 auto;    /*  center it */
    }


</style>