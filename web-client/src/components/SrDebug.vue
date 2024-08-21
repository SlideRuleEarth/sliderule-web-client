<template>
    <div class="sr-debug-panel">
        <div class="sr-debug-panel-content">
            <div class="sr-debug-cnts"> 
                <SrProgressCnts />
            </div>
            <div class="sr-select-parquet-reader">
              <SrSelectParquetReader />
            </div>
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
            <div>
              <SrSvrConsoleTerminal />
              <SrToggleButton 
                :value="debugStore.enableSpotPatternDetails"
                :getValue="debugStore.getEnableSpotPatternDetails" 
                :setValue="debugStore.setEnableSpotPatternDetails" 
                label="Enable Spot Pattern Details" 
              />
              <SrGraticuleSelect/>
              <SrSliderInput
                v-model="atlChartFilterStore.atl03SymbolSize"
                label="Atl03 Scatter Plot symbol size"
                :min="1"
                :max="20"
                :defaultValue="atlChartFilterStore.atl03SymbolSize"
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
            </div>
        </div>
    </div>
  </template>
  
  <script setup lang="ts">
    import { useReqParamsStore } from '@/stores/reqParamsStore';
    import SrProgressCnts from './SrProgressCnts.vue';
    import SrSelectParquetReader from './SrSelectParquetReader.vue';
    import SrSvrConsoleTerminal from './SrSvrConsoleTerminal.vue';
    import SrToggleButton from './SrToggleButton.vue';
    import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
    import SrSliderInput from './SrSliderInput.vue';
    import { useDebugStore } from '@/stores/debugStore';
    import SrGraticuleSelect from './SrGraticuleSelect.vue';
    import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
    
    const debugStore = useDebugStore();
    const srParquetCfgStore = useSrParquetCfgStore();
    const reqParamsStore = useReqParamsStore();
    const atlChartFilterStore = useAtlChartFilterStore();
    // const handleUseChecksum = async (newValue: boolean) => {
    //   reqParamsStore.useChecksum = newValue;
    //   console.log('reqParamsStore.useChecksum :', reqParamsStore.useChecksum );
    // };

</script>
  
  <style>
  /* Style your button and component here */
  .sr-debug-panel {
    display: flex;
    flex-direction: column;
    padding: 0.0125rem;
    margin-top: 0.1rem;
  }
  .sr-debug-panel-header {
    display: flex;
    margin-top: 0;
    font-size: medium;
    font-weight: bold;
    justify-content: center;
  }
  .sr-debug-panel-content {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    font-size: smaller;
    padding: 0.25rem;
  }
    .sr-debug-cnts {
        display: flex;
        justify-content: center;
        margin-top: 0.5rem;
    }
    .sr-select-parquet-reader {
        display: flex;
        justify-content: center;
        margin-top: 0.5rem;
    }
  </style>
  