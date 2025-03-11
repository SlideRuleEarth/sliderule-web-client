<template>
    <div class="sr-advanced-config">
    <Fieldset 
        legend="Advanced Config" 
        class="sr-advanced-config-content" 
        :toggleable="true" 
        :collapsed="false"
    >
        <label for="chunkSizeToRead">SQL Query Chunk Size</label>
        <InputNumber
                v-model="srParquetCfgStore.chunkSizeToRead"
                inputId="chunkSizeToRead"
                label="SQL Query Chunk Size"
                size="small"
                :step="1000"
                :min="1000"
                :max="100000"
                :defaultValue="10000"
                showButtons
                :decimalPlaces=0
        />
        <br>
        <label for="maxNumPntsToDisplay">Max Num El Pnts to Display</label>
        <InputNumber
            v-model="srParquetCfgStore.maxNumPntsToDisplay"
            inputId="maxNumPntsToDisplay"
            class="sr-max-num-pnts-to-display"
            size="small"
            :min="10000"
            :max="5000000"
            :step="10000"
            showButtons
            :defaultValue="50000"
            :decimalPlaces=0
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
        <label for ="pointSize">Elevation map Plot point size</label>
        <InputNumber
            v-model="deckStore.pointSize"
            inputId="pointSize"
            size="small"
            :step="1"
            :min="1"
            :max="20"
            showButtons
            :defaultValue="deckStore.pointSize"
            :decimalPlaces=0
        />
        <br>
        <!-- <SrMenuNumberInput 
                label="Num of Shades for Elevation Plot" 
                :menuOptions="colorMapStore.getNumOfElevationShadesOptions()" 
                v-model="selectedNumOfElevationShadesOption"
                tooltipText="Number of shades for elevation plot"
        /> -->
        <label for="ThresholdForHelpfulAdvice">Threshold for Helpful Advice</label>
        <InputNumber
            v-model="requestsStore.helpfulReqAdviceCnt" 
            inputId="ThresholdForHelpfulAdvice"
            size="small"
            :step="1"
            :min="1"
            :max="1000"
            showButtons
            :defaultValue="4"
            :decimalPlaces=0
        />
        <br>
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
    import SrGraticuleSelect from './SrGraticuleSelect.vue';
    import { useReqParamsStore } from '@/stores/reqParamsStore';
    import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
    import { useDebugStore } from '@/stores/debugStore';
    import { useDeckStore } from '@/stores/deckStore';
    import { useRequestsStore } from '@/stores/requestsStore';
    import SrCheckbox from './SrCheckbox.vue';
    import InputNumber from 'primevue/inputnumber';


    const debugStore = useDebugStore();
    const srParquetCfgStore = useSrParquetCfgStore();
    const reqParamsStore = useReqParamsStore();
    const deckStore = useDeckStore();
    const requestsStore = useRequestsStore();

</script>
<style scoped>

.sr-advanced-config {
    display: flex;
    flex-direction: column;
    justify-content:space-evenly;
    align-items:flex-start;
    font-size: smaller;
    padding: 0rem;
    margin:0.125rem;
    max-width: 25rem;
}

.sr-advanced-config-content {
    display: flex;
    flex-direction: column;
    justify-content:space-evenly;
    align-items:flex-start;
    font-size: smaller;
    padding: 0.25rem;
}

:deep(.sr-toggle-row){
    display: flex;
    flex-direction: row;
    justify-content:flex-start;
    align-items: center;
    padding: 0.25rem;
}

:deep(.sr-graticule-panel){
    display: flex;
    flex-direction: row;
    justify-content:flex-start;
    align-items: center;
    padding: 0rem;
    margin:0rem;
}
</style>