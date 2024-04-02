<script setup lang="ts">
import SrSliderInput from './SrSliderInput.vue';
import SrMultiSelect from './SrMultiSelect.vue';
import SrCheckbox from './SrCheckbox.vue';
import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
import { useReqParamsStore } from '../stores/reqParamsStore';
const reqParamsStore = useReqParamsStore();
const props = defineProps({
    label: String,
    insensitive: {
            type: Boolean,
            default: false
        },
    });
</script>

<template>
    <div class = "sr-atl03-cnf-container">
        <div class="sr-atl03-cnf-header">
            <SrLabelInfoIconButton v-if="label != ''" label="Atl03 Classification" tooltipText="A set of photon classification values that are designed to identify signal photons for different surface types with specified confidence" tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#native-atl03-photon-classification" :insensitive="insensitive" labelFontSize="large"/>
            <SrCheckbox
                label=""
                v-model="reqParamsStore.enableAtl03Confidence"
            />
        </div>
        <div class="sr-atl03-cnf-body">
            <SrMultiSelect
                :insensitive="!reqParamsStore.enableAtl03Confidence"
                label="Surface Reference Type"
                ariaLabel="Select Reference Surface Type"
                :menuOptions="reqParamsStore.surfaceReferenceTypeOptions"
                @update:value="reqParamsStore.surfaceReferenceType = $event"
                :default="[
                    reqParamsStore.surfaceReferenceTypeOptions[3],
                ]"
                tooltipText="The surface type used in the ATL03 photon classification"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#native-atl03-photon-classification"
            />
            <SrMultiSelect
                :insensitive="!reqParamsStore.enableAtl03Confidence"
                label="Signal Confidence"
                ariaLabel="Signal Confidence"
                :menuOptions="reqParamsStore.signalConfidenceOptions"
                :default="[
                    reqParamsStore.signalConfidenceOptions[2],
                    reqParamsStore.signalConfidenceOptions[3],
                    reqParamsStore.signalConfidenceOptions[4],
                    reqParamsStore.signalConfidenceOptions[5],
                    reqParamsStore.signalConfidenceOptions[6]
                    ]"
                @update:value="reqParamsStore.signalConfidence = $event"
                tooltipText="Confidence level for photon selection, can be supplied as a single value (which means the confidence must be at least that), or a list (which means the confidence must be in the list)"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#native-atl03-photon-classification"
            />
            <SrSliderInput
                v-model="reqParamsStore.qualityPHValue"
                label="Quailty PH"
                :min="0"
                :max="1000"
                :decimalPlaces="2"
                :insensitive="!reqParamsStore.enableAtl03Confidence"
                tooltipText="quality classification based on an ATL03 algorithms that attempt to identify instrumental artifacts, can be supplied as a single value (which means the classification must be exactly that), or a list (which means the classification must be in the list))"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#native-atl03-photon-classification"
            />
        </div>
    </div>
</template>
<style scoped>


.sr-atl03-cnf-container {
    margin-bottom: 1rem;
    padding: 0.25rem;
    border: 1px solid grey;
    border-radius: var(--border-radius);
}
.sr-atl03-cnf-header {
  display: flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
  margin-bottom: 1rem;
}

:deep(.sr-label-info-icon-button-label) {
    font-size: large;
}
</style>