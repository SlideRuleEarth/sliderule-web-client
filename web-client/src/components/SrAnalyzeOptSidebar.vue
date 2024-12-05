<script setup lang="ts">
import { onMounted,ref,watch,computed } from 'vue';
import SrAnalysisMap from './SrAnalysisMap.vue';
import SrMenuInput, { type SrMenuItem } from './SrMenuInput.vue';
import SrRecReqDisplay from './SrRecIdReqDisplay.vue';
import SrListbox from './SrListbox.vue';
import SrSliderInput from './SrSliderInput.vue';
import router from '@/router/index.js';
import { db } from '@/db/SlideRuleDb';
import { duckDbReadAndUpdateElevationData,duckDbReadAndUpdateSelectedLayer } from '@/utils/SrDuckDbUtils';
import { formatBytes } from '@/utils/SrParquetUtils';
import { tracksOptions,beamsOptions,spotsOptions } from '@/utils/parmUtils';
import { useMapStore } from '@/stores/mapStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useRequestsStore } from '@/stores/requestsStore';
import { useDeckStore } from '@/stores/deckStore';
import { useDebugStore } from '@/stores/debugStore';
import { updateCycleOptions, updateRgtOptions, updatePairOptions, updateScOrientOptions, updateTrackOptions } from '@/utils/SrDuckDbUtils';
import { getDetailsFromSpotNumber,getWhereClause } from '@/utils/spotUtils';
import { debounce } from "lodash";
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { getColorMapOptions } from '@/utils/colorUtils';
import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
import { useToast } from 'primevue/usetoast';
import { useSrToastStore } from "@/stores/srToastStore";
import SrEditDesc from './SrEditDesc.vue';
import SrScatterPlotOptions from "./SrScatterPlotOptions.vue";
import Fieldset from 'primevue/fieldset';
import MultiSelect from 'primevue/multiselect';
import { useChartStore } from '@/stores/chartStore';
import { updateScatterPlotFor } from '@/utils/plotUtils';

const requestsStore = useRequestsStore();
const atlChartFilterStore = useAtlChartFilterStore();
const mapStore = useMapStore();
const deckStore = useDeckStore();
const colorMapStore = useElevationColorMapStore();

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
    startingReqId: Number,
});

const defaultReqIdMenuItemIndex = ref(0);
const selectedReqId = ref({name:'0', value:'0'});
const selectedElevationColorMap = ref({name:'viridis', value:'viridis'});
const loading = ref(true);
const reqIds = ref<SrMenuItem[]>([]);
const rgtsOptions = computed(() => atlChartFilterStore.getRgtOptions());
const cyclesOptions = computed(() => atlChartFilterStore.getCycleOptions());
const toast = useToast();
const srToastStore = useSrToastStore();
const overlayedReqIdOptions = ref<{label:string,value:number}[]>([]);
const selectedOverlayedReqIds = ref<number[]>([]);
const hasOverlayedReqs = computed(() => overlayedReqIdOptions.value.length > 0);
const isMounted = ref(false);

onMounted(async() => {
    console.log(`onMounted SrAnalyzeOptSidebar startingReqId:${props.startingReqId}`);
    const startTime = performance.now(); // Start time
    let req_id = -1;
    try {
        mapStore.resetAllRowsData();
        useAtlChartFilterStore().setDebugCnt(0);
        reqIds.value =  await requestsStore.getMenuItems();
        if(reqIds.value.length === 0) {
            console.warn('No requests found');
            return;
        }
        console.log('onMounted props.startingReqId:',props.startingReqId)
        if (props.startingReqId){ // from the route parameter
            const startId = props.startingReqId.toString()
            console.log('onMounted startId:', startId);
            console.log('reqIds:', reqIds.value);
            defaultReqIdMenuItemIndex.value = reqIds.value.findIndex(item => item.value === startId);
            //console.log('defaultReqIdMenuItemIndex:', defaultReqIdMenuItemIndex.value);
            selectedReqId.value = reqIds.value[defaultReqIdMenuItemIndex.value];
        } else {
            defaultReqIdMenuItemIndex.value = 0;
            selectedReqId.value = reqIds.value[0];
        }
        req_id = Number(selectedReqId.value.value);
        console.log('onMounted selectedReqId:', req_id);
        if(req_id > 0){
            atlChartFilterStore.setReqId(req_id);
            overlayedReqIdOptions.value = await db.getOverlayedReqIdsOptions(req_id);
        } else {
            console.warn('Invalid request ID:', req_id);
            toast.add({ severity: 'warn', summary: 'Invalid Request ID', detail: 'Invalid Request ID', life: srToastStore.getLife()});
        }
        //console.log('reqIds:', reqIds.value, 'defaultReqIdMenuItemIndex:', defaultReqIdMenuItemIndex.value);
        // These update the dynamic options for the these components
    } catch (error) {
        console.error('onMounted Failed to load menu items:', error);
    } finally {
        loading.value = false;
        console.log('Mounted SrAnalyzeOptSidebar with defaultReqIdMenuItemIndex:',defaultReqIdMenuItemIndex);
        atlChartFilterStore.setFunc(await db.getFunc(req_id));
        useChartStore().setFunc(selectedReqId.value.value,atlChartFilterStore.getFunc());
        console.log('onMounted selectedReqId:',req_id, 'func:', atlChartFilterStore.getFunc());
        const endTime = performance.now(); // End time
        isMounted.value = true;
        console.log(`onMounted took ${endTime - startTime} milliseconds.`);
    }
});


