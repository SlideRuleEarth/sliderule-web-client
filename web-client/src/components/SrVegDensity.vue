<script setup lang="ts">
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { geoLocationOptions } from '@/types/SrStaticOptions';
import SrSwitchedSliderInput from '@/components/SrSliderInput.vue';
import Select from 'primevue/select';
import SrCheckbox from '@/components/SrCheckbox.vue';
import { onMounted } from 'vue';
import { useSlideruleDefaults } from '@/stores/defaultsStore';

const defaultsStore = useSlideruleDefaults();
const reqParamsStore = useReqParamsStore();

onMounted(() => {
    reqParamsStore.phoreal = defaultsStore.getNestedMissionDefault('ICESat-2', 'phoreal') ?? {};
});

</script>
<template>
    <SrSwitchedSliderInput
        v-model="reqParamsStore.phoreal.binsize"
        label="Bin Size"
        :min="0"
        :max="200"
        :decimalPlaces="0"
    />
    <Select
        v-model="reqParamsStore.phoreal.geoloc"
        :options="geoLocationOptions"
        optionLabel="name"
        label = "Geo Location"
        aria-label="Select Geo Location"
        size="small"
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