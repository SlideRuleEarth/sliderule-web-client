<script setup lang="ts">

import SrSliderInput from './SrSliderInput.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

const reqParamsStore = useReqParamsStore();

</script>
<template>
    <div class="sr-surface-elevation-container">
        <div class="sr-surface-elevation-header">
            <SrLabelInfoIconButton 
                label="Surface Elevation"
                labelFontSize="large" 
                tooltipText="The surface elevation of the selected photons"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#atl06-sr-algorithm-parameters"
            />
        </div>
        <div class="sr-surface-elevation-body">
            <SrSliderInput
                        v-model="reqParamsStore.maxIterations"
                        label="Max Iterations"
                        :min="1"
                        :max="200"
                        :defaultValue="reqParamsStore.maxIterations" 
                        :decimalPlaces="0"
                        tooltipText="The maximum number of iterations, not including initial least-squares-fit selection"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#atl06-sr-algorithm-parameters"
                    />
            <SrSliderInput
                v-model="reqParamsStore.minWindowHeight"
                label="Min window height (meters)"
                :min="0"
                :max="200"
                :defaultValue="reqParamsStore.minWindowHeight" 
                :decimalPlaces="0"
                tooltipText="The minimum height to which the refined photon-selection window is allowed to shrink, in meters"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#atl06-sr-algorithm-parameters"
            />
            <SrSliderInput
                v-model="reqParamsStore.maxRobustDispersion"
                label="Max robust dispersion (meters)"
                :min="0"
                :max="200"
                :defaultValue="reqParamsStore.maxRobustDispersion" 
                :decimalPlaces="0"
                tooltipText="The maximum robust dispersion in meters"
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
    border-radius: var(--border-radius);
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