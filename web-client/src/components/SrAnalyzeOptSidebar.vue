<script setup lang="ts">
import { onMounted,ref,watch,computed } from 'vue';
import SrAnalysisMap from './SrAnalysisMap.vue';
import SrMenuInput, { SrMenuItem } from './SrMenuInput.vue';
import SrRecReqDisplay from './SrRecReqDisplay.vue';
import SrListbox from './SrListbox.vue';
import router from '@/router/index.js';
import { db } from '@/db/SlideRuleDb';
import { formatBytes, updateElevationForReqId } from '@/utils/SrParquetUtils';
import FieldSet from 'primevue/fieldset';
import { tracksOptions,beamsOptions,spotsOptions } from '@/utils/parmUtils';
import { useMapStore } from '@/stores/mapStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useRequestsStore } from '@/stores/requestsStore';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { useDeckStore } from '@/stores/deckStore';
import { useDebugStore } from '@/stores/debugStore';
import { updateCycleOptions, updateRgtOptions } from '@/utils/SrDuckDbUtils';
import { getScOrientFromSpotGt } from '@/utils/parmUtils';

const requestsStore = useRequestsStore();
const curReqSumStore = useCurReqSumStore();
const atlChartFilterStore = useAtlChartFilterStore();
const mapStore = useMapStore();

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

const defaultMenuItemIndex = ref(0);
const selectedReqId = ref({name:'0', value:'0'});
const loading = ref(true);
const reqIds = ref<SrMenuItem[]>([]);
const rgtsOptions = computed(() => atlChartFilterStore.getRgtOptions());
const cyclesOptions = computed(() => atlChartFilterStore.getCycleOptions());

onMounted(async() => {
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
            defaultMenuItemIndex.value = reqIds.value.findIndex(item => item.value === startId);
            //console.log('defaultMenuItemIndex:', defaultMenuItemIndex.value);
            selectedReqId.value = reqIds.value[defaultMenuItemIndex.value];
        } else {
            defaultMenuItemIndex.value = 0;
            selectedReqId.value = reqIds.value[0];
        }
        console.log('selectedReqId:', selectedReqId.value);
        //console.log('reqIds:', reqIds.value, 'defaultMenuItemIndex:', defaultMenuItemIndex.value);
        console.log('onMounted SrAnalyzeOptSidebar');
    } catch (error) {
        console.error('onMounted Failed to load menu items:', error);
    }
    loading.value = false;
    //console.log('Mounted SrAnalyzeOptSidebar with defaultMenuItemIndex:',defaultMenuItemIndex);
    //selectedReqId.value = reqIds.value[defaultMenuItemIndex.value];
    atlChartFilterStore.setFunc(await db.getFunc(Number(selectedReqId.value)));
    console.log('onMounted selectedReqId:', selectedReqId.value, 'func:', atlChartFilterStore.getFunc());
});


const SpotOrBeamSelection = () => {
    console.log('SpotOrBeamSelection:');
    
    const gts = atlChartFilterStore.getTracks();
    const spots = atlChartFilterStore.getSpots();

    gts.forEach((gt) => {
        spots.forEach((spot) => {
            const scOrient = getScOrientFromSpotGt(spot.value, gt.value);
            if(scOrient >= 0){
                useAtlChartFilterStore().appendScOrientWithNumber(scOrient);
            }
        });
    });

    useAtlChartFilterStore().updateScatterPlot();
};

const RgtsSelection = () => {
    console.log('RgtsSelection:');
    useAtlChartFilterStore().updateScatterPlot();
};

const CyclesSelection = () => {
    console.log('CyclesSelection:');
    useAtlChartFilterStore().updateScatterPlot();
};

const scOrientsSelection = () => {
    console.log('scOrientsSelection:');
    useAtlChartFilterStore().updateScatterPlot();
};

const pairsSelection = () => {
    console.log('pairsSelection:');
    useAtlChartFilterStore().updateScatterPlot();
};

const tracksSelection = () => {
    console.log('tracksSelection:');
    useAtlChartFilterStore().updateScatterPlot();
};

