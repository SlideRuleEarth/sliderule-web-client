import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useClassificationColorsStore } from '@/stores/classificationColorsStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('Atl03CnfColorMapStore')

/**
 * Factory function to create a unique store instance per reqId
 * Colors are stored in the global classificationColorsStore.
 * This per-request store handles dataOrderNdx caching for performance.
 */
export function useAtl03CnfColorMapStore(reqIdStr: string) {
  const store = defineStore(`atl03CnfStore-${reqIdStr}`, () => {
    const isInitialized = ref(false)
    let dataOrderNdx: Record<string, number> = {}
    const colorCache: Record<number, string> = {}
    let ndx: number = -1

    const atl03CnfOptions = [
      { label: 'atl03_tep', value: -2 },
      { label: 'atl03_not_considered', value: -1 },
      { label: 'atl03_background', value: 0 },
      { label: 'atl03_within_10m', value: 1 },
      { label: 'atl03_low', value: 2 },
      { label: 'atl03_medium', value: 3 },
      { label: 'atl03_high', value: 4 }
    ] as { label: string; value: number }[]

    // Get reference to global colors store
    const classificationColorsStore = useClassificationColorsStore()

    // Computed ref that returns colors from global store
    const atl03CnfColorMap = ref<string[]>([])

    function initializeColorMapStore() {
      isInitialized.value = true
      // Sync colors from global store
      atl03CnfColorMap.value = classificationColorsStore.getAtl03CnfColors()
    }

    function getDimensions(): string[] {
      return Object.keys(dataOrderNdx).sort((a, b) => {
        const aValue = dataOrderNdx[a]
        const bValue = dataOrderNdx[b]
        return aValue - bValue
      })
    }

    function getDataOrderNdx(): Record<string, number> {
      return dataOrderNdx
    }

    function setDataOrderNdx(dataOrderNdxObj: Record<string, number>) {
      dataOrderNdx = dataOrderNdxObj
    }

    function cachedColorFunction(params: any) {
      if (ndx < 0) {
        ndx = dataOrderNdx['atl03_cnf']
      }
      const value = params.data[ndx]
      if (colorCache[value] === undefined) {
        colorCache[value] = getColorForAtl03CnfValue(value)
      }
      return colorCache[value]
    }

    function getColorForAtl03CnfValue(value: number): string {
      return classificationColorsStore.getAtl03CnfColor(value)
    }

    function restoreDefaultAtl03CnfColorMap() {
      classificationColorsStore.restoreDefaultAtl03CnfColors()
      atl03CnfColorMap.value = classificationColorsStore.getAtl03CnfColors()
      resetColorCache()
    }

    function setColorForAtl03CnfValue(value: number, namedColorValue: string) {
      const ndx = value + 2
      if (ndx < 0 || ndx > 6) {
        logger.error('setColorForAtl03CnfValue invalid value', { value })
        return
      }
      resetColorCache()
      classificationColorsStore.setAtl03CnfColor(value, namedColorValue)
      atl03CnfColorMap.value = classificationColorsStore.getAtl03CnfColors()
    }

    function resetColorCache() {
      Object.keys(colorCache).forEach((key) => delete colorCache[Number(key)])
      ndx = -1
      logger.debug('Cache for atl03_cnf reset')
    }

    return {
      dataOrderNdx,
      getDimensions,
      getDataOrderNdx,
      setDataOrderNdx,
      restoreDefaultAtl03CnfColorMap,
      setColorForAtl03CnfValue,
      getColorForAtl03CnfValue,
      cachedColorFunction,
      resetColorCache,
      atl03CnfOptions,
      atl03CnfColorMap,
      initializeColorMapStore
    }
  })()

  store.initializeColorMapStore()
  return store
}
