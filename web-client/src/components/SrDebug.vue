<template>
    <div class="sr-debug-panel">
      <Fieldset legend="Debug Panel" class="sr-debug-panel-content" :toggleable="true" :collapsed="true" >
            <div class="sr-debug-cnts"> 
              <SrProgressCnts />
            </div>
            <div class="sr-svr-console">
              <SrSvrConsoleTerminal />
            </div>
      </Fieldset> 
    </div>
  </template>
  
  <script setup lang="ts">
    import SrProgressCnts from './SrProgressCnts.vue';
    import SrSvrConsoleTerminal from './SrSvrConsoleTerminal.vue';
    import Fieldset from 'primevue/fieldset';

  </script>
  
<style scoped>
  /* Style your button and component here */
  .sr-debug-panel {
    display: flex;
    flex-direction: column;
    margin:0.125rem;
  }

  .sr-debug-panel-content {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    font-size: smaller;
    padding: 0.25rem;
  }
  .sr-svr-console {
    display: flex;
    justify-content: center;
    margin-top: 0.5rem;
    width: 100%;
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
  