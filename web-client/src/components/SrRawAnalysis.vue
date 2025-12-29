<template>
  <div class="duckdb-shell">
    <h2 class="sr-header">Sql Playground</h2>
    <div class="sr-query-panel">
      <div>
        <!-- Query Input -->
        <Message class="sr-onmap-msg" severity="info" closable size="small">
          <p>Parquet file: {{ computedFileLabel }}</p>
        </Message>
        <Textarea
          class="sr-duckdb-textarea"
          :style="{ resize: 'both', overflow: 'auto' }"
          v-model="query"
          placeholder="Enter SQL query"
          size="large"
          rows="5"
          cols="50"
        ></Textarea>
      </div>
      <div class="sr-btn-msg-panel">
        <div class="sr-query-buttons">
          <!-- Refresh buttons in a column -->
          <div class="sr-refresh-buttons">
            <Button
              :title="selectButtonTooltip"
              @click="updateSelectFromOptions"
              size="small"
              icon="pi pi-refresh"
              label="Select"
              severity="secondary"
              class="sr-refresh-btn"
            />
            <Button
              title="Reset WHERE clause from current filter settings set using the Advanced Filter Control tool"
              @click="updateQueryFromFilter"
              size="small"
              icon="pi pi-refresh"
              label="Where"
              severity="secondary"
              class="sr-refresh-btn"
            />
          </div>
          <!-- Run Button -->
          <Button
            title="Run the current SQL query. (Note you can edit this query directly! and reset it using the Select/Where buttons)"
            :disabled="isLoading"
            @click="executeQuery"
            size="small"
            :label="runLabel"
            class="sr-run-button"
          >
          </Button>
          <FloatLabel variant="on">
            <InputNumber class="sr-limit" v-model="limit" inputId="integeronly" fluid />
            <label for="integeronly">Limit</label>
          </FloatLabel>
        </div>
        <div class="sr-query-msg-panel">
          <!-- Error Display -->
          <p class="sr-query-msg sr-error" v-if="error">
            {{ error }}
          </p>

          <!-- Info Display -->
          <p class="sr-query-msg sr-info" v-if="info">
            {{ info }}
          </p>
        </div>
        <div>
          <SrExportSelected :reqId="recTreeStore.selectedReqId" :customSql="query" />
        </div>
      </div>
    </div>
    <div class="sr-results-panel">
      <Tabs v-model:value="activeResultTab">
        <TabList>
          <Tab value="0">Table</Tab>
          <Tab value="1">Scatter Plot</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="0">
            <!-- Results DataTable -->
            <DataTable
              v-if="rows.length > 0"
              :value="rows"
              scrollable
              scrollHeight="400px"
              scrollDirection="both"
              style="margin-top: 1rem; width: 50rem"
            >
              <Column v-for="col in columns" sortable :key="col" :field="col" :header="col" />
            </DataTable>
          </TabPanel>
          <TabPanel value="1">
            <SrGenericPlot :rows="rows" :columns="columns" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, watch } from 'vue'
import { createDuckDbClient, DuckDBClient } from '@/utils/SrDuckDb'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { useChartStore } from '@/stores/chartStore'
import { runSqlQuery } from '@/utils/SrDbShellUtils'
import { createWhereClause } from '@/utils/spotUtils'

// PrimeVue Components
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import FloatLabel from 'primevue/floatlabel'
import InputNumber from 'primevue/inputnumber'
import { Message } from 'primevue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useRequestsStore } from '@/stores/requestsStore'
import SrExportSelected from './SrExportSelected.vue'
import SrGenericPlot from './SrGenericPlot.vue'
import { createLogger } from '@/utils/logger'
import { buildSelectClauseFromStore } from '@/utils/plotUtils'

const logger = createLogger('SrRawAnalysis')
const requestsStore = useRequestsStore()

const recTreeStore = useRecTreeStore()
const chartStore = useChartStore()

// Dynamic tooltip matching Plot Configuration label
const selectButtonTooltip = computed(() => {
  const reqId = recTreeStore.selectedReqId
  const func = recTreeStore.findApiForReqId(reqId)
  return `Reset SELECT columns using: Plot Configuration for ${reqId} - ${func}`
})

// Base query from chartStore (without dynamic WHERE clause updates)
const initQuery = computed(() => {
  return chartStore.getQuerySql(recTreeStore.selectedReqIdStr).trim()
})

// Function to build query with current filter WHERE clause
function buildQueryWithCurrentFilter(): string {
  const baseQuery = chartStore.getQuerySql(recTreeStore.selectedReqIdStr).trim()
  if (!baseQuery) return ''

  const reqId = recTreeStore.selectedReqId
  if (reqId <= 0) return baseQuery

  const currentWhereClause = createWhereClause(reqId)

  // Remove existing WHERE clause and everything after it
  const whereIndex = baseQuery.toUpperCase().indexOf('\nWHERE ')
  const queryWithoutWhere = whereIndex >= 0 ? baseQuery.substring(0, whereIndex) : baseQuery

  // Add current WHERE clause if present
  if (currentWhereClause) {
    return `${queryWithoutWhere}\n${currentWhereClause}`
  }
  return queryWithoutWhere
}

// Update WHERE clause from current filter settings
function updateQueryFromFilter() {
  query.value = buildQueryWithCurrentFilter()
  rows.value = []
  columns.value = []
  info.value = 'WHERE clause updated. Click "Run Sql Query" to see results.'
}

