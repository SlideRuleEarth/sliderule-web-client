<template>
    <div class="sr-filter-modes">
      <div v-for="filterMode in globalChartStore.filterModeOptions" :key="filterMode.key" class="sr-filter-mode-item">
        <RadioButton
          v-model="globalChartStore.filterMode"
          :inputId="filterMode.key"
          name="dynamic"
          :value="filterMode.key"
          size="small"
        />
        <label :for="filterMode.key">{{ filterMode.name }}</label>
      </div>
    </div>
  </template>
  
  
<script setup lang="ts">
    import { onMounted,watch } from 'vue';
    import RadioButton from 'primevue/radiobutton';
    import { useGlobalChartStore } from '@/stores/globalChartStore';
    //import { clicked } from '@/utils/SrMapUtils';


    const globalChartStore = useGlobalChartStore();

    onMounted(() => {
        console.log('SrFilterMode component mounted');
        globalChartStore.setFilterMode('SpotMode');
    });

    // const updateFilterForMode = async () => {
    //     console.log('updateFilterForMode called');
    //     switch (globalChartStore.filterMode) {
    //         case 'SpotMode':
    //             console.log('Applying Spot Mode filter');
    //             const rec = globalChartStore.getSelectedElevationRec();
    //             const saveCycles = globalChartStore.getCycles();
    //             if (rec) {
    //                 await clicked(rec);
    //             }
    //             globalChartStore.setCycles(saveCycles);
    //             break;
    //             // case FilterMode.TrackMode:
    //             //   console.log('Applying Track Mode filter');
    //             //   break;
    //         case 'RgtMode':
    //             console.log('Applying RGT Mode filter');
    //             globalChartStore.setSpots([1,2,3,4,5,6]);
    //             globalChartStore.hasScForward = true;
    //             globalChartStore.hasScBackward = true;
    //             globalChartStore.setSelectedCycleOptions(globalChartStore.getCycleOptions());
    //             break;
    //             // case FilterMode.AllRgts:
    //             //   console.log('Applying All RGTs filter');
    //             //   break;
    //         default:
    //             console.log('Unknown filter mode');
    //       }
    // };

    // watch(
    //     () => globalChartStore.filterMode,
    //     (newValue) => {
    //         console.log(`SrFilterMode watch Filter mode changed to: ${newValue}`);
    //         updateFilterForMode();
    //   }
    // );

  
</script>
<style scoped>
    .sr-filter-modes {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 1rem; /* Adds spacing between items */
        margin-bottom: 0.5rem;
        font-size: small;
    }
    
    .sr-filter-mode-item {
        display: flex;
        align-items: center;
        gap: 0.5rem; /* Space between the radio button and label */
    }
</style>
  