watch(selectedReqId, async (newSelection, oldSelection) => {
    console.log('Request ID changed from:', oldSelection ,' to:', newSelection);

    try{
        reqIds.value =  await requestsStore.getMenuItems();
        if((reqIds.value.length === 0)  || (newSelection.value==='0')){
            console.warn('No requests found');
            return;
        }        
        //console.log('reqIds:', reqIds.value);

        const selectionNdx = reqIds.value.findIndex(item => item.value === newSelection.value);
        //console.log('selectionNdx:', selectionNdx);
        if (selectionNdx === -1) { // i.e. not found
            newSelection = reqIds.value[0];  
        }
        //console.log('Using filtered newSelection:', newSelection);
        curReqSumStore.setReqId(Number(newSelection.value));
        atlChartFilterStore.setReqId(Number(newSelection.value));
        atlChartFilterStore.setFileName(await db.getFilename(Number(newSelection.value)));
        atlChartFilterStore.setFunc(await db.getFunc(Number(selectedReqId.value.value)));
        atlChartFilterStore.setSize(await db.getNumBytes(Number(selectedReqId.value.value)));
        useDeckStore().deleteSelectedLayer();
        console.log('Selected request:', newSelection.value, 'func:', atlChartFilterStore.getFunc());
        updateElevationForReqId(atlChartFilterStore.getReqId());
        const rgts = await updateRgtOptions(atlChartFilterStore.getReqId());
        console.log('handleWorkerMsg opfs_ready rgts:',rgts);
        const cycles = await updateCycleOptions(atlChartFilterStore.getReqId());
        console.log('handleWorkerMsg opfs_ready cycles:',cycles);
    } catch (error) {
        console.error('Failed to update selected request:', error);
    }
    try {
        console.log('pushing selectedReqId:', newSelection.value);
        router.push(`/analyze/${useCurReqSumStore().getReqId()}`);
        console.log('Successfully navigated to analyze:', useCurReqSumStore().getReqId());
    } catch (error) {
        console.error('Failed to navigate to analyze:', error);
    }

}, { deep: true, immediate: true });

const getSize = computed(() => {
    return formatBytes(atlChartFilterStore.getSize());
});

</script>

<template>
    <div class="sr-analysis-opt-sidebar-container">
        <div class="sr-analysis-opt-sidebar-req-menu">
            <div class="sr-analysis-reqid-sz">
            <div class="sr-analysis-reqid" v-if="loading">Loading... menu</div>
            <div class="sr-analysis-reqid" v-else>
                <SrMenuInput 
                    label="Request Id" 
                    :menuOptions="reqIds" 
                    v-model="selectedReqId"
                    :defaultOptionIndex="Number(defaultMenuItemIndex)"
                    tooltipText="Request Id from Record table"/> 
            </div>
            <div class="sr-analysis-sz" v-if="!loading">
                {{ getSize }} 
            </div>
        </div>
        </div>
        <div>
            <SrRecReqDisplay :reqId="Number(selectedReqId.value)"/>
        </div>
        <div class="sr-analysis-opt-sidebar-map" ID="AnalysisMapDiv">
            <div v-if="loading">Loading...{{ atlChartFilterStore.getFunc() }}</div>
            <SrAnalysisMap v-else :reqId="Number(selectedReqId.value)"/>
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
                    @update:modelValue="SpotOrBeamSelection"
                />
            <SrListbox id="beams" 
                    :insensitive="true"
                    label="Beam(s)" 
                    v-model="atlChartFilterStore.beams"
                    :getSelectedMenuItem="atlChartFilterStore.getBeams"
                    :setSelectedMenuItem="atlChartFilterStore.setBeams"
                    :menuOptions="beamsOptions" 
                    tooltipText="ATLAS laser beams are divided into weak and strong beams"
                    @update:modelValue="SpotOrBeamSelection"
                />
        </div>
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
        <FieldSet v-if="useDebugStore().enableSpotPatternDetails" class = "sr-fieldset" legend="Spot Pattern Details" :toggleable="true" :collapsed="true" v-tooltip="spotPatternBriefStr">
            <div class="sr-user-guide-link">
                <a class="sr-link-small-text" href="https://nsidc.org/sites/default/files/documents/user-guide/atl03-v006-userguide.pdf" target="_blank" v-tooltip="spotPatternDetailsStr">Photon Data User Guide</a>
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
                        v-if="atlChartFilterStore.getFunc().includes('atl03')"
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
                        v-if="atlChartFilterStore.getFunc().includes('atl03')"
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
    </div>
</template>
<style scoped>
    .sr-analysis-opt-sidebar-req-menu {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content:center;
    }
    .sr-analysis-opt-sidebar-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between; 
        margin-top: 1rem;
        min-height: 30%;
        max-height: 30%;
        min-width: 30vw;
        width: 100%;
    }
    .sr-analysis-reqid-sz{
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }
    .sr-analysis-sz{
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        font-size: small;
    }
    .sr-analysis-opt-sidebar-map {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between; 
        margin-top: 1rem;
        min-height: 30%;
        max-height: 30%;
        min-width: 30vw;
        width: 100%;
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