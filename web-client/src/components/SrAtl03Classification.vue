<script setup lang="ts">
import SrCheckbox from '@/components/SrCheckbox.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrSurfaceRefType from '@/components/SrSurfaceRefType.vue';
import { MultiSelect } from 'primevue';
import SrLabelInfoIconButton from '@/components/SrLabelInfoIconButton.vue';
import { signalConfidenceNumberOptions, qualityPHOptions } from '@/types/SrStaticOptions'
const reqParamsStore = useReqParamsStore();


</script>

<template>
    <div class = "sr-atl03-cnf-container">
        <div class="sr-atl03-cnf-header">
            <SrCheckbox
                label="Atl03 Classification"
                labelFontSize="large"
                tooltipText="A set of photon classification values that are designed to identify signal photons for different surface types with specified confidence" 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/icesat2.html#native-atl03-photon-classification"
                v-model="reqParamsStore.enableAtl03Classification"
            />
        </div>
        <div class="sr-atl03-cnf-body">
            <SrSurfaceRefType
                :insensitive="!reqParamsStore.enableAtl03Classification"
            />
            <div class="sr-menu-label-wrapper">
                <SrLabelInfoIconButton label="Signal Confidence" tooltipText="Confidence level for photon selection" />
                <MultiSelect class="sr-multi-selector"
                    v-model="reqParamsStore.signalConfidence"
                    placeholder="Select ..."
                    optionLabel="name"
                    optionsValue="value"
                    :insensitive="!reqParamsStore.enableAtl03Classification"
                    ariaLabel="Signal Confidence"
                    :options="signalConfidenceNumberOptions"
                    :maxSelectedLabels="1"
                    size="small"
                    :disabled="!reqParamsStore.enableAtl03Classification"
                />
            </div>
            <div class="sr-menu-label-wrapper">
                <SrLabelInfoIconButton label="Quality PH" tooltipText="Quality classification" />
                <MultiSelect class="sr-multi-selector"
                    v-model="reqParamsStore.qualityPH"
                    placeholder="Select ..."
                    optionLabel="name"
                    optionsValue="value"
                    :insensitive="!reqParamsStore.enableAtl03Classification"
                    label="Quality PH"
                    ariaLabel="Quality PH"
                    :options="qualityPHOptions"
                    :maxSelectedLabels="1"
                    size="small"
                    :disabled="!reqParamsStore.enableAtl03Classification"
                />
            </div>
        </div>
    </div>
</template>
<style scoped>


.sr-atl03-cnf-container {
    padding: 0.75rem;
    border: 1px solid grey;
    border-radius: var(--p-border-radius);
}
.sr-atl03-cnf-header {
  display: flex;
  justify-content: center; 
  align-items: center;
  background-color: transparent;
  margin-bottom: 1rem;
}
.sr-multi-selector {
    width: 75%;
    padding: 0.125rem;
    margin: 0.25rem;
    background-color: transparent;
}
.p-multiselect-item {
    font-size: small;
}

:deep(.sr-label-info-icon-button-label) {
    font-size: large;
}
.sr-menu-label-wrapper {
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: center;
    width: 100%;
    padding: 3px;
}

:deep(.p-multiselect-panel .p-multiselect-items .p-multiselect-item .p-checkbox) {
    width: 0.25rem;
    height: 0.25rem;
}

:deep(.p-multiselect .p-multiselect-trigger) {
    width: 0.75rem;
    height: 0.75rem;
    align-self: center;
}

:deep(.p-multiselect .p-multiselect-trigger .p-icon) {
    width: 0.65rem;
    height: 0.65rem;
}

:deep(.p-multiselect .p-multiselect-label) {
    display: flex;
    flex-direction: column;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    padding-left: 0.25rem;
    font-size: small;
}
</style>