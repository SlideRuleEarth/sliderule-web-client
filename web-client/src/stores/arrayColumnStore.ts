import { defineStore } from 'pinia'
import { createLogger } from '@/utils/logger'

const logger = createLogger('ArrayColumnStore')

// Type definitions for array column handling
export type ArrayColumnMode = 'flatten' | 'aggregate' | 'none'

export type AggregationFunction =
  | 'mean'
  | 'min'
  | 'max'
  | 'sum'
  | 'count'
  | 'median'
  | 'stddev'
  | 'first'
  | 'last'
  | 'unique_count'

export interface ArrayColumnConfig {
  columnName: string
  columnType: string // e.g., "LIST<DOUBLE>", "DOUBLE[]"
  elementType: string // extracted inner type, e.g., "DOUBLE"
}

interface ArrayColumnState {
  arrayColumns: ArrayColumnConfig[] // Available array columns from parquet
  selectedArrayColumn: string | null // Currently selected array column for processing
  mode: ArrayColumnMode // Current processing mode
  selectedAggregations: AggregationFunction[] // Selected aggregation functions
}

// Default aggregations when user selects aggregate mode
export const DEFAULT_AGGREGATIONS: AggregationFunction[] = ['mean', 'min', 'max']

// All available aggregation functions
export const ALL_AGGREGATIONS: AggregationFunction[] = [
  'mean',
  'min',
  'max',
  'sum',
  'count',
  'median',
  'stddev',
  'first',
  'last',
  'unique_count'
]

// Labels for UI display
export const AGGREGATION_LABELS: Record<AggregationFunction, string> = {
  mean: 'Mean',
  min: 'Minimum',
  max: 'Maximum',
  sum: 'Sum',
  count: 'Count',
  median: 'Median',
  stddev: 'Std Dev',
  first: 'First',
  last: 'Last',
  unique_count: 'Unique Count'
}

export const useArrayColumnStore = defineStore('arrayColumnStore', {
  state: () => ({
    stateByReqId: {} as Record<string, ArrayColumnState>
  }),

  actions: {
    // Initialize state for a reqIdStr if it doesn't exist
    ensureState(reqIdStr: string): boolean {
      if (typeof reqIdStr !== 'string' || !/^\d+$/.test(reqIdStr)) {
        logger.warn('ensureState encountered an invalid reqIdStr', {
          reqIdStr,
          type: typeof reqIdStr
        })
        return false
      }
      if (!this.stateByReqId[reqIdStr]) {
        this.stateByReqId[reqIdStr] = {
          arrayColumns: [],
          selectedArrayColumn: null,
          mode: 'none',
          selectedAggregations: [...DEFAULT_AGGREGATIONS]
        }
      }
      return true
    },

    // Set available array columns discovered from parquet schema
    setArrayColumns(reqIdStr: string, arrayColumns: ArrayColumnConfig[]): void {
      this.ensureState(reqIdStr)
      this.stateByReqId[reqIdStr].arrayColumns = arrayColumns
      logger.info('setArrayColumns', {
        reqIdStr,
        count: arrayColumns.length,
        columns: arrayColumns.map((c) => c.columnName)
      })
    },

    // Get available array columns
    getArrayColumns(reqIdStr: string): ArrayColumnConfig[] {
      this.ensureState(reqIdStr)
      return this.stateByReqId[reqIdStr].arrayColumns
    },

    // Check if there are any array columns available
    hasArrayColumns(reqIdStr: string): boolean {
      this.ensureState(reqIdStr)
      return this.stateByReqId[reqIdStr].arrayColumns.length > 0
    },

    // Set the selected array column for processing
    setSelectedArrayColumn(reqIdStr: string, columnName: string | null): void {
      this.ensureState(reqIdStr)
      this.stateByReqId[reqIdStr].selectedArrayColumn = columnName
      // Reset mode when changing column
      if (columnName === null) {
        this.stateByReqId[reqIdStr].mode = 'none'
      }
      logger.info('setSelectedArrayColumn', { reqIdStr, columnName })
    },

    // Get the selected array column
    getSelectedArrayColumn(reqIdStr: string): string | null {
      this.ensureState(reqIdStr)
      return this.stateByReqId[reqIdStr].selectedArrayColumn
    },

    // Set the processing mode (flatten or aggregate)
    setMode(reqIdStr: string, mode: ArrayColumnMode): void {
      this.ensureState(reqIdStr)
      this.stateByReqId[reqIdStr].mode = mode
      logger.info('setMode', { reqIdStr, mode })
    },

    // Get the current processing mode
    getMode(reqIdStr: string): ArrayColumnMode {
      this.ensureState(reqIdStr)
      return this.stateByReqId[reqIdStr].mode
    },

    // Set selected aggregation functions
    setSelectedAggregations(reqIdStr: string, aggregations: AggregationFunction[]): void {
      this.ensureState(reqIdStr)
      this.stateByReqId[reqIdStr].selectedAggregations = aggregations
      logger.info('setSelectedAggregations', { reqIdStr, aggregations })
    },

    // Get selected aggregation functions
    getSelectedAggregations(reqIdStr: string): AggregationFunction[] {
      this.ensureState(reqIdStr)
      return this.stateByReqId[reqIdStr].selectedAggregations
    },

    // Get derived column names based on current configuration
    // e.g., if column is "photons" and aggregations are ['mean', 'max'], returns ['photons_mean', 'photons_max']
    getDerivedColumnNames(reqIdStr: string): string[] {
      this.ensureState(reqIdStr)
      const state = this.stateByReqId[reqIdStr]

      if (!state.selectedArrayColumn || state.mode === 'none') {
        return []
      }

      if (state.mode === 'flatten') {
        // Flatten mode: the array column becomes a scalar column with the same name
        return [state.selectedArrayColumn]
      }

      if (state.mode === 'aggregate') {
        // Aggregate mode: create derived columns for each aggregation
        return state.selectedAggregations.map((agg) => `${state.selectedArrayColumn}_${agg}`)
      }

      return []
    },

    // Get active configuration for use in query building
    getActiveConfig(reqIdStr: string): {
      columnName: string
      mode: ArrayColumnMode
      aggregations: AggregationFunction[]
    } | null {
      this.ensureState(reqIdStr)
      const state = this.stateByReqId[reqIdStr]

      if (!state.selectedArrayColumn || state.mode === 'none') {
        return null
      }

      return {
        columnName: state.selectedArrayColumn,
        mode: state.mode,
        aggregations: state.mode === 'aggregate' ? state.selectedAggregations : []
      }
    },

    // Reset array column configuration for a request
    resetConfig(reqIdStr: string): void {
      this.ensureState(reqIdStr)
      this.stateByReqId[reqIdStr].selectedArrayColumn = null
      this.stateByReqId[reqIdStr].mode = 'none'
      this.stateByReqId[reqIdStr].selectedAggregations = [...DEFAULT_AGGREGATIONS]
      logger.info('resetConfig', { reqIdStr })
    },

    // Clear all state for a request (e.g., when request is deleted)
    clearState(reqIdStr: string): void {
      delete this.stateByReqId[reqIdStr]
      logger.info('clearState', { reqIdStr })
    }
  }
})
