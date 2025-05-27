<script setup lang="ts">
import SrMultiSelectNumber from '@/components/SrMultiSelectNumber.vue';
import SrCheckbox from '@/components/SrCheckbox.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrSurfaceRefType from '@/components/SrSurfaceRefType.vue';
const reqParamsStore = useReqParamsStore();

</script>

<template>
    <div class = "sr-atl03-cnf-container">
        <div class="sr-atl03-cnf-header">
            <SrCheckbox
                label="Atl03 Classification"
                labelFontSize="large"
                tooltipText="A set of photon classification values that are designed to identify signal photons for different surface types with specified confidence" 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/dataframe.html#icesat-2-request-fields"
                v-model="reqParamsStore.enableAtl03Confidence"
            />
        </div>
        <div class="sr-atl03-cnf-body">
            <SrSurfaceRefType
                :insensitive="!reqParamsStore.enableAtl03Confidence"
            />
            <SrMultiSelectNumber
                :insensitive="!reqParamsStore.enableAtl03Confidence"
                label="Signal Confidence"
                ariaLabel="Signal Confidence"
                :menuOptions="reqParamsStore.signalConfidenceNumberOptions"
                :default="[
                    reqParamsStore.signalConfidenceNumberOptions[2],
                    reqParamsStore.signalConfidenceNumberOptions[3],
                    reqParamsStore.signalConfidenceNumberOptions[4],
                    reqParamsStore.signalConfidenceNumberOptions[5],
                    reqParamsStore.signalConfidenceNumberOptions[6],
                    ]"
                @update:value="reqParamsStore.signalConfidenceNumber = $event"
                tooltipText="cnf: Confidence level for photon selection"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/dataframe.html#icesat-2-request-fields"
            />            
            <SrMultiSelectNumber
                :insensitive="!reqParamsStore.enableAtl03Confidence"
                label="Quality PH"
                placeholder="Select Quality PH"
                ariaLabel="Quality PH"
                :menuOptions="reqParamsStore.qualityPHOptions"
                :default="reqParamsStore.qualityPHNumber"
                @update:value="reqParamsStore.qualityPHNumber = $event"
                tooltipText="quality_ph: quality classification based on an ATL03 algorithms that attempt to identify instrumental artifacts"
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/dataframe.html#icesat-2-request-fields"
            />  
        </div>
    </div>
</template>
<style scoped>


.sr-atl03-cnf-container {
    margin-bottom: 1rem;
    padding: 0.25rem;
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

:deep(.sr-label-info-icon-button-label) {
    font-size: large;
}
</style>