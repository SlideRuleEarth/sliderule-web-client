<template>
  <div class="sr-raster-params-table-card">
    <DataTable :value="rasterParamsStore.dataTable" scrollable :tableStyle="{ 'max-width': '20%', margin: '3px auto' }">
      <Column header="Remove">
        <template #body="slotProps">
          <Button icon="pi pi-trash" severity="danger" text @click="removeRow(slotProps.index)" />
        </template>
      </Column>
      <Column v-for="col in RasterParamsCols" :key="col.field" :field="col.field" :header="col.header"></Column>
    </DataTable>
  </div>
</template>


<script setup lang="ts">
  import { onMounted } from 'vue';
  import { useRasterParamsStore,  RasterParamsCols } from '@/stores/rasterParamsStore';
  import DataTable from 'primevue/datatable';
  import Column from 'primevue/column';
  import Button from 'primevue/button';


  const rasterParamsStore = useRasterParamsStore();

  const removeRow = (idx: number) => {
    rasterParamsStore.removeRasterParams(idx);
  };
  onMounted(() => {
  });
</script>
<style scoped>
.sr-raster-params-table-card {
  width: 100%;
  max-width: 20rem;
  margin: auto;
  overflow-x: visible;
}
</style>