<script setup lang="ts">
import Fieldset from 'primevue/fieldset'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import RadioButton from 'primevue/radiobutton'
import Chip from 'primevue/chip'
import { computed, watch, onMounted } from 'vue'
import {
  useArrayColumnStore,
  type ArrayColumnMode,
  type AggregationFunction,
  ALL_AGGREGATIONS,
  AGGREGATION_LABELS
} from '@/stores/arrayColumnStore'
import { useChartStore } from '@/stores/chartStore'
import { callPlotUpdateDebounced } from '@/utils/plotUtils'
import { prepareDbForReqId } from '@/utils/SrDuckDbUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrArrayColumnConfig')

const props = withDefaults(
  defineProps<{
    reqId: number
  }>(),
  {
    reqId: 0
  }
)

const emit = defineEmits<{
  (_e: 'derived-columns-changed', _columns: string[]): void
}>()

const arrayColumnStore = useArrayColumnStore()
const chartStore = useChartStore()

const reqIdStr = computed(() => props.reqId.toString())

// Check if there are any array columns available
const hasArrayColumns = computed(() => {
  return arrayColumnStore.hasArrayColumns(reqIdStr.value)
})

// Get array column options for the dropdown
const arrayColumnOptions = computed(() => {
  const columns = arrayColumnStore.getArrayColumns(reqIdStr.value)
  const options = columns.map((col) => ({
    label: `${col.columnName} (${col.elementType})`,
    value: col.columnName
  }))
  // Add "None" option at the beginning to allow clearing selection
  return [{ label: 'None', value: null }, ...options]
})

// Get/set selected array column
const selectedArrayColumn = computed({
  get: () => arrayColumnStore.getSelectedArrayColumn(reqIdStr.value),
  set: (value: string | null) => {
    arrayColumnStore.setSelectedArrayColumn(reqIdStr.value, value)
  }
})

// Get/set processing mode
const mode = computed({
  get: () => arrayColumnStore.getMode(reqIdStr.value),
  set: (value: ArrayColumnMode) => {
    arrayColumnStore.setMode(reqIdStr.value, value)
  }
})

// Get/set selected aggregations
const selectedAggregations = computed({
  get: () => arrayColumnStore.getSelectedAggregations(reqIdStr.value),
  set: (value: AggregationFunction[]) => {
    arrayColumnStore.setSelectedAggregations(reqIdStr.value, value)
  }
})

// Aggregation options for MultiSelect
const aggregationOptions = computed(() => {
  return ALL_AGGREGATIONS.map((agg) => ({
    label: AGGREGATION_LABELS[agg],
    value: agg
  }))
})

// Get derived column names for preview
const derivedColumns = computed(() => {
  return arrayColumnStore.getDerivedColumnNames(reqIdStr.value)
})

// Handle array column selection change
function onArrayColumnChange(newValue: string | null) {
  logger.debug('Array column changed', { newValue })

  // If clearing selection, reset mode
  if (!newValue) {
    mode.value = 'none'
  }

  // Emit derived columns change and trigger plot update
  void emitDerivedColumnsAndUpdate()
}

// Handle mode change
function onModeChange() {
  logger.debug('Mode changed', { mode: mode.value })
  void emitDerivedColumnsAndUpdate()
}

// Handle aggregation selection change
function onAggregationsChange(newValue: AggregationFunction[]) {
  logger.debug('Aggregations changed', { newValue })
  void emitDerivedColumnsAndUpdate()
}

// Emit derived columns and trigger plot update
async function emitDerivedColumnsAndUpdate() {
  const derived = derivedColumns.value
  emit('derived-columns-changed', derived)

  // Store derived columns in chartStore so they pass validation in plotUtils
  chartStore.setDerivedArrayColumns(reqIdStr.value, derived)

  const selectedCol = selectedArrayColumn.value

  // Get current options
  const currentElevationOptions = chartStore.getElevationDataOptions(reqIdStr.value)
  const currentYOptions = chartStore.getYDataOptions(reqIdStr.value)

  // Remove any previously derived array columns from both lists
  const filterOutDerived = (opt: string) => {
    if (!selectedCol) return true
    // Remove columns that look like derived from this array column (col_mean, col_max, etc.)
    return !opt.startsWith(`${selectedCol}_`)
  }

  const baseElevationOptions = currentElevationOptions.filter(filterOutDerived)
  const baseYOptions = currentYOptions.filter(filterOutDerived)

  if (derived.length > 0) {
    // Add derived columns to available options
    const newElevationOptions = [...baseElevationOptions, ...derived]
    chartStore.setElevationDataOptions(reqIdStr.value, newElevationOptions)

    // Auto-select derived columns for plotting (add to Y data options)
    const newYOptions = [...baseYOptions, ...derived]
    chartStore.setYDataOptions(reqIdStr.value, newYOptions)

    // Automatically show the Y Data menu so user can see/select derived columns
    chartStore.setShowYDataMenu(reqIdStr.value, true)

    logger.debug('Added derived columns to plot options', { derived, newYOptions })
  } else {
    // No derived columns - just update with filtered lists (removes old derived)
    chartStore.setElevationDataOptions(reqIdStr.value, baseElevationOptions)
    chartStore.setYDataOptions(reqIdStr.value, baseYOptions)
  }

  await callPlotUpdateDebounced('from SrArrayColumnConfig')
}