const onSelection = async() => {
    console.log('onSelection with req_id:', selectedReqId.value);
    const reqIdStr = selectedReqId.value.value;
    const whereClause = getWhereClause(
        useAtlChartFilterStore().getFunc(),
        useAtlChartFilterStore().getSpotValues(),
        useAtlChartFilterStore().getRgtValues(),
        useAtlChartFilterStore().getCycleValues(),
    );
    useChartStore().setWhereClause(reqIdStr,whereClause);
    useAtlChartFilterStore().updateScatterPlot();
    if( (useAtlChartFilterStore().getRgtValues().length > 0) &&
        (useAtlChartFilterStore().getCycleValues().length > 0) &&
        (useAtlChartFilterStore().getSpotValues().length > 0)
    ){
        const maxNumPnts = useSrParquetCfgStore().getMaxNumPntsToDisplay();
        const chunkSize = useSrParquetCfgStore().getChunkSizeToRead();
        await duckDbReadAndUpdateSelectedLayer(useAtlChartFilterStore().getReqId(),chunkSize,maxNumPnts);
    } else {
        console.warn('Need Rgt, Cycle, and Spot values selected');
        console.warn('Rgt:', useAtlChartFilterStore().getRgtValues());
        console.warn('Cycle:', useAtlChartFilterStore().getCycleValues());
        console.warn('Spot:', useAtlChartFilterStore().getSpotValues());
    }
}
const debouncedOnSelection = debounce(onSelection, 500);

const onSpotSelection = async() => {
    const spots = atlChartFilterStore.getSpots();
    console.log('onSpotSelection spots:', spots);
    spots.forEach((spot) => {
        const d = getDetailsFromSpotNumber(spot.value);

        if(d[0].sc_orient >= 0){
            useAtlChartFilterStore().appendScOrientWithNumber(d[0].sc_orient);
        }
        if(d[0].track > 0){
            useAtlChartFilterStore().appendTrackWithNumber(d[0].track);
        }
        if(d[0].pair >= 0){
            useAtlChartFilterStore().appendPairWithNumber(d[0].pair);
        }
        if(d[1].sc_orient >= 0){
            useAtlChartFilterStore().appendScOrientWithNumber(d[1].sc_orient);
        }
        if(d[1].track > 0){
            useAtlChartFilterStore().appendTrackWithNumber(d[1].track);
        }
        if(d[1].pair >= 0){
            useAtlChartFilterStore().appendPairWithNumber(d[1].pair);
        }
        
    });
    debouncedOnSelection();
};

const BeamSelection = () => {
    console.log('BeamSelection:');
    debouncedOnSelection();
};

const CyclesSelection = () => {
    console.log('CyclesSelection:');
    debouncedOnSelection();
};

const RgtsSelection = () => {
    console.log('RgtsSelection:');
    debouncedOnSelection();
};

const scOrientsSelection = () => {
    console.log('scOrientsSelection:');
    debouncedOnSelection();
};

const pairsSelection = () => {
    console.log('pairsSelection:');
    debouncedOnSelection();
};

const tracksSelection = () => {
    console.log('tracksSelection:');
    debouncedOnSelection();
};

