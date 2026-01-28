import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('PlotConfigStore')

// Default symbol sizes keyed by API function name
const DEFAULT_SYMBOL_SIZES: Record<string, number> = {
  atl03sp: 2,
  atl03vp: 4,
  atl03x: 3,
  atl06: 4,
  atl06p: 4,
  atl06sp: 4,
  atl06x: 4,
  atl08: 4,
  atl08p: 4,
  atl08x: 4,
  atl13x: 4,
  atl24: 4,
  atl24x: 4
}

export const usePlotConfigStore = defineStore(
  'plotConfig',
  () => {
    // Progressive rendering settings
    const isLarge = ref(false)
    const largeThreshold = ref(50000)
    const progressiveChunkSize = ref(12000)
    const progressiveChunkThreshold = ref(10000)
    const progressiveChunkMode = ref('auto')

    // Default symbol/color settings
    const defaultAtl06Color = ref('red')
    const defaultSymbolSize = ref<Record<string, number>>({ ...DEFAULT_SYMBOL_SIZES })
    const defaultGradientColorMapName = ref('viridis')
    const defaultGradientNumShades = ref(512)

    /**
     * Get default symbol size for a given API function, with fallback to atl06
     */
    function getDefaultSymbolSize(func: string): number {
      return defaultSymbolSize.value[func] ?? defaultSymbolSize.value['atl06'] ?? 4
    }

    /**
     * Set default symbol size for a given API function
     */
    function setDefaultSymbolSize(func: string, size: number): void {
      defaultSymbolSize.value[func] = size
    }

    /**
     * Restore defaults (hardcoded values)
     */
    function restoreDefaults(): void {
      isLarge.value = false
      largeThreshold.value = 50000
      progressiveChunkSize.value = 12000
      progressiveChunkThreshold.value = 10000
      progressiveChunkMode.value = 'mod'
      defaultAtl06Color.value = 'red'
      defaultSymbolSize.value = { ...DEFAULT_SYMBOL_SIZES }
      defaultGradientColorMapName.value = 'viridis'
      defaultGradientNumShades.value = 512
      logger.info('PlotConfig restored to defaults')
    }

    return {
      // State
      isLarge,
      largeThreshold,
      progressiveChunkSize,
      progressiveChunkThreshold,
      progressiveChunkMode,
      defaultAtl06Color,
      defaultSymbolSize,
      defaultGradientColorMapName,
      defaultGradientNumShades,

      // Actions
      getDefaultSymbolSize,
      setDefaultSymbolSize,
      restoreDefaults
    }
  },
  {
    persist: {
      storage: localStorage,
      pick: [
        'isLarge',
        'largeThreshold',
        'progressiveChunkSize',
        'progressiveChunkThreshold',
        'progressiveChunkMode',
        'defaultAtl06Color',
        'defaultSymbolSize',
        'defaultGradientColorMapName',
        'defaultGradientNumShades'
      ]
    }
  }
)
