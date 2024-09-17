<script setup lang="ts">
import { useReqParamsStore } from '@/stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();
</script>
<template>
    <SrSliderInput
        v-model="reqParamsStore.binSize"
        label="Bin Size"
        :min="0"
        :max="200"
        :decimalPlaces="0"
    />
    <SrMenuInput
        v-model="reqParamsStore.geoLocation"
        label = "Geo Location"
        aria-label="Select Geo Location"
        :menuOptions="reqParamsStore.geoLocationOptions"
    />
    <SrCheckbox
        label="Use Absolute Heights"
        v-model="reqParamsStore.useAbsoluteHeights"
    />
    <SrCheckbox
        label="Send Waveforms"
        v-model="reqParamsStore.sendWaveforms"
    />
    <SrCheckbox
        label="Use ABoVE Classifier"
        v-model="reqParamsStore.useABoVEClassifier"   
    />
</template>