const updateElevationMap = async (req_id: number) => {
    console.log('updateElevationMap req_id:', req_id);
    const reqIdStr = req_id.toString();
    if(req_id <= 0){
        console.warn(`updateElevationMap Invalid request ID:${req_id}`);
        return;
    }
    try {
        atlChartFilterStore.setReqId(req_id);
        const request = await db.getRequest(req_id);
        console.log('Request:', request);
        if(request && request.file){
            useChartStore().setFileName(reqIdStr,request.file);
        } else {
            console.error('No file found for req_id:', req_id);
        }
        if(request && request.func){
            atlChartFilterStore.setFunc(request.func);
        } else {
            console.error('No func found for req_id:', req_id);
        }
        if(request && request.description){
            useChartStore().setDescription(reqIdStr,request.description);
        } else {
            // this is not an error, just a warning
            console.warn('No description found for req_id:', req_id);
            useChartStore().setDescription(reqIdStr,'description');
        }
        if(request && request.num_bytes){
            useChartStore().setSize(reqIdStr,request.num_bytes);
        } else {
            console.error('No num_bytes found for req_id:', req_id);
        }
        if(request && request.cnt){
            useChartStore().setRecCnt(reqIdStr,parseInt(String(request.cnt)));
        } else {
            console.error('No num_points found for req_id:', req_id);
        }

        deckStore.deleteSelectedLayer();
        //console.log('Request ID:', req_id, 'func:', atlChartFilterStore.getFunc());
        useAtlChartFilterStore().setReqId(req_id);
        //console.log('watch req_id SrAnalyzeOptSidebar');
        const rgts = await updateRgtOptions(req_id);
        //console.log('watch req_id rgts:',rgts);
        const cycles = await updateCycleOptions(req_id);
        //console.log('watch req_id cycles:',cycles);
        if(atlChartFilterStore.getFunc()==='atl03sp'){
            const pairs = await updatePairOptions(req_id);
            //console.log('watch req_id pairs:',pairs);
            const scOrients = await updateScOrientOptions(req_id);
            //console.log('watch req_id scOrients:',scOrients);
            const tracks = await updateTrackOptions(req_id);
            //console.log('watch req_id tracks:',tracks);
        }

        updateFilter([req_id]);
        await duckDbReadAndUpdateElevationData(req_id);

    } catch (error) {
        console.warn('Failed to update selected request:', error);
        //toast.add({ severity: 'warn', summary: 'No points in file', detail: 'The request produced no points', life: srToastStore.getLife()});
    }
    try {
        //console.log('pushing selectedReqId:', req_id);
        router.push(`/analyze/${useAtlChartFilterStore().getReqId()}`);
        console.log('Successfully navigated to analyze:', useAtlChartFilterStore().getReqId());
    } catch (error) {
        console.error('Failed to navigate to analyze:', error);
    }
    
};

//const debouncedUpdateElevationMap = debounce(() => console.log('stubbedUpdateElevationMap'), 500);
const debouncedUpdateElevationMap = debounce(updateElevationMap, 500);

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

watch (() => selectedElevationColorMap, async (newColorMap, oldColorMap) => {    
    console.log('ElevationColorMap changed from:', oldColorMap ,' to:', newColorMap);
    colorMapStore.setElevationColorMap(newColorMap.value.value);
    colorMapStore.updateElevationColorMapValues();
    //console.log('Color Map:', colorMapStore.getElevationColorMap());
    try{
        const req_id = atlChartFilterStore.getReqId();
        if(req_id > 0){
            debouncedUpdateElevationMap(req_id);
        } else {
            const emsg =  `invalid req id:${req_id}`;
            console.warn(`watch selectedElevationColorMap ${emsg}`);
            if(oldColorMap){
                toast.add({ severity: 'warn', summary: `Failed to update Elevation Map`, detail: emsg, life: srToastStore.getLife()});
            }
        }
    } catch (error) {
        console.warn('ElevationColorMap Failed to updateElevationMap:', error);
        toast.add({ severity: 'warn', summary: 'Failed to update Elevation Map', detail: `Failed to update Elevation Map exception`, life: srToastStore.getLife()});
    }
}, { deep: true, immediate: true });

