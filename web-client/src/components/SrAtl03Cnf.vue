<script setup lang="ts">
import SrMultiSelectText from '@/components/SrMultiSelectText.vue';
import SrCheckbox from '@/components/SrCheckbox.vue';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import SrSurfaceRefType from '@/components/SrSurfaceRefType.vue';
import { signalConfidenceTextOptions, qualityPHTextOptions } from '@/types/SrStaticOptions'
import { useSlideruleDefaults } from '@/stores/defaultsStore';

const reqParamsStore = useReqParamsStore();

const defaultSignalConfidence = useSlideruleDefaults().getNestedMissionDefault<number[]>(reqParamsStore.missionValue, 'cnf');
const defaultQualityPH = useSlideruleDefaults().getNestedMissionDefault<number[]>(reqParamsStore.missionValue, 'quality_ph');

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
                :defaultValue="reqParamsStore.enableAtl03Classification"
            />
        </div>
        <div class="sr-atl03-cnf-body">
            <SrSurfaceRefType
                :insensitive="!reqParamsStore.enableAtl03Classification"
            />
            <SrMultiSelectText
                :insensitive="!reqParamsStore.enableAtl03Classification"
                label="Signal Confidence"
                ariaLabel="Signal Confidence"
                :menuOptions="signalConfidenceTextOptions"
                :defaultValue="defaultSignalConfidence"
                @update:value="reqParamsStore.signalConfidenceText = $event"
            />            
            <SrMultiSelectText
                :insensitive="!reqParamsStore.enableAtl03Classification"
                label="Quality PH"
                placeholder="Select Quality PH"
                ariaLabel="Quality PH"
                :menuOptions="qualityPHTextOptions"
                :defaultValue="defaultQualityPH"
                @update:value="reqParamsStore.qualityPHText = $event"
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