<template>
  <div class="sr-raster-params-table-card">
    <DataTable
      :value="rasterParamsStore.dataTable"
      scrollable
      :tableStyle="{ 'max-width': '20%', margin: '3px auto' }"
    >
      <Column header="Remove">
        <template #body="slotProps">
          <Button icon="pi pi-trash" severity="danger" text @click="removeRow(slotProps.index)" />
        </template>
      </Column>
      <Column
        v-for="col in RasterParamsCols"
        :key="col.field"
        :field="col.field"
        :header="col.header"
      >
        <template v-if="col.field === 'catalog'" #body="slotProps">
          {{ catalogSummaries[slotProps.index] }}
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRasterParamsStore, RasterParamsCols } from '@/stores/rasterParamsStore'
import { formatBytes } from '@/utils/SrParquetUtils'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'

const rasterParamsStore = useRasterParamsStore()

// A catalog can be megabytes of GeoJSON, so the table shows what it holds, not the text (#1126)
function catalogSummary(catalog: string): string {
  if (!catalog) return ''
  const size = formatBytes(new Blob([catalog]).size)
  try {
    const features = JSON.parse(catalog)?.features
    if (Array.isArray(features)) {
      const count = features.length.toLocaleString()
      return `${count} ${features.length === 1 ? 'feature' : 'features'}, ${size}`
    }
  } catch {
    // not JSON; the size still says how much is there
  }
  return size
}

// Parsed once per change to the table, not on every render
const catalogSummaries = computed(() =>
  rasterParamsStore.dataTable.map((row) => catalogSummary(row.catalog))
)

const removeRow = (idx: number) => {
  rasterParamsStore.removeRasterParams(idx)
}
onMounted(() => {})
</script>
<style scoped>
.sr-raster-params-table-card {
  width: 100%;
  max-width: 20rem;
  margin: auto;
  overflow-x: visible;
}
</style>
