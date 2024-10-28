<template>
    <div class="sr-advanced-config">
    <Fieldset legend="Advanced Config" class="sr-advanced-config-content" :toggleable="true" :collapsed="false">
        <SrSelectParquetReader />
        <SrSliderInput
                v-model="srParquetCfgStore.chunkSizeToRead"
                label="SQL Query Chunk Size"
                :min="10000"
                :max="1000000"
                :defaultValue="srParquetCfgStore.chunkSizeToRead"
                :decimalPlaces=0
                tooltipText="Chunk size to Query from parquet file"
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
            v-model="atlChartFilterStore.atl03spSymbolSize"
            label="Atl03sp Scatter Plot symbol size"
            :min="1"
            :max="20"
            :defaultValue="atlChartFilterStore.atl03spSymbolSize"
            :decimalPlaces=0
            tooltipText="Symbol size for Atl03 Scatter Plot"
        />
        <SrSliderInput
            v-model="atlChartFilterStore.atl03vpSymbolSize"
            label="Atl03vp Scatter Plot symbol size"
            :min="1"
            :max="20"
            :defaultValue="atlChartFilterStore.atl03vpSymbolSize"
            :decimalPlaces=0
            tooltipText="Symbol size for Atl03 Scatter Plot"
        />
        <SrSliderInput
            v-model="atlChartFilterStore.atl06SymbolSize"
            label="Atl06 Scatter Plot symbol size"
            :min="1"
            :max="20"
            :defaultValue="atlChartFilterStore.atl06SymbolSize"
            :decimalPlaces=0
            tooltipText="Symbol size for Atl06 Scatter Plot"
        />
        <SrSliderInput
            v-model="atlChartFilterStore.atl08SymbolSize"
            label="Atl08 Scatter Plot symbol size"
            :min="1"
            :max="20"
            :defaultValue="atlChartFilterStore.atl08SymbolSize"
            :decimalPlaces=0
            tooltipText="Symbol size for Atl08 Scatter Plot"
        />
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
        <SrSliderInput
            v-model="requestsStore.helpfulReqAdviceCnt"
            label="Give Helpful Advice when # Requests < this"
            :min="1"
            :max="30"
            :decimalPlaces=0
            tooltipText="Symbol size for Atl06 Scatter Plot"
        />
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
    import SrSelectParquetReader from './SrSelectParquetReader.vue';
    import { useReqParamsStore } from '@/stores/reqParamsStore';
    import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
    import { useDebugStore } from '@/stores/debugStore';
    import { useDeckStore } from '@/stores/deckStore';
    import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
    import { useElevationColorMapStore } from '@/stores/elevationColorMapStore';
    import { useRequestsStore } from '@/stores/requestsStore';
    import { ref } from 'vue';
import SrCheckbox from './SrCheckbox.vue';


    const debugStore = useDebugStore();
    const srParquetCfgStore = useSrParquetCfgStore();
    const reqParamsStore = useReqParamsStore();
    const atlChartFilterStore = useAtlChartFilterStore();
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