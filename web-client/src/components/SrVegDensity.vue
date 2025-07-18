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
    console.log('Phoreal defaults applied:', reqParamsStore.phoreal);
});

</script>
<template>
    <div class="phoreal-settings">
        <div class="row">
            <SrSwitchedSliderInput
                label="Bin Size"
                v-model="reqParamsStore.phoreal.binsize"
                :min="0"
                :max="200"
                :decimalPlaces="0"
                size="small"
                :sliderWidth="'12rem'"
            />
        </div>
        <div class="row">
            <label class="form-label">Geo Location</label>
            <Select
                v-model="reqParamsStore.phoreal.geoloc"
                :options="geoLocationOptions"
                aria-label="Select Geo Location"
                class="select"
                size="small"
            />
        </div>
        <div class="checkbox-group">
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
        </div>
    </div>
</template>

<style scoped>
.phoreal-settings {
    background: #22252b;
    border-radius: 1rem;
    padding: 1.2rem 1rem;
    box-shadow: 0 2px 16px #0004;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
}

.row {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.form-label {
    color: #e5e7eb;
    font-size: 0.97em;
    font-weight: 500;
    flex-shrink: 0;
}

.slider {
    flex: 1;
}

.select {
    flex: 1;
}

.checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.3rem;
}
</style>
