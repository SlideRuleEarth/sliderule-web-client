<script setup lang="ts">
import { onMounted,ref } from 'vue';
import { useAnalyzeStore } from '@/stores/analyzeStore.js';
import SrAnalysisMap from './SrAnalysisMap.vue';
import SrMenuMultiInput from './SrMenuMultiInput.vue';
import SrSwitchedSliderInput from './SrSwitchedSliderInput.vue';
import SrSliderInput from './SrSliderInput.vue';
import Accordion from 'primevue/accordion';
import AccordionTab  from 'primevue/accordiontab';
import { useReqParamsStore } from '@/stores/reqParamsStore';

const analyzeStore = useAnalyzeStore();
const reqParamsStore = useReqParamsStore();
const activeTabIndex = ref([0]); // Opens the first tab by default

onMounted(() => {

    console.log('SrAnalyzeOptSidebar onMounted');

});

</script>

<template>
    <div class="sr-analysis-opt-sidebar-container">
        <div class="sr-analysis-opt-sidebar-map">
            <SrAnalysisMap />
        </div>
        <h3>Analysis Options</h3>
        <div class="sr-analysis-opt-sidebar-options">
            <Accordion :multiple="true" expandIcon="pi pi-plus" collapseIcon="pi pi-minus" :activeIndex="activeTabIndex" >
                <AccordionTab header="General" >
                    <SrMenuMultiInput
                            v-model="reqParamsStore.tracks"
                            label = "Track(s)"
                            aria-label="Select Tracks"
                            :menuOptions="reqParamsStore.tracksOptions"
                            :default="reqParamsStore.tracksOptions"
                            tooltipText="Each track has both a weak and a strong spot"
                            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/Background.html"
                    />
                    <SrMenuMultiInput
                        v-model="reqParamsStore.beams"
                        label = "Beam(s)"
                        aria-label="Select Beams"
                        :menuOptions="reqParamsStore.beamsOptions"
                        :default="reqParamsStore.beamsOptions"
                        tooltipText="Weak and strong spots are determined by orientation of the satellite"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/Background.html"
                    />
                    <SrSwitchedSliderInput
                        v-model="reqParamsStore.rgtValue"
                        label="RGT"
                        :min="1"
                        :max="100" 
                        :decimalPlaces="0"
                        tooltipText="RGT is the reference ground track: defaults to all if not specified"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
                    />
                    <SrSliderInput
                        v-model="reqParamsStore.cycleValue"
                        label="Cycle"
                        :min="1"
                        :max="100" 
                        :decimalPlaces="0"
                        tooltipText="counter of 91-day repeat cycles completed by the mission (defaults to all if not specified)"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
                    />
                    <SrSliderInput
                        v-model="reqParamsStore.regionValue"
                        label="Region"
                        :min="1"
                        :max="100" 
                        :decimalPlaces="0"
                        tooltipText="geographic region for corresponding standard product (defaults to all if not specified)"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-input-parameters"
                    />
                </AccordionTab>
            </Accordion>
        </div>
    </div>
</template>
<style scoped>
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
</style>