<script setup lang="ts">

import SrSliderInput from './SrSliderInput.vue';
import SrMenuInput from './SrMenuInput.vue';
import SrCheckbox from './SrCheckbox.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();

</script>
<template>
    <div class="sr-ext-distance-container">
        <div class="sr-ext-distance-header-container">
            <SrMenuInput
                v-model="reqParamsStore.distanceIn"
                label = "Distance In"
                aria-label="Select Distance in"
                :menuOptions="reqParamsStore.distanceInOptions"
            />
        </div>
        <SrSliderInput
            v-if="reqParamsStore.distanceIn.value==='meters'"
            v-model="reqParamsStore.lengthValue"
            label="Length in meters"
            :min="5"
            :max="200" 
            :decimal-places="0"                  
        />
        <SrSliderInput
            v-if="reqParamsStore.distanceIn.value==='meters'"
            v-model="reqParamsStore.stepValue"
            label="Step Size (meters)"
            :min="5"
            :max="100" 
            :decimal-places="0"
        />
        <SrSliderInput
            v-if="reqParamsStore.distanceIn.value==='segments'"
            v-model="reqParamsStore.lengthValue"
            label="Length in segments"
            :min="5"
            :max="200" 
            :decimal-places="0"                  
        />
        <SrSliderInput
            v-if="reqParamsStore.distanceIn.value==='segments'"
            v-model="reqParamsStore.stepValue"
            label="Step Size (segments)"
            :min="1"
            :max="100" 
            :decimal-places="0"
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
        />
        <SrSliderInput
            :insensitive="reqParamsStore.passInvalid"
            v-model="reqParamsStore.minimumPhotonCount"
            label="Minimum Photon Count"
            :min="0"
            :max="200" 
            :decimal-places="0"
        />
    </div>

</template>
<style scoped>
.sr-ext-distance-container{
    border: 1px solid grey;
    border-radius: var(--border-radius);
    margin-bottom: 1rem;
    padding: 0.25rem;
}
.sr-ext-distance-header-container{
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
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