// Update SELECT/FROM from current data options (preserves user's WHERE clause)
async function updateSelectFromOptions() {
  const newSelectFrom = await buildSelectClauseFromStore(recTreeStore.selectedReqIdStr)
  if (!newSelectFrom) {
    info.value = 'No data available to build query.'
    return
  }

  // Extract current WHERE clause from user's query (if any)
  const currentQuery = query.value
  const currentWhereIndex = currentQuery.toUpperCase().indexOf('\nWHERE ')
  const currentWhereClause = currentWhereIndex >= 0 ? currentQuery.substring(currentWhereIndex) : ''

  // Combine new SELECT/FROM with user's WHERE clause
  query.value = currentWhereClause ? `${newSelectFrom}${currentWhereClause}` : newSelectFrom
  rows.value = []
  columns.value = []
  info.value = 'SELECT columns updated. Click "Run Sql Query" to see results.'
}
const query = ref<string>(initQuery.value)
const rows = ref<Array<Record<string, any>>>([])
const columns = ref<string[]>([])
const error = ref<string | null>(null)
const info = ref<string | null>(null)
const isLoading = ref(false)
const computedFileLabel = computed(() => `${chartStore.getFile(recTreeStore.selectedReqIdStr)}`)
const limit = ref(5000)
const activeResultTab = ref('0') // '0' = Table, '1' = Plot

// Watch for query changes from chartStore (e.g., when Array Column Options change)
watch(initQuery, (newQuery) => {
  query.value = newQuery
  // Reset results when query changes
  rows.value = []
  columns.value = []
  info.value = 'Query updated. Click "Run Sql Query" to see results.'
  logger.debug('Query updated from chartStore', { newQuery })
})

const computedLimitClause = computed(() => (limit.value > 0 ? `LIMIT ${limit.value}` : ''))
const computedStartingInfoText = computed(() => {
  if (limit.value > 0) {
    return `running query adding ${computedLimitClause.value} ...`
  } else {
    return 'running query ...'
  }
})
const runLabel = computed(() => {
  return isLoading.value ? 'Running...' : 'Run Sql Query'
})

let duckDbClient: DuckDBClient | null = null

onMounted(async () => {
  try {
    duckDbClient = await createDuckDbClient()
    void requestsStore.displayHelpfulPlotAdvice(
      'click Run to generate a table of the selected track data'
    )
    void requestsStore.displayHelpfulPlotAdvice(
      'You can query the table with any valid SQL statement'
    )
    logger.debug('onMounted: DuckDB client initialized')
    info.value =
      'Enter a SQL query and click "Run Sql Query"\nIf it "Snaps" reload the page and narrow the query and/or use LIMIT'
  } catch (err: any) {
    error.value = `Failed to initialize DuckDB: ${err?.message ?? err}`
    logger.error('Failed to initialize DuckDB', {
      error: err instanceof Error ? err.message : String(err)
    })
  }
})

async function executeQuery() {
  if (!duckDbClient) {
    logger.error('DuckDB client not initialized')
    error.value = 'DuckDB client not initialized?'
    return
  }
  isLoading.value = true
  error.value = ''
  info.value = computedStartingInfoText.value
  rows.value = []
  columns.value = []
  const finalQuery = `${query.value} ${computedLimitClause.value}`
  try {
    // Ensure the parquet file is registered with DuckDB before querying
    const fileName = chartStore.getFile(recTreeStore.selectedReqIdStr)
    if (fileName) {
      await duckDbClient.insertOpfsParquet(fileName)
    }
    const result = await runSqlQuery(duckDbClient, finalQuery)
    rows.value = result.rows
    columns.value = result.columns
    if (result.chunkCount === 0) {
      error.value = 'No results found'
    }
  } catch (err: any) {
    error.value = `Query error: ${err?.message ?? err}`
    logger.error('Query error', { error: err instanceof Error ? err.message : String(err) })
  } finally {
    isLoading.value = false
    info.value = `There are ${rows.value.length} rows in the result`
  }
}
</script>

<style scoped>
.sr-header {
  margin-bottom: 0.25rem;
  margin-top: 0rem;
}

.duckdb-shell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  max-width: 600px;
  width: 100%;
  margin: 1rem auto;
}

.sr-btn-msg-panel {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
}

.sr-query-msg-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #2c2c2c;
  gap: 0.5rem;
  width: 100%;
  border-radius: var(--p-border-radius);
  padding: 0.25rem;
  margin-bottom: 0.25rem;
}

.sr-query-msg {
  display: block;
  font-size: x-small;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.sr-onmap-msg {
  justify-content: center;
  text-align: center;
  align-items: center;
  font-size: x-small;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  height: 2rem;
}

.sr-results-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.sr-query-buttons {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  white-space: nowrap;
}
.sr-refresh-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sr-refresh-btn {
  font-size: x-small;
  padding: 0.25rem 0.5rem;
}

:deep(.sr-refresh-btn .p-button-icon) {
  font-size: x-small;
}

:deep(.sr-refresh-btn .p-button-label) {
  font-size: x-small;
}

.sr-run-button {
  min-width: 8rem;
}

:deep(.sr-duckdb-textarea) {
  font-family: monospace;
  font-size: smaller;
  width: 100%;
}

.sr-query-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: transparent;
  border-radius: 0.5rem;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
}
.sr-limit {
  width: fit-content;
  min-width: 4.25rem;
}
.sr-error {
  color: red;
  white-space: pre-wrap;
}

.sr-info {
  white-space: pre-wrap;
}
</style>
