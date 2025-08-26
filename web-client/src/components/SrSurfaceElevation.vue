<script setup lang="ts">

import SrSwitchedSliderInput from '@/components/SrSwitchedSliderInput.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { onMounted } from 'vue';
import { useSlideruleDefaults } from '@/stores/defaultsStore';
import SrCheckbox from '@/components/SrCheckbox.vue';

const reqParamsStore = useReqParamsStore();

const defaultMaxIterations = () => {
    return useSlideruleDefaults().getNestedMissionDefault<number>(reqParamsStore.missionValue,'maxi') as number;
};
const defaultMinWindowHeight = () => {
    return useSlideruleDefaults().getNestedMissionDefault<number>(reqParamsStore.missionValue,'H_min_win') as number;
};
const defaultMaxRobustDispersion = () => {
    return useSlideruleDefaults().getNestedMissionDefault<number>(reqParamsStore.missionValue,'sigma_r_max') as number;
};

const ccvDefaultMaxIterations = () => {
    return reqParamsStore.getUseMaxIterations() !== undefined ? reqParamsStore.getUseMaxIterations() : false;
};

const ccvDefaultMinWindowHeight = () => {
    return reqParamsStore.getUseMinWindowHeight() !== undefined ? reqParamsStore.getUseMinWindowHeight() : false;
};

const ccvDefaultMaxRobustDispersion = () => {
    return reqParamsStore.getUseMaxRobustDispersion() !== undefined ? reqParamsStore.getUseMaxRobustDispersion() : false;
};

onMounted(async () => {

})

</script>
<template>
    <div class="sr-surface-elevation-container">
        <div class="sr-surface-elevation-header">
            <SrCheckbox 
                label="Surface Elevation Algorithm" 
                labelFontSize="large"
                v-model="reqParamsStore.useSurfaceFitAlgorithm"
                tooltipText="Surface Fit parameters for the algorithm" 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/xseries.html#surface-fit" 
                :defaultValue="reqParamsStore.useSurfaceFitAlgorithm"
            />
        </div>
        <div class="sr-surface-elevation-body">
            <SrSwitchedSliderInput
                v-model="reqParamsStore.maxIterations"
                label="Max Iterations"
                :getCheckboxValue="reqParamsStore.getUseMaxIterations"
                :setCheckboxValue="reqParamsStore.setUseMaxIterations"
                :getValue="reqParamsStore.getMaxIterations"
                :setValue="reqParamsStore.setMaxIterations"
                :defaultValue="defaultMaxIterations()" 
                :currentCheckboxValue="ccvDefaultMaxIterations()"
                :min="1"
                :max="200"
                :sliderMin="1"
                :sliderMax="10"
                :decimalPlaces="0"
                tooltipText="maxi: The maximum number of iterations, not including initial least-squares-fit selection"
                :insensitive="!reqParamsStore.useSurfaceFitAlgorithm"
            />
            <SrSwitchedSliderInput
                v-model="reqParamsStore.minWindowHeight"
                label="Min window height"
                :min="0"
                :max="200"
                :getCheckboxValue="reqParamsStore.getUseMinWindowHeight"
                :setCheckboxValue="reqParamsStore.setUseMinWindowHeight"
                :getValue="reqParamsStore.getMinWindowHeight"
                :setValue="reqParamsStore.setMinWindowHeight"
                :defaultValue="defaultMinWindowHeight()" 
                :currentCheckboxValue="ccvDefaultMinWindowHeight()"
                :sliderMin="3"
                :sliderMax="20"
                :decimalPlaces="0"
                tooltipText="H_min_win: The minimum height to which the refined photon-selection window is allowed to shrink, in meters"
                :insensitive="!reqParamsStore.useSurfaceFitAlgorithm"
            />
            <SrSwitchedSliderInput
                v-model="reqParamsStore.maxRobustDispersion"
                label="Max robust dispersion"
                :getCheckboxValue="reqParamsStore.getUseMaxRobustDispersion"
                :setCheckboxValue="reqParamsStore.setUseMaxRobustDispersion"
                :getValue="reqParamsStore.getSigmaRmax"
                :setValue="reqParamsStore.setSigmaRmax"
                :defaultValue="defaultMaxRobustDispersion()" 
                :currentCheckboxValue="ccvDefaultMaxRobustDispersion()"
                :min="0"
                :max="200"
                :decimalPlaces="0"
                tooltipText="sigma_r_max: The maximum robust dispersion in meters"
                :insensitive="!reqParamsStore.useSurfaceFitAlgorithm"
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