<template>
    <div class="sr-debug-panel">
        <div class="sr-debug-panel-content">
            <div class="sr-debug-cnts"> 
                <SrProgressCnts />
            </div>
            <div class="sr-select-parquet-reader">
                <SrSelectParquetReader />
            </div>
            <!-- <div class="sr-opfs">
                <SrOpfs />
            </div> -->
            
            <div>
              <SrSvrConsoleTerminal />
            </div>
        </div>
    </div>
  </template>
  
  <script setup lang="ts">
    import SrProgressCnts from './SrProgressCnts.vue';
    import SrSelectParquetReader from './SrSelectParquetReader.vue';
    //import SrOpfs from './SrOpfs.vue';
    import SrSvrConsoleTerminal from './SrSvrConsoleTerminal.vue';
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
  