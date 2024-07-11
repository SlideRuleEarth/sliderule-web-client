<script setup lang="ts">
import { onMounted,ref,watch,computed } from 'vue';
import SrAnalysisMap from './SrAnalysisMap.vue';
import SrMenuInput, { SrMenuItem } from './SrMenuInput.vue';
import SrSliderInput from './SrSliderInput.vue';
import SrToggleButton from './SrToggleButton.vue';
import SrFilterBeams from './SrFilterBeams.vue';
import SrFilterTracks from './SrFilterTracks.vue';
import SrFilterSpots from './SrFilterSpots.vue';
import SrRecReqDisplay from './SrRecReqDisplay.vue';
import SrListbox from './SrListbox.vue';
import {useAtlChartFilterStore} from '@/stores/atlChartFilterStore';
import { useRequestsStore } from '@/stores/requestsStore';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import router from '@/router/index.js';
import { useMapStore } from '@/stores/mapStore';
import { db } from '@/db/SlideRuleDb';
import { formatBytes } from '@/utils/SrParquetUtils';
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import FieldSet from 'primevue/fieldset';
import MultiSelect from 'primevue/multiselect';
import FloatLabel from 'primevue/floatlabel';


const requestsStore = useRequestsStore();
const curReqSumStore = useCurReqSumStore();
const atlChartFilterStore = useAtlChartFilterStore();
const mapStore = useMapStore();
const srParquetCfgStore = useSrParquetCfgStore();

const props = defineProps({
    startingReqId: Number,
});

const defaultMenuItemIndex = ref(0);
const selectedReqId = ref({name:'0', value:'0'});
const loading = ref(true);
const reqIds = ref<SrMenuItem[]>([]);
const selectedRgt = ref<number[]>([]);

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
const computedScOrient = computed({
    get: () => atlChartFilterStore.getScOrient() === 1,
    set: (newValue: boolean) => {
        toggleScOrient(newValue);
    }
});

const toggleScOrient = (newValue: boolean) => {
    atlChartFilterStore.setScOrient(newValue ? 1 : 0);
    console.log('toggleScOrient:', atlChartFilterStore.getScOrient());
};
const computedPair = computed({
    get: () => atlChartFilterStore.getPair() === 1,
    set: (newValue: boolean) => {
        togglePair(newValue);
    }
});

const togglePair = (newValue: boolean) => {
    atlChartFilterStore.setPair(newValue ? 1 : 0);
    console.log('togglePair:', atlChartFilterStore.getPair());
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
        atlChartFilterStore.setFunc(await db.getFunc(Number(selectedReqId.value)));
        atlChartFilterStore.setSize(await db.getNumBytes(Number(selectedReqId.value.value)));
        console.log('Selected request:', newSelection.value, 'func:', atlChartFilterStore.getFunc());
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
        <div class="sr-analysis-opt-sidebar-options">
            <SrSliderInput
                v-model="srParquetCfgStore.maxNumPntsToDisplay"
                label="Max Num Pnts"
                :min="10000"
                :max="5000000"
                :defaultValue="1000000"
                :decimalPlaces=0
                tooltipText="Maximum number of points to display"
            />
        </div>
        <div class="sr-analyze-filters">
            <SrFilterSpots/>
            <SrListbox 
                label="Rgt(s)" 
                v-model="atlChartFilterStore.rgts" 
                :getSelectedMenuItem="atlChartFilterStore.getRgts"
                :setSelectedMenuItem="atlChartFilterStore.setRgts"
                :menuOptions="atlChartFilterStore.getRgtOptions()" 
                tooltipText="Reference Ground Track(s)" 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
            />
            <SrListbox id="cycles" 
                label="Cycle(s)" 
                v-model="atlChartFilterStore.cycles"
                :getSelectedMenuItem="atlChartFilterStore.getCycles"
                :setSelectedMenuItem="atlChartFilterStore.setCycles" 
                :menuOptions="atlChartFilterStore.getCycleOptions()" 
                tooltipText="Cycle(s)" 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
            />

            <FieldSet class = "sr-fieldset" legend="Spot Pattern Details" :toggleable="true" :collapsed="true">
                <div class="sr-tracks-beams-scorient-panel">
                    <p class="sr-scOrient">
                        <span v-if="atlChartFilterStore.getScOrient()===1">S/C Orientation: Forward</span>
                        <span v-if="atlChartFilterStore.getScOrient()===0">S/C Orientation: Backward</span>
                    </p>
                    <SrFilterTracks/>
                    <SrFilterBeams v-if="atlChartFilterStore.getFunc().includes('atl06')"/>
                </div>
                <div class="sr-pair-sc-orient">
                    <SrToggleButton 
                        v-if="atlChartFilterStore.getFunc().includes('atl03')"
                        v-model="computedScOrient" 
                        :value="useAtlChartFilterStore().scOrient==1" 
                        label="SC orientation" 
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/Background.html"
                        tooltipText="SC orientation is the orientation of the spacecraft relative to the surface normal at the time of the photon measurement."
                    />
                    <SrToggleButton 
                        v-if="atlChartFilterStore.getFunc().includes('atl03')" 
                        v-model="computedPair"  
                        :value="useAtlChartFilterStore().pair==1" 
                        label="Pair" 
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/Background.html"
                        tooltipText="There are three beam pairs"
                    />
                </div>
        </FieldSet>
        </div>
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
    .sr-analysis-opt-sidebar-options {
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
        margin-top: 0.5rem;
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
        margin-top: 0.5rem;
    }
    .sr-analyze-filters {
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        margin-top: 0.5rem;
    }
    .sr-tracks-beams-scorient-panel {
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        align-items: center;
    }
</style>