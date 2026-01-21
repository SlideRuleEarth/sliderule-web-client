<template>
  <div class="sr-export-panel">
    <SrCustomTooltip ref="tooltipRef" id="exportSelTooltip" />
    <Select
      v-model="selectedFormat"
      :options="formatOptions"
      optionLabel="label"
      optionValue="value"
      class="sr-format-select"
      :disabled="!props.resultFile && selectedFormat === 'geoparquet'"
    />
    <Button
      icon="pi pi-file-export"
      :label="exportLabel"
      class="sr-export-btn sr-glow-button"
      :id="id"
      @click="exportButtonClick"
      @mouseover="tooltipRef.showTooltip($event, tooltipText)"
      @mouseleave="tooltipRef.hideTooltip()"
      variant="text"
      rounded
    >
    </Button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { createDuckDbClient, DuckDBClient } from '@/utils/SrDuckDb'
import { streamSqlQueryToCSV } from '@/utils/SrDbShellUtils'
import { useChartStore } from '@/stores/chartStore'
import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrExportSelected')

const props = withDefaults(
  defineProps<{
    reqId: number
    customSql?: string
    resultFile?: string
    resultFolder?: string
  }>(),
  {
    reqId: 0,
    resultFolder: 'SqlQueries'
  }
)

const chartStore = useChartStore()
const tooltipRef = ref()

const selectedFormat = ref<'csv' | 'geoparquet'>('geoparquet')
const formatOptions = [
  { label: 'GeoParquet', value: 'geoparquet' },
  { label: 'CSV', value: 'csv' }
]

const exportLabel = computed(() => {
  return `Export ${selectedFormat.value === 'geoparquet' ? 'GeoParquet' : 'CSV'}`
})

const tooltipText = computed(() => {
  if (selectedFormat.value === 'geoparquet' && props.resultFile) {
    return 'Download the GeoParquet file'
  }
  return 'Export the selected track data to a CSV file'
})

let duckDbClient: DuckDBClient | null = null

async function downloadOpfsFile(folder: string, fileName: string): Promise<void> {
  const opfsRoot = await navigator.storage.getDirectory()
  const directoryHandle = await opfsRoot.getDirectoryHandle(folder)
  const fileHandle = await directoryHandle.getFileHandle(fileName)
  const file = await fileHandle.getFile()

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  logger.debug('Downloaded file from OPFS', { folder, fileName })
}

async function exportButtonClick() {
  if (selectedFormat.value === 'geoparquet' && props.resultFile) {
    // Direct GeoParquet file download from OPFS
    await downloadOpfsFile(props.resultFolder!, props.resultFile)
  } else {
    // CSV export via streaming
    duckDbClient = await createDuckDbClient()
    let sqlStmnt = ''
    if (props.customSql) {
      sqlStmnt = props.customSql
    } else {
      sqlStmnt = chartStore.getQuerySql(props.reqId.toString())
    }
    if (!sqlStmnt) {
      logger.error('No SQL statement found for the selected request ID', { reqId: props.reqId })
      return
    }
    void streamSqlQueryToCSV(duckDbClient, sqlStmnt, props.reqId)
  }
}

const id = `sr-export-btn-${props.reqId}`
</script>

<style scoped>
.sr-export-panel {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.sr-format-select {
  min-width: 7rem;
  font-size: small;
}

.sr-export-btn {
  min-width: 4rem;
  min-height: 2rem;
}
</style>
