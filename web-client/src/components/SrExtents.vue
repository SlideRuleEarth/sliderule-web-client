<script setup lang="ts">

import SrSliderInput from './SrSliderInput.vue';
import SrMenuInput from './SrMenuInput.vue';
import SrCheckbox from './SrCheckbox.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

const reqParamsStore = useReqParamsStore();

</script>
<template>
    <div class="sr-extents-container">
        <div class="sr-extents-top-header">
            <SrLabelInfoIconButton 
                    label="Extents" 
                    tooltipText="Selected photons are collected into extents, each of which may be suitable for elevation fitting. The API may also select photons based on their along-track distance, or based on the segment-id parameters in the ATL03 product." 
                    tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-extent-parameters" 
                    labelFontSize="larger"/>
        </div>
        <div class="sr-ext-distance-container">
            <div class="sr-ext-distance-header-container">
                <SrMenuInput
                        v-model="reqParamsStore.distanceIn"
                        label = "Distance In"
                        labelFontSize="large"
                        :justify_center='false'
                        aria-label="Select Distance in"
                        :menuOptions="reqParamsStore.distanceInOptions"
                        tooltipText="Distance in meters or segments"
                        tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-extent-parameters"
                />
                </div>
            <div class="sr-ext-distance-body-container">
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
        </div>  
        <div class="sr-pass-invalid-container">
            <div class="sr-pass-invalid-header-container">
                <SrCheckbox
                    label="Pass Invalid"
                    labelFontSize="large"
                    v-model="reqParamsStore.passInvalid"
                    tooltipText="indicating whether or not extents that fail validation checks are still used and returned in the results" 
                    tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#photon-extent-parameters"
                />
            </div> 
            <div>
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
        </div>
    </div>
</template>
<style scoped>


.sr-extents-container{
    display: flex;
    flex-direction: column;
    border: 1px solid transparent;
    border-radius: var(--p-border-radius);
    align-items: center;
    justify-content: space-between;
    background-color: transparent;
}
.sr-extents-top-header{
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1.5rem;
}
.sr-ext-distance-container{
    display: flex;
    flex-direction: column;
    border: 1px solid grey;
    border-radius: var(--p-border-radius);
    margin-bottom: 1rem;
    padding: 0.5rem;
    align-items: center;
    justify-content: space-between;
}

.sr-ext-distance-header-container{
    display: flex;
    flex-direction: column;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1rem;
}

.sr-ext-distance-body-container{
    display: flex;
    flex-direction: column;
    justify-content: space-between; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1rem;
}

.sr-pass-invalid-container{
    border: 1px solid grey;
    border-radius: var(--p-border-radius);
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