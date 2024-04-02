<script setup lang="ts">

import SrSliderInput from './SrSliderInput.vue';
import SrMenuInput from './SrMenuInput.vue';
import SrCheckbox from './SrCheckbox.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();

</script>
<template>
    <div class="sr-ext-distance-container">
        <h4 class="sr-ext-distance-header">Extents</h4>
        <div class="sr-ext-distance-header-container">
            <SrMenuInput
                v-model="reqParamsStore.distanceIn"
                label = "Distance In"
                aria-label="Select Distance in"
                :menuOptions="reqParamsStore.distanceInOptions"
                tooltipText="Selected photons are collected into extents, each of which may be suitable for elevation fitting. The distance in parameter determines the size of the extents. The distance in parameter may be specified in meters or segments. If meters is selected, the length of the extent is specified in meters and the step size is specified in meters. If segments is selected, the length of the extent is specified in segments and the step size is specified in segments. "
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-extent-parameters"
            />
        </div>
        <SrSliderInput
            v-if="reqParamsStore.distanceIn.value==='meters'"
            v-model="reqParamsStore.lengthValue"
            label="Length in meters"
            :min="5"
            :max="200" 
            :decimal-places="0"                  
            tooltipText="The length of the extent in meters"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-extent-parameters"
        />
        <SrSliderInput
            v-if="reqParamsStore.distanceIn.value==='meters'"
            v-model="reqParamsStore.stepValue"
            label="Step Size (meters)"
            :min="5"
            :max="100" 
            :decimal-places="0"
            tooltipText="The Step Size of the extent in meters"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-extent-parameters"
        />
        <SrSliderInput
            v-if="reqParamsStore.distanceIn.value==='segments'"
            v-model="reqParamsStore.lengthValue"
            label="Length in segments"
            :min="5"
            :max="200" 
            :decimal-places="0"                  
            tooltipText="The length of the extent in segments"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-extent-parameters"
        />
        <SrSliderInput
            v-if="reqParamsStore.distanceIn.value==='segments'"
            v-model="reqParamsStore.stepValue"
            label="Step Size (segments)"
            :min="1"
            :max="100" 
            :decimal-places="0"
            tooltipText="The length of the extent in segments"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-extent-parameters"
        />
    </div>
    <div class="sr-pass-invalid-container">
        <div class="sr-pass-invalid-header-container">
            <SrCheckbox
                label="Pass Invalid"
                v-model="reqParamsStore.passInvalid"
            />
        </div>  
        <SrSliderInput
            :insensitive="reqParamsStore.passInvalid"
            v-model="reqParamsStore.alongTrackSpread"
            label="Along Track Spread"
            :min="0"
            :max="200" 
            :decimal-places="0"
            tooltipText="minimum along track spread"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-extent-parameters"
        />
        <SrSliderInput
            :insensitive="reqParamsStore.passInvalid"
            v-model="reqParamsStore.minimumPhotonCount"
            label="Minimum Photon Count"
            :min="0"
            :max="200" 
            :decimal-places="0"
            tooltipText="minimum photon count in segments"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-extent-parameters"
        />
    </div>

</template>
<style scoped>
.sr-ext-distance-container{
    display: flex;
    flex-direction: column;
    border: 1px solid grey;
    border-radius: var(--border-radius);
    margin-bottom: 0.25rem;
    padding: 0.25rem;
    align-items: center;
    justify-content: center;
    background-color: transparent;
}
.sr-ext-distance-header{
    font-size: large;
    background-color: transparent;
    margin: 0rem;
    margin-bottom: 0.25rem;
}

.sr-ext-distance-container{
    display: flex;
    flex-direction: column;
    border: 1px solid grey;
    border-radius: var(--border-radius);
    margin-bottom: 1rem;
    padding: 0.25rem;
    align-items: center;
    justify-content: center;
}
.sr-ext-distance-header-container{
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1rem;
}
.sr-pass-invalid-container{
    border: 1px solid grey;
    border-radius: var(--border-radius);
    padding: 0.25rem;
}
.sr-pass-invalid-header-container{
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
}
:deep(.sr-pass-invalid-header-container .sr-checkbox-label){
    font-size: large;
}
:deep(.sr-ext-distance-header-container .sr-select-menu-label){
    font-size: large;
}
</style>