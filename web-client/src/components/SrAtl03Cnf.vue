<script setup lang="ts">
import SrMultiSelectNumber from '@/components/SrMultiSelectNumber.vue';
import SrCheckbox from '@/components/SrCheckbox.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrSurfaceRefType from '@/components/SrSurfaceRefType.vue';
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
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/dataframe.html#icesat-2-request-fields"
                v-model="reqParamsStore.enableAtl03Classification"
            />
        </div>
        <div class="sr-atl03-cnf-body">
            <SrSurfaceRefType
                :insensitive="!reqParamsStore.enableAtl03Classification"
            />
            <SrMultiSelectNumber
                :insensitive="!reqParamsStore.enableAtl03Classification"
                label="Signal Confidence"
                ariaLabel="Signal Confidence"
                :menuOptions="signalConfidenceNumberOptions"
                :default="[
                    signalConfidenceNumberOptions[2],
                    signalConfidenceNumberOptions[3],
                    signalConfidenceNumberOptions[4],
                    signalConfidenceNumberOptions[5],
                    signalConfidenceNumberOptions[6],
                ]"
                @update:value="reqParamsStore.signalConfidenceNumber = $event"
            />            
            <SrMultiSelectNumber
                :insensitive="!reqParamsStore.enableAtl03Classification"
                label="Quality PH"
                placeholder="Select Quality PH"
                ariaLabel="Quality PH"
                :menuOptions="qualityPHOptions"
                @update:value="reqParamsStore.qualityPHNumber = $event"
            />  
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

:deep(.sr-label-info-icon-button-label) {
    font-size: large;
}
</style>