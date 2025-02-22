<template>
    <div class="sr-advanced-config">
    <Fieldset legend="Advanced Config" class="sr-advanced-config-content" :toggleable="true" :collapsed="false">
        <SrSliderInput
                v-model="srParquetCfgStore.chunkSizeToRead"
                label="SQL Query Chunk Size"
                :min="10000"
                :max="1000000"
                :defaultValue="srParquetCfgStore.chunkSizeToRead"
                :decimalPlaces=0
                tooltipText="Chunk size to Query from parquet file"
        />
        <SrSliderInput
            v-model="useSrParquetCfgStore().maxNumPntsToDisplay"
            label="Max Num Elevation Pnts"
            :min="10000"
            :max="5000000"
            :defaultValue="100000"
            :decimalPlaces=0
            tooltipText="Maximum number of points to display"
        />
        <SrToggleButton 
            :value="reqParamsStore.useChecksum"
            :getValue="reqParamsStore.getUseChecksum"
            :setValue="reqParamsStore.setUseChecksum" 
            label="Use Checksum"
            tooltipUrl='https://slideruleearth.io/web/rtd/user_guide/ICESat-2.html#parameters'
            tooltipText='Use Checksum to verify the integrity of the data'
        />            
        <SrToggleButton 
            :value="debugStore.enableSpotPatternDetails"
            :getValue="debugStore.getEnableSpotPatternDetails" 
            :setValue="debugStore.setEnableSpotPatternDetails" 
            label="Enable Spot Pattern Details" 
        />
        <SrGraticuleSelect/>
        <SrSliderInput
            v-model="deckStore.pointSize"
            label="Elevation Plot point size"
            :min="1"
            :max="20"
            :defaultValue="deckStore.pointSize"
            :decimalPlaces=0
            tooltipText="Point size for Elevation Plot"
        />
        <SrMenuInput 
                label="Num of Shades for Elevation Plot" 
                :menuOptions="colorMapStore.getNumOfElevationShadesOptions()" 
                v-model="selectedNumOfElevationShades"
                tooltipText="Number of shades for elevation plot"
        />
        <FloatLabel variant="in">
            <label for="ThresholdForHelpfulAdvice">Threshold for Helpful Advice</label>
            <InputNumber
                v-model="requestsStore.helpfulReqAdviceCnt" 
                inputId="ThresholdForHelpfulAdvice"
            >
            </InputNumber>
        </FloatLabel>   
        <SrCheckbox
            v-model="debugStore.useMetersForMousePosition"
            label="Use Meters for mouse position"
        ></SrCheckbox>
    </Fieldset>
    </div>
</template>
<script setup lang="ts">
    import Fieldset  from 'primevue/fieldset';
    import SrToggleButton from './SrToggleButton.vue';
    import SrSliderInput from './SrSliderInput.vue';
    import SrGraticuleSelect from './SrGraticuleSelect.vue';
    import SrMenuInput from './SrMenuInput.vue';
    import { useReqParamsStore } from '@/stores/reqParamsStore';
    import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
    import { useDebugStore } from '@/stores/debugStore';
    import { useDeckStore } from '@/stores/deckStore';
    import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
    import { useRequestsStore } from '@/stores/requestsStore';
    import { ref } from 'vue';
    import SrCheckbox from './SrCheckbox.vue';
    import InputNumber from 'primevue/inputnumber';


    const debugStore = useDebugStore();
    const srParquetCfgStore = useSrParquetCfgStore();
    const reqParamsStore = useReqParamsStore();
    const deckStore = useDeckStore();
    const colorMapStore = useElevationColorMapStore();
    const requestsStore = useRequestsStore();
    const selectedNumOfElevationShades = ref(1024);

</script>
<style scoped>

.sr-advanced-config {
    display: flex;
    flex-direction: column;
    margin:0.125rem;
    max-width: 25rem;
}

.sr-advanced-config-content {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    font-size: smaller;
    padding: 0.25rem;
}

</style>