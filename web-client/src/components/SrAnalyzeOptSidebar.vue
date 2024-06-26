<script setup lang="ts">
import { onMounted,ref,watch } from 'vue';
import SrAnalysisMap from './SrAnalysisMap.vue';
import SrMenuInput, { SrMenuItem } from './SrMenuInput.vue';
import SrSliderInput from './SrSliderInput.vue';
import {useAtl06ChartFilterStore} from '@/stores/atl06ChartFilterStore';
import { useRequestsStore } from '@/stores/requestsStore';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import router from '@/router/index.js';
import { useToast } from "primevue/usetoast";
import SrFilterBeams from './SrFilterBeams.vue';
import SrFilterTracks from './SrFilterTracks.vue';
import { db } from '@/db/SlideRuleDb';

const toast = useToast();

const requestsStore = useRequestsStore();
const curReqSumStore = useCurReqSumStore();
const atl06ChartFilterStore = useAtl06ChartFilterStore();
const props = defineProps({
    startingReqId: Number,
});

const defaultMenuItemIndex = ref(0);
const selectedReqId = ref({name:'0', value:'0'});
//const activeTabIndex = ref([0]); // Opens the first tab by default
const loading = ref(true);
const reqIds = ref<SrMenuItem[]>([]);


onMounted(async() => {
    try {
        console.log('onMounted SrAnalyzeOptSidebar');
        useAtl06ChartFilterStore().setDebugCnt(0);
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
        //console.log('reqIds:', reqIds.value, 'defaultMenuItemIndex:', defaultMenuItemIndex.value);
    } catch (error) {
        console.error('onMounted Failed to load menu items:', error);
    }
    loading.value = false;
    //console.log('Mounted SrAnalyzeOptSidebar with defaultMenuItemIndex:',defaultMenuItemIndex);
    //selectedReqId.value = reqIds.value[defaultMenuItemIndex.value];
    console.log('onMounted selectedReqId:', selectedReqId.value);
});


watch(selectedReqId, async (newSelection, oldSelection) => {
    console.log('Request ID changed from:', oldSelection ,' to:', newSelection);

    try{
        reqIds.value =  await requestsStore.getMenuItems();
        if(reqIds.value.length === 0) {
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
        atl06ChartFilterStore.setReqId(Number(newSelection.value));
        atl06ChartFilterStore.setFileName(await db.getFilename(Number(newSelection.value)));
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
</script>

<template>
    <div class="sr-analysis-opt-sidebar-container">
        <div class="sr-analysis-opt-sidebar-req-menu">
            <div v-if="loading">Loading...</div>
            <SrMenuInput 
                v-else
                label="Request Id" 
                :menuOptions="reqIds" 
                v-model="selectedReqId"
                :defaultOptionIndex="Number(defaultMenuItemIndex)"
                tooltipText="Request Id from Record table"/>  
        </div>
        <div class="sr-analysis-opt-sidebar-map" ID="AnalysisMapDiv">
            <div v-if="loading">Loading...</div>
            <SrAnalysisMap v-else :reqId="Number(selectedReqId.value)"/>
        </div>
        <div class="sr-analysis-opt-sidebar-options">
            <div>
                <div class="sr-tracks-beams">
                    <SrFilterTracks/>
                    <SrFilterBeams/>
                </div>
                <div class="sr-analyze-sliders">
                    <SrSliderInput
                        v-model="atl06ChartFilterStore.rgtValue"
                        label="RGT"
                        :min="1"
                        :max="10000" 
                        :decimalPlaces="0"
                        tooltipText="RGT is the reference ground track: defaults to all if not specified"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
                    />
                    <SrSliderInput
                        v-model="atl06ChartFilterStore.cycleValue"
                        label="Cycle"
                        :min="1"
                        :max="100" 
                        :decimalPlaces="0"
                        tooltipText="counter of 91-day repeat cycles completed by the mission (defaults to all if not specified)"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
                    />
                </div>
            </div>
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
    .sr-tracks-beams {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        margin-top: 0.5rem;
    }
    .sr-analyze-sliders {
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        margin-top: 0.5rem;
    }
</style>