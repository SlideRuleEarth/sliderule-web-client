<template>
  <div class="sr-raster-params-table-card">
    <DataTable :value="rasterParamsStore.dataTable" :tableStyle="{ 'max-width': '20%', margin: '3px auto' }">
      <Column v-for="col in RasterParamsCols" :key="col.field" :field="col.field" :header="col.header"></Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
  import { onMounted } from 'vue';
  import { useRasterParamsStore,  RasterParamsCols, type RasterParams } from '@/stores/rasterParamsStore';
  import DataTable from 'primevue/datatable';
  import Column from 'primevue/column';

  const rasterParamsStore = useRasterParamsStore();

  onMounted(() => {
    // Define a new raster parameter object
    const newRasterParam: RasterParams = {
      key: 'new_key_example',
      asset: 'new_asset_example',
      algorithm: 'new_algorithm_example',
      radius: 0,
      zonalStats: 'new_zonalStats_example',
      withFlag: false,
      t0: new Date,
      t1: new Date,
      substring: 'new_substring_example',
      closestTime: false,
      catalog: 'new_catalog_example',
      bands:   ['B1','B2','B3'],
    };
    // Add the new raster parameter to the store
    rasterParamsStore.addRasterParams(newRasterParam);
  });
</script>
<style scoped>

</style>