<script setup lang="ts">
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { geoLocationOptions } from '@/types/SrStaticOptions';
import SrSwitchedSliderInput from '@/components/SrSliderInput.vue';
import Select from 'primevue/select';
import SrCheckbox from '@/components/SrCheckbox.vue';
import Checkbox from 'primevue/checkbox';
import { onMounted, computed } from 'vue';
import { useSlideruleDefaults } from '@/stores/defaultsStore';
import SrLabelInfoIconButton from '@/components/SrLabelInfoIconButton.vue';
import { type SrPhoreal } from '@/types/slideruleDefaultsInterfaces';
import { createLogger } from '@/utils/logger';

const logger = createLogger('SrVegDensity');

const defaultsStore = useSlideruleDefaults();
const reqParamsStore = useReqParamsStore();
let defaultPhoreal = {} as SrPhoreal;
const geoLocationLabelClass = computed(() => {
    return reqParamsStore.getEnablePhoReal()
        ? "form-label"
        : "form-label form-label--disabled";
});
onMounted(() => {
    defaultPhoreal = defaultsStore.getNestedMissionDefault('ICESat-2', 'phoreal') as SrPhoreal;
    logger.debug('Default PhoReal', { defaultPhoreal });
    reqParamsStore.phoRealGeoLocation = defaultPhoreal['geoloc'];
    reqParamsStore.phoRealBinSize = defaultPhoreal['binsize'];
    reqParamsStore.usePhoRealAbsoluteHeights = defaultPhoreal['use_abs_h'];
    reqParamsStore.usePhoRealSendWaveforms = defaultPhoreal['send_waveform'];
});

</script>
<template>
    <div>
        <div class="sr-phoreal-top-header">
            <SrCheckbox
                v-model="reqParamsStore.enablePhoReal"
                label="PhoREAL Veg Density"
                labelFontSize='large'
                tooltipText='PhoREAL Veg Density Parameters:provides vegetation statistics over custom-length ATL03 photon segments'
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/xseries.html#id1"
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
                    :disabled="!reqParamsStore.getEnablePhoReal()"
                />
                <SrSwitchedSliderInput
                    label="Bin Size"
                    v-model="reqParamsStore.phoRealBinSize"
                    :min="0"
                    :max="200"
                    :decimalPlaces="0"
                    size="small"
                    :sliderWidth="'12rem'"
                    :default="defaultPhoreal['binsize'] ?? 1"
                    :insensitive="!reqParamsStore.getEnablePhoReal()"
                />
            </div>
            <div class="sr-parm-row">
                <Checkbox
                    binary
                    v-model="reqParamsStore.usePhoRealGeoLocation"
                    size="small"
                    :disabled="!reqParamsStore.getEnablePhoReal()"
                />
                <label :class="geoLocationLabelClass">
                    Geo Location
                </label>
                <Select
                    v-model="reqParamsStore.phoRealGeoLocation"
                    :options="geoLocationOptions"
                    aria-label="Select Geo Location"
                    class="select"
                    size="small"
                    :default="defaultPhoreal['geoloc']"
                    :disabled="!reqParamsStore.getEnablePhoReal()"
                />
            </div>
            <div class="checkbox-group">
                <SrCheckbox
                    label="Use Absolute Heights"
                    v-model="reqParamsStore.usePhoRealAbsoluteHeights"
                    :insensitive="!reqParamsStore.getEnablePhoReal()"
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
                    :toolTipText="'ABoVE Classifier'"
                    :insensitive="!reqParamsStore.getEnablePhoReal()"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>

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
.form-label {
    margin-right: 0.25rem;
    white-space: nowrap;
    font-size: small;
    background-color: transparent;
}

.form-label--disabled {
    margin-right: 0.25rem;
    font-size: small;
    color: #888; /*  grey color */
    white-space: nowrap;
    background-color: transparent;
}
</style>
