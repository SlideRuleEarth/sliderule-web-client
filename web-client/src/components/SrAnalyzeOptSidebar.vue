<script setup lang="ts">
import { onMounted,ref,watch,computed } from 'vue';
import SrAnalysisMap from './SrAnalysisMap.vue';
import SrMenuInput, { type SrMenuItem } from './SrMenuInput.vue';
import SrRecReqDisplay from './SrRecReqDisplay.vue';
import SrListbox from './SrListbox.vue';
import SrSliderInput from './SrSliderInput.vue';
import router from '@/router/index.js';
import { db } from '@/db/SlideRuleDb';
import { formatBytes, updateElevationForReqId, addHighlightLayerForReq } from '@/utils/SrParquetUtils';
import FieldSet from 'primevue/fieldset';
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

onMounted(async() => {
    console.log(`onMounted SrAnalyzeOptSidebar startingReqId:${props.startingReqId}`);  
    

    const startTime = performance.now(); // Start time
    let req_id = -1;
    try {
        mapStore.setIsLoading();

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
        //console.log('Mounted SrAnalyzeOptSidebar with defaultReqIdMenuItemIndex:',defaultReqIdMenuItemIndex);
        //selectedReqId.value = reqIds.value[defaultReqIdMenuItemIndex.value];
        atlChartFilterStore.setFunc(await db.getFunc(req_id));
        console.log('onMounted selectedReqId:',req_id, 'func:', atlChartFilterStore.getFunc());
        const endTime = performance.now(); // End time
        console.log(`onMounted took ${endTime - startTime} milliseconds.`);
    }
});


const onSelection = async() => {
    console.log('onSelection with req_id:', selectedReqId.value);
    const whereClause = getWhereClause(
        useAtlChartFilterStore().getFunc(),
        useAtlChartFilterStore().getSpotValues(),
        useAtlChartFilterStore().getRgtValues(),
        useAtlChartFilterStore().getCycleValues(),
    );
    if(useAtlChartFilterStore().getFunc()==='atl03sp'){
        useAtlChartFilterStore().setAtl03spWhereClause(whereClause);
    } else if(useAtlChartFilterStore().getFunc()==='atl03vp'){
        useAtlChartFilterStore().setAtl03vpWhereClause(whereClause);
    } else if (useAtlChartFilterStore().getFunc()==='atl06p'){
        useAtlChartFilterStore().setAtl06WhereClause(whereClause);
    } else if (useAtlChartFilterStore().getFunc()==='atl06sp'){
        useAtlChartFilterStore().setAtl06WhereClause(whereClause);
    } else if (useAtlChartFilterStore().getFunc()==='atl08sp'){
        useAtlChartFilterStore().setAtl08pWhereClause(whereClause);
    }
    useAtlChartFilterStore().updateScatterPlot();
    if( (useAtlChartFilterStore().getRgtValues().length > 0) &&
        (useAtlChartFilterStore().getCycleValues().length > 0) &&
        (useAtlChartFilterStore().getSpotValues().length > 0)
    ){
        await addHighlightLayerForReq(useAtlChartFilterStore().getReqId());
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
    if(req_id <= 0){
        console.warn(`updateElevationMap Invalid request ID:${req_id}`);
        return;
    }
    try {
        atlChartFilterStore.setReqId(req_id);
        const request = await db.getRequest(req_id);
        console.log('Request:', request);
        if(request && request.file){
            atlChartFilterStore.setFileName(request.file);
        } else {
            console.error('No file found for req_id:', req_id);
        }
        if(request && request.func){
            atlChartFilterStore.setFunc(request.func);
        } else {
            console.error('No func found for req_id:', req_id);
        }
        if(request && request.description){
            atlChartFilterStore.setDescription(request.description);
        } else {
            // this is not an error, just a warning
            console.warn('No description found for req_id:', req_id);
            atlChartFilterStore.setDescription('description');
        }
        if(request && request.num_bytes){
            atlChartFilterStore.setSize(request.num_bytes);
        } else {
            console.error('No num_bytes found for req_id:', req_id);
        }
        if(request && request.cnt){
            atlChartFilterStore.setRecCnt(parseInt(String(request.cnt)));
        } else {
            console.error('No num_points found for req_id:', req_id);
        }

        deckStore.deleteSelectedLayer();
        console.log('Request ID:', req_id, 'func:', atlChartFilterStore.getFunc());
        updateElevationForReqId(atlChartFilterStore.getReqId());
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
    } catch (error) {
        console.warn('Failed to update selected request:', error);
        //toast.add({ severity: 'warn', summary: 'No points in file', detail: 'The request produced no points', life: srToastStore.getLife()});
    }
    try {
        console.log('pushing selectedReqId:', req_id);
        router.push(`/analyze/${useAtlChartFilterStore().getReqId()}`);
        console.log('Successfully navigated to analyze:', useAtlChartFilterStore().getReqId());
    } catch (error) {
        console.error('Failed to navigate to analyze:', error);
    }
    
};
const debouncedUpdateElevationMap = debounce(updateElevationMap, 500);


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
        debouncedUpdateElevationMap(req_id);
    } catch (error) {
        console.error('Failed to update selected request:', error);
    }
});