watch(selectedReqId, async (newSelection, oldSelection) => {
    console.log('watch selectedReqId --> Request ID changed from:', oldSelection ,' to:', newSelection);
    try{
        const req_id = Number(newSelection.value)
        atlChartFilterStore.setReqId(req_id);
        overlayedReqIdOptions.value = await db.getOverlayedReqIdsOptions(req_id);
        deckStore.deleteSelectedLayer();
        atlChartFilterStore.setSpots([]);
        atlChartFilterStore.setRgts([]);
        atlChartFilterStore.setCycles([]);
        await updateFilter([req_id]);
        await debouncedUpdateElevationMap(req_id);

    } catch (error) {
        console.error('Failed to update selected request:', error);
    }
});

watch(selectedOverlayedReqIds, async (newSelection, oldSelection) => {
    console.log('watch selectedOverlayedReqIds --> Request ID changed from:', oldSelection ,' to:', newSelection);
    try{
        console.log('selectedOverlayedReqIds:', selectedOverlayedReqIds.value);
        atlChartFilterStore.setSelectedOverlayedReqIds(selectedOverlayedReqIds.value);
        // Only do updates if there was a previous selection
        // This initial overly needs Y options that aren't available now
        // This is handled elsewhere
        if(oldSelection.length > 0){ 
            if(selectedOverlayedReqIds.value.length > 0){
                await updateScatterPlotFor(selectedOverlayedReqIds.value);
            }
        }
    } catch (error) {
        console.error('Failed to update selected request:', error);
    }
});

const findLabel = (value:number) => {
    //console.log('findLabel reqIds:', reqIds.value);
    const match = reqIds.value.find(item => Number(item.value) === value);
    //console.log('findLabel:', value, 'match:', match);
    return match ? match.name : '';
};


const getSize = computed(() => {
    return formatBytes(useChartStore().getSize());
});
const getCnt = computed(() => {
    return new Intl.NumberFormat().format(parseInt(String(useChartStore().getRecCnt())));
});

const tooltipTextStr = computed(() => {
    return "Has " + getCnt.value + " records and is " + getSize.value + " in size";
});
</script>

