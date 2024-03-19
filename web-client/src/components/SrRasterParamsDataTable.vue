<template>
    <div class="card">
      <DataTable :value="rasterParamsStore.value" :tableStyle="{ minWidth: '50rem' }">
        <Column v-for="col in RasterParamsCols" :key="col.field" :field="col.field" :header="col.header"></Column>
      </DataTable>
    </div>
  </template>
  
  <script setup lang="ts">
    import { onMounted } from 'vue';
    import { useRasterParamsStore,  RasterParamsCols, RasterParams } from '@/stores/rasterParamsStore';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
  
    const rasterParamsStore = useRasterParamsStore();

    onMounted(() => {
      // Define a new raster parameter object
      const newRasterParam: RasterParams = {
        key: 'new_key_example',
        t0: 'new_t0_example',
        t1: 'new_t1_example'
      };

      // Add the new raster parameter to the store
      rasterParamsStore.addRasterParams(newRasterParam);
    });
  </script>
  