const getSize = computed(() => {
    return formatBytes(atlChartFilterStore.getSize());
});
const getCnt = computed(() => {
    return new Intl.NumberFormat().format(parseInt(String(atlChartFilterStore.getRecCnt())));
});

</script>

<template>
    <div class="sr-analysis-opt-sidebar">
        <div class="sr-analysis-opt-sidebar-container">
            <div class="sr-analysis-opt-sidebar-req-menu">
                <div class="sr-analysis-reqid-sz">
                    <div class="sr-analysis-reqid" v-if="loading">Loading... menu</div>
                    <div class="sr-analysis-reqid" v-else>
                        <SrMenuInput 
                            label="Record Id" 
                            :menuOptions="reqIds" 
                            v-model="selectedReqId"
                            @update:modelValue="debouncedUpdateElevationMap(Number(selectedReqId.value))"
                            :defaultOptionIndex="Number(defaultReqIdMenuItemIndex)"
                            tooltipText="Request Id from Record table"
                        />
                    </div>
                    <div class="sr-analysis-sz" v-if="!loading">
                        <div>
                            {{ getSize }} 
                        </div>
                        <div>
                            {{ getCnt }} recs
                        </div>
                    </div>
                </div>
            </div>
            <div class="sr-analysis-opt-sidebar-map" ID="AnalysisMapDiv">
                <div v-if="loading">Loading...{{ atlChartFilterStore.getFunc() }}</div>
                <SrAnalysisMap v-else :reqId="Number(selectedReqId.value)"/>
            </div>
            <div class="sr-req-description">  
                <SrEditDesc :reqId="Number(selectedReqId.value)"/>
            </div>
            <div>
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
                <SrListbox id="beams" 
                        v-if="useDebugStore().enableSpotPatternDetails"
                        :insensitive="true"
                        label="Beam(s)" 
                        v-model="atlChartFilterStore.beams"
                        :getSelectedMenuItem="atlChartFilterStore.getBeams"
                        :setSelectedMenuItem="atlChartFilterStore.setBeams"
                        :menuOptions="beamsOptions" 
                        tooltipText="ATLAS laser beams are divided into weak and strong beams"
                        @update:modelValue="BeamSelection"
                    />
                <div class="sr-rgts-cycles-panel">
                    <SrListbox id="rgts"
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
                        label="Cycle(s)" 
                        v-model="atlChartFilterStore.cycles"
                        :getSelectedMenuItem="atlChartFilterStore.getCycles"
                        :setSelectedMenuItem="atlChartFilterStore.setCycles" 
                        :menuOptions="cyclesOptions" 
                        tooltipText="Counter of 91-day repeat cycles completed by the mission" 
                        @update:modelValue="CyclesSelection"
                    />
                </div>
            </div>
            <FieldSet v-if="useDebugStore().enableSpotPatternDetails" class = "sr-fieldset" legend="Spot Pattern Details" :toggleable="true" :collapsed="false" >
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
                </div>
            </FieldSet>
            <SrRecReqDisplay :reqId="Number(selectedReqId.value)"/>
        </div>
    </div>
</template>
<style scoped>
    .sr-analysis-opt-sidebar {
        display: flex;
        flex-direction: column;
        height: 100vh;
        margin-top: auto;
    }
    .sr-analysis-opt-sidebar-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 1rem;
        height: 100%;
        min-width: 20vw;
        width: 100%;
        overflow-y: auto; /* Enables vertical scrolling if content exceeds available space */
    }
    .sr-analysis-reqid-sz{
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }
    .sr-analysis-sz{
        display: flex;
        flex-direction: column;
        align-items: left;
        justify-content: space-between;
        font-size: small;
    }
    .sr-analysis-opt-sidebar-map {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between; 
        min-height: 30%;
        min-width: 20vw;
        width: 100%;
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
        margin: 2rem;
        border: 0.5rem solid;
        font-size: smaller;
        border: 1px solid;
        padding: 0.25rem;
        color:transparent
 
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
    .sr-analyze-filters {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
    }
    .sr-tracks-beams-panel {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        align-items:baseline;
    }
    .sr-rgts-cycles-panel {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        align-items:baseline;
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
</style>