<template>
    <div class="sr-analysis-opt-sidebar">
        <div class="sr-analysis-opt-sidebar-container">
            <div class="sr-analysis-opt-sidebar-req-menu">
                <div class="sr-analysis-reqid" v-if="loading">Loading... menu</div>
                <div class="sr-analysis-reqid" v-else>
                    <SrMenuInput 
                        label="Record" 
                        labelFontSize="medium"
                        :menuOptions="reqIds" 
                        v-model="selectedReqId"
                        @update:modelValue="debouncedUpdateElevationMap(Number(selectedReqId.value))"
                        :defaultOptionIndex="Number(defaultReqIdMenuItemIndex)"
                        :tooltipText=tooltipTextStr
                    />
                    <MultiSelect 
                        v-if=hasOverlayedReqs
                        v-model="selectedOverlayedReqIds" 
                        size="small"
                        :options="overlayedReqIdOptions"
                        optionValue="value"
                        optionLabel="label"  
                        placeholder="Overlay" 
                        display="chip" 
                    />
                </div>
            </div>
            <div class="sr-map-descr">
                <div class="sr-analysis-opt-sidebar-map" ID="AnalysisMapDiv">
                    <div v-if="loading">Loading...{{ atlChartFilterStore.getFunc() }}</div>
                    <SrAnalysisMap v-else :reqId="Number(selectedReqId.value)"/>
                </div>
                <div class="sr-req-description">  
                    <SrEditDesc :reqId="Number(selectedReqId.value)"/>
                </div>
            </div>
            <div class="sr-pnts-colormap">
                <div class="sr-analysis-max-pnts">
                    <SrSliderInput
                        v-model="useSrParquetCfgStore().maxNumPntsToDisplay"
                        label="Max Num Pnts"
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
            <div class="sr-analyze-filters">
                <SrListbox id="spots"
                    v-if = "!atlChartFilterStore.getFunc().includes('gedi')" 
                    label="Spot(s)" 
                    v-model="atlChartFilterStore.spots"
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
                />
                <SrListbox id="rgts"
                    v-if = "!atlChartFilterStore.getFunc().includes('gedi')" 
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
                    v-if = "!atlChartFilterStore.getFunc().includes('gedi')" 
                    label="Cycle(s)" 
                    v-model="atlChartFilterStore.cycles"
                    :getSelectedMenuItem="atlChartFilterStore.getCycles"
                    :setSelectedMenuItem="atlChartFilterStore.setCycles" 
                    :menuOptions="cyclesOptions" 
                    tooltipText="Counter of 91-day repeat cycles completed by the mission" 
                    @update:modelValue="CyclesSelection"
                />
            </div>
            <div class="sr-debug-fieldset-panel" v-if="useDebugStore().enableSpotPatternDetails">
                <Fieldset v-if="useDebugStore().enableSpotPatternDetails" class = "sr-fieldset" legend="Spot Pattern Details" :toggleable="true" :collapsed="false" >
                    <div class="sr-user-guide-link">
                        <a class="sr-link-small-text" href="https://nsidc.org/sites/default/files/documents/user-guide/atl03-v006-userguide.pdf" target="_blank">Photon Data User Guide</a>
                    </div>
                    <div class="sr-sc-orient-panel">
                        <div class="sr-sc-orientation">
                            <p>
                                <span v-if="atlChartFilterStore.getScOrients().length===1  && atlChartFilterStore.getScOrients()[0].value===1">S/C Orientation: Forward</span>
                                <span v-if="atlChartFilterStore.getScOrients().length===1  && atlChartFilterStore.getScOrients()[0].value===0">S/C Orientation: Backward</span>
                                <span v-if="atlChartFilterStore.getScOrients().length===0">S/C Orientation: Both</span>
                            </p>
                        </div>
                        <div class="sr-pair-sc-orient">
                            <SrListbox id="scOrients"
                                label="scOrient(s)" 
                                v-if="atlChartFilterStore.getFunc() === 'atl03sp'"
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
                                v-if="atlChartFilterStore.getFunc() === 'atl03sp'"
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
                            v-if="useDebugStore().enableSpotPatternDetails && !atlChartFilterStore.getFunc().includes('gedi')"
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
                </Fieldset>
            </div>
            <div class="sr-analysis-rec-parms">
                <SrRecReqDisplay :reqId="Number(selectedReqId.value)"/>
            </div>
            <div class="sr-scatterplot-options-container">
                <!-- SrScatterPlotOptions for the main req_id -->
                <SrScatterPlotOptions
                    v-if="isMounted" 
                    :req_id="Number(selectedReqId.value)"
                    :label="findLabel(Number(selectedReqId.value))"
                    />

                <!-- SrScatterPlotOptions for each overlayed req_id -->
                <div v-for="overlayedReqId in selectedOverlayedReqIds" :key="overlayedReqId">
                    <SrScatterPlotOptions 
                        :req_id="overlayedReqId" 
                        :label="findLabel(overlayedReqId)"
                    />
                </div>
            </div>        
        </div>
    </div>
</template>
<style scoped>
    
    :deep(.sr-select-menu-item) {
        padding: 1rem; 
        font-size: small;
        width: 8rem;
    }

    :deep(.sr-select-menu-default) {
        padding: 0.25rem; 
        font-size: small;
        width: 8rem; 
        height: 2.25rem; 
    }

    .sr-analysis-opt-sidebar {
        display: flex;
        flex-direction: column;
        height: 100vh;
        margin-top: auto;
        overflow-y: auto; /* Enables vertical scrolling if content exceeds available space */
    }
    .sr-analysis-opt-sidebar-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 20vw;
        width: 100%;
    }
    .sr-analysis-reqid{
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
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
        min-height: 30%;
        min-width: 20vw;
        width: 100%;
        height: 100%;
    }
    .sr-analysis-opt-sidebar-req-menu {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content:center;
        margin-top: 0.75rem;
    }
    
    .sr-req-description {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        margin: 0.75rem;
        border: 0.5rem solid;
        font-size: smaller;
        border: 1px solid;
        padding: 0.25rem;
        color:transparent
 
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
        margin-top: 0.25rem;
    }
    .sr-user-guide-link {
        display: flex;
        flex-direction: col;
        justify-content:center;
        margin-top: 0.25rem;
    }
    .sr-tracks-beams {
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        margin-top: 0.5rem;
    }
    .sr-pair-sc-orient {
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        align-items: flex-end;
    }
    .sr-sc-orientation {
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        align-items: flex-start;
        font-size: smaller;
    }


    :deep(.sr-listbox-control){
        min-height: fit-content;
    }

    .sr-tracks-beams-panel {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        align-items:baseline;
    }

    .sr-analyze-filters {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        height: 100%;
        min-height: 8rem;
    }
    .sr-sc-orient-panel {
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
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

</style>