// Watch for reqId changes to ensure state is initialized
watch(
  () => props.reqId,
  () => {
    arrayColumnStore.ensureState(reqIdStr.value)
  },
  { immediate: true }
)

// On mount, re-detect array columns if the store is empty
// This handles cases where the Pinia store was reset (page refresh, etc.)
onMounted(async () => {
  if (props.reqId > 0 && !arrayColumnStore.hasArrayColumns(reqIdStr.value)) {
    logger.debug('Array columns not in store, calling prepareDbForReqId', { reqId: props.reqId })
    try {
      await prepareDbForReqId(props.reqId)
    } catch (error) {
      logger.warn('Failed to detect array columns', { reqId: props.reqId, error })
    }
  }
})
</script>

<template>
  <Fieldset
    v-if="hasArrayColumns"
    class="sr-array-config-fieldset"
    legend="Array Column Options"
    :toggleable="true"
    :collapsed="true"
  >
    <div class="sr-array-config-content">
      <!-- Array Column Selector -->
      <div class="sr-array-select-wrapper">
        <label class="sr-array-select-label">Array Column</label>
        <Select
          class="sr-array-column-select"
          v-model="selectedArrayColumn"
          :options="arrayColumnOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select array column..."
          size="small"
          @update:modelValue="onArrayColumnChange"
        />
      </div>

      <!-- Mode Selector (only show when column is selected) -->
      <div class="sr-mode-selector" v-if="selectedArrayColumn">
        <label class="sr-mode-label">Processing Mode:</label>
        <div class="sr-radio-group">
          <div class="sr-radio-item">
            <RadioButton
              v-model="mode"
              inputId="mode-flatten"
              value="flatten"
              @change="onModeChange"
            />
            <label for="mode-flatten" class="sr-radio-label"> Flatten (expand rows) </label>
          </div>
          <div class="sr-radio-item">
            <RadioButton
              v-model="mode"
              inputId="mode-aggregate"
              value="aggregate"
              @change="onModeChange"
            />
            <label for="mode-aggregate" class="sr-radio-label"> Aggregate (statistics) </label>
          </div>
        </div>
      </div>

      <!-- Aggregation Functions Selector (only show in aggregate mode) -->
      <div class="sr-agg-selector" v-if="mode === 'aggregate'">
        <label class="sr-agg-label">Statistics to Compute</label>
        <MultiSelect
          class="sr-agg-multiselect"
          v-model="selectedAggregations"
          :options="aggregationOptions"
          optionLabel="label"
          optionValue="value"
          display="chip"
          placeholder="Select statistics..."
          size="small"
          @update:modelValue="onAggregationsChange"
        />
      </div>

      <!-- Derived Columns Preview -->
      <div class="sr-derived-preview" v-if="derivedColumns.length > 0">
        <label class="sr-derived-label">Derived columns (available for Y-axis):</label>
        <div class="sr-derived-chips">
          <Chip v-for="col in derivedColumns" :key="col" :label="col" class="sr-derived-chip" />
        </div>
      </div>

      <!-- Warning for flatten mode -->
      <div class="sr-flatten-warning" v-if="mode === 'flatten'">
        <small>
          Note: Flatten mode expands each array element into its own row, which may significantly
          increase the number of data points.
        </small>
      </div>
    </div>
  </Fieldset>
</template>

<style scoped>
.sr-array-config-fieldset {
  width: 100%;
  margin-top: 0.5rem;
}

.sr-array-config-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

.sr-array-select-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sr-array-select-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.sr-array-column-select {
  width: 100%;
}

.sr-agg-label {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.sr-mode-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sr-mode-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.sr-radio-group {
  display: flex;
  flex-direction: row;
  gap: 1.5rem;
}

.sr-radio-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sr-radio-label {
  font-size: 0.875rem;
  cursor: pointer;
}

.sr-agg-selector {
  margin-top: 0.5rem;
}

.sr-agg-multiselect {
  width: 100%;
}

.sr-derived-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: var(--p-surface-800);
  border: 1px solid var(--p-surface-600);
  border-radius: 4px;
}

.sr-derived-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.sr-derived-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.sr-derived-chip {
  font-size: 0.75rem;
}

.sr-flatten-warning {
  padding: 0.5rem;
  background-color: var(--p-yellow-100);
  border-radius: 4px;
  color: var(--p-yellow-900);
}

.sr-flatten-warning small {
  font-size: 0.75rem;
}
</style>
