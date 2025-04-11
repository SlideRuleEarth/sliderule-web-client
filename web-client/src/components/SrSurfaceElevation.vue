<script setup lang="ts">

import SrSliderInput from './SrSliderInput.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
import SrCheckbox from './SrCheckbox.vue';
import { useSlideruleDefaults } from '@/stores/defaultsStore';
import { onMounted } from 'vue';

const reqParamsStore = useReqParamsStore();
async function presetValues() {
    if (!reqParamsStore.enableSurfaceElevation) {
        const min_window_height = await useSlideruleDefaults().getNestedMissionDefault<number>(reqParamsStore.missionValue, 'H_min_win');
        if(min_window_height){
            reqParamsStore.minWindowHeight = min_window_height;
        }
        const sigma_r_max = await useSlideruleDefaults().getNestedMissionDefault<number>(reqParamsStore.missionValue, 'sigma_r_max');
        if(sigma_r_max){
            reqParamsStore.setSigmaRmax(sigma_r_max);
        }
        const maxIterations = await useSlideruleDefaults().getNestedMissionDefault<number>(reqParamsStore.missionValue, 'maxi');
        if(maxIterations){
            reqParamsStore.setMaxIterations(maxIterations);
        }
    }
}

onMounted(async () => {

})

</script>
<template>
    <div class="sr-surface-elevation-container">
        <div class="sr-surface-elevation-header">
            <SrCheckbox 
                label="Surface Elevation Algorithm"
                v-model="reqParamsStore.enableSurfaceElevation"
                @update:model-value="presetValues"
                labelFontSize="large" 
                tooltipText="The surface elevation of the selected photons"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#atl06-sr-algorithm-parameters"
            />
        </div>
        <div class="sr-surface-elevation-body">
            <SrSliderInput
                v-model="reqParamsStore.maxIterations"
                label="Max Iterations"
                :insensitive="!reqParamsStore.enableSurfaceElevation"
                :min="1"
                :max="200"
                :sliderMin="1"
                :sliderMax="10"
                :defaultValue="reqParamsStore.maxIterations" 
                :decimalPlaces="0"
                tooltipText="maxi: The maximum number of iterations, not including initial least-squares-fit selection"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#atl06-sr-algorithm-parameters"
            />
            <SrSliderInput
                v-model="reqParamsStore.minWindowHeight"
                label="Min window height (meters)"
                :insensitive="!reqParamsStore.enableSurfaceElevation"
                :min="0"
                :max="200"
                :sliderMin="3"
                :sliderMax="20"
                :defaultValue="reqParamsStore.minWindowHeight" 
                :decimalPlaces="0"
                tooltipText="H_min_win: The minimum height to which the refined photon-selection window is allowed to shrink, in meters"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#atl06-sr-algorithm-parameters"
            />
            <SrSliderInput
                v-model="reqParamsStore.maxRobustDispersion"
                label="Max robust dispersion (meters)"
                :insensitive="!reqParamsStore.enableSurfaceElevation"
                :min="0"
                :max="200"
                :defaultValue="reqParamsStore.maxRobustDispersion" 
                :decimalPlaces="0"
                tooltipText="sigma_r_max: The maximum robust dispersion in meters"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#atl06-sr-algorithm-parameters"
            />
        </div>
    </div>
</template>
<style scoped>
.sr-surface-elevation-container {
    margin: 0px;
    padding: 0.5rem;
    border-color: transparent;
    border-radius: var(--p-border-radius);
    background-color: transparent;
}
.sr-surface-elevation-header {
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1rem;
}
</style>