import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useClassificationColorsStore } from '@/stores/classificationColorsStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('Atl24ClassColorMapStore')

/**
 * Factory function to create a unique store instance per reqId
 * Colors are stored in the global classificationColorsStore.
 * This per-request store handles dataOrderNdx caching for performance.
 */
export function useAtl24ClassColorMapStore(reqIdStr: string) {
  const store = defineStore(`atl24ClassStore-${reqIdStr}`, () => {
    const isInitialized = ref(false)
    let dataOrderNdx: Record<string, number> = {}
    const colorCache: Record<number, string> = {}
    let ndx: number = -1

    const atl24ClassOptions = [
      { label: 'atl24_unclassified', value: 0 },
      { label: 'atl24_bathymetry', value: 40 },
      { label: 'atl24_sea_surface', value: 41 }
    ] as { label: string; value: number }[]

    // Get reference to global colors store
    const classificationColorsStore = useClassificationColorsStore()

    // Computed ref that returns colors from global store
    const atl24ClassColorMap = ref<string[]>([])

    function initializeColorMapStore() {
      isInitialized.value = true
      // Sync colors from global store
      atl24ClassColorMap.value = classificationColorsStore.getAtl24ClassColors()
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
        ndx = dataOrderNdx['atl24_class']
      }
      const value = params.data[ndx]
      if (colorCache[value] === undefined) {
        colorCache[value] = getColorForAtl24ClassValue(value)
      }
      return colorCache[value]
    }

    function getColorForAtl24ClassValue(value: number): string {
      return classificationColorsStore.getAtl24ClassColor(value)
    }

    function restoreDefaultAtl24ClassColorMap() {
      classificationColorsStore.restoreDefaultAtl24ClassColors()
      atl24ClassColorMap.value = classificationColorsStore.getAtl24ClassColors()
      resetColorCache()
    }

    function setColorForAtl24ClassValue(value: number, namedColorValue: string) {
      // Validate value - only 0, 40, 41 are valid
      if (value !== 0 && value !== 40 && value !== 41) {
        logger.error('setColorForAtl24ClassValue invalid value', { value })
        return
      }
      resetColorCache()
      classificationColorsStore.setAtl24ClassColor(value, namedColorValue)
      atl24ClassColorMap.value = classificationColorsStore.getAtl24ClassColors()
    }

    function resetColorCache() {
      Object.keys(colorCache).forEach((key) => delete colorCache[Number(key)])
      ndx = -1
      logger.debug('Cache for atl24_class reset')
    }

    return {
      dataOrderNdx,
      getDimensions,
      getDataOrderNdx,
      setDataOrderNdx,
      restoreDefaultAtl24ClassColorMap,
      setColorForAtl24ClassValue,
      getColorForAtl24ClassValue,
      cachedColorFunction,
      resetColorCache,
      atl24ClassOptions,
      atl24ClassColorMap,
      initializeColorMapStore
    }
  })()

  store.initializeColorMapStore()
  return store
}
