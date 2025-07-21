<script setup lang="ts">
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { geoLocationOptions } from '@/types/SrStaticOptions';
import SrSwitchedSliderInput from '@/components/SrSliderInput.vue';
import Select from 'primevue/select';
import SrCheckbox from '@/components/SrCheckbox.vue';
import Checkbox from 'primevue/checkbox';
import { onMounted } from 'vue';
import { useSlideruleDefaults } from '@/stores/defaultsStore';
import SrLabelInfoIconButton from '@/components/SrLabelInfoIconButton.vue';

const defaultsStore = useSlideruleDefaults();
const reqParamsStore = useReqParamsStore();
let defaultPhoreal = {};
onMounted(() => {
    defaultPhoreal = defaultsStore.getNestedMissionDefault('ICESat-2', 'phoreal') ?? {};
    reqParamsStore.phoRealGeoLocation = defaultPhoreal['geoLocation'] ?? 'mean';
    reqParamsStore.phoRealBinSize = defaultPhoreal['binSize'] ?? 1;
    console.log('Phoreal defaults:', defaultPhoreal);
});

</script>
<template>
    <div class="phoreal-settings">
        <div class="sr-phoreal-top-header">
            <SrLabelInfoIconButton
                label="PhoREAL Veg Density Parameters"
                labelFontSize='larger'
                tooltipText='PhoREAL Veg Density Parameters:provides vegetation statistics over custom-length ATL03 photon segments'
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/dataframe.html#id1"
            />
        </div>
        <div>
            <SrLabelInfoIconButton
                label="Use"
                >
            </SrLabelInfoIconButton>
            <div class="sr-parm-row">
                <Checkbox
                    binary
                    v-model="reqParamsStore.usePhoRealBinSize"
                    size="small"
                />
                <SrSwitchedSliderInput
                    label="Bin Size"
                    v-model="reqParamsStore.phoRealBinSize"
                    :min="0"
                    :max="200"
                    :decimalPlaces="0"
                    size="small"
                    :sliderWidth="'12rem'"
                    :insensitive="!reqParamsStore.usePhoRealBinSize"
                    :default="defaultPhoreal['binSize'] ?? 1"
                />
            </div>
            <div class="sr-parm-row">
                    <Checkbox
                        binary
                        v-model="reqParamsStore.usePhoRealGeoLocation"
                        size="small"
                    />
                <label class="form-label">Geo Location</label>
                <Select
                    v-model="reqParamsStore.phoRealGeoLocation"
                    :options="geoLocationOptions"
                    aria-label="Select Geo Location"
                    class="select"
                    size="small"
                />
            </div>
            <div class="checkbox-group">
                <SrCheckbox
                    label="Use Absolute Heights"
                    v-model="reqParamsStore.usePhoRealAbsoluteHeights"
                />
                <!-- TODO: re-enable when Send Waveforms is available in analysis -->
                <SrCheckbox
                    label="Send Waveforms"
                    v-model="reqParamsStore.usePhoRealSendWaveforms"
                    :insensitive="true" 
                    :toolTipText="'Send Waveforms is not currently supported in analysis'"
                />
                <!-- TODO: re-enable when ABoVE classifier is available in analysis -->
                <SrCheckbox
                    label="Use ABoVE Classifier"
                    v-model="reqParamsStore.usePhoRealABoVEClassifier"
                    :toolTipText="'ABoVE Classifier is not currently supported in analysis'"
                />
            </div>
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
.sr-phoreal-top-header{
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin-bottom: 1.5rem;
}

.sr-parm-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin: 0.125rem;
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
