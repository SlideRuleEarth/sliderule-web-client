import { defineStore } from 'pinia'

export const DEFAULT_MAX_NUM_PNTS_TO_DISPLAY = 50000

export const useSrParquetCfgStore = defineStore('srParquetCfg', {
  state: () => ({
    parquetReader: { name: 'duckDb', value: 'duckDb' },
    parquetReaderOptions: [
      { name: 'duckDb', value: 'duckDb' }
      // { name: 'hyparquet', value: 'hyparquet' },
    ],
    maxNumPntsToDisplay: DEFAULT_MAX_NUM_PNTS_TO_DISPLAY,
    chunkSizeToRead: 10000,
    selectedExportFormat: 'parquet'
  }),
  actions: {
    setParquetReader(parquetReader: { name: string; value: string }) {
      this.parquetReader = parquetReader
    },
    getParquetReader() {
      return this.parquetReader
    },
    setMaxNumPntsToDisplay(maxNumPntsToDisplay: number) {
      this.maxNumPntsToDisplay = maxNumPntsToDisplay
    },
    getMaxNumPntsToDisplay() {
      return this.maxNumPntsToDisplay
    },
    setChunkSizeToRead(chunkSizeToRead: number) {
      this.chunkSizeToRead = chunkSizeToRead
    },
    getChunkSizeToRead() {
      return this.chunkSizeToRead
    },
    setSelectedExportFormat(selectedExportFormat: string) {
      this.selectedExportFormat = selectedExportFormat
    },
    getSelectedExportFormat() {
      return this.selectedExportFormat
    }
  },
  persist: {
    storage: localStorage,
    pick: ['maxNumPntsToDisplay']
  }
})
