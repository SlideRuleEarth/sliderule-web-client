import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useClassificationColorsStore } from '@/stores/classificationColorsStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('Atl08ClassColorMapStore')

/**
 * Factory function to create a unique store instance per reqId
 * Colors are stored in the global classificationColorsStore.
 * This per-request store handles dataOrderNdx caching for performance.
 */
export function useAtl08ClassColorMapStore(reqIdStr: string) {
  const store = defineStore(`atl08ClassStore-${reqIdStr}`, () => {
    const isInitialized = ref(false)
    let dataOrderNdx: Record<string, number> = {}
    const colorCache: Record<number, string> = {}
    let ndx: number = -1

    const atl08ClassOptions = [
      { label: 'atl08_noise', value: 0 },
      { label: 'atl08_ground', value: 1 },
      { label: 'atl08_canopy', value: 2 },
      { label: 'atl08_top_of_canopy', value: 3 },
      { label: 'atl08_unclassified', value: 4 }
    ] as { label: string; value: number }[]

    // Get reference to global colors store
    const classificationColorsStore = useClassificationColorsStore()

    // Computed ref that returns colors from global store
    const atl08ClassColorMap = ref<string[]>([])

    function initializeColorMapStore() {
      isInitialized.value = true
      // Sync colors from global store
      atl08ClassColorMap.value = classificationColorsStore.getAtl08ClassColors()
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
        ndx = dataOrderNdx['atl08_class']
      }
      const value = params.data[ndx]
      if (colorCache[value] === undefined) {
        colorCache[value] = getColorForAtl08ClassValue(value)
      }
      return colorCache[value]
    }

    function getColorForAtl08ClassValue(value: number): string {
      return classificationColorsStore.getAtl08ClassColor(value)
    }

    function restoreDefaultAtl08ClassColorMap() {
      classificationColorsStore.restoreDefaultAtl08ClassColors()
      atl08ClassColorMap.value = classificationColorsStore.getAtl08ClassColors()
      resetColorCache()
    }

    function setColorForAtl08ClassValue(value: number, namedColorValue: string) {
      if (value < 0 || value > 4) {
        logger.error('setColorForAtl08ClassValue invalid value', { value })
        return
      }
      resetColorCache()
      classificationColorsStore.setAtl08ClassColor(value, namedColorValue)
      atl08ClassColorMap.value = classificationColorsStore.getAtl08ClassColors()
    }

    function resetColorCache() {
      Object.keys(colorCache).forEach((key) => delete colorCache[Number(key)])
      ndx = -1
      logger.debug('Cache for atl08_class reset')
    }

    return {
      dataOrderNdx,
      getDimensions,
      getDataOrderNdx,
      setDataOrderNdx,
      restoreDefaultAtl08ClassColorMap,
      setColorForAtl08ClassValue,
      getColorForAtl08ClassValue,
      cachedColorFunction,
      resetColorCache,
      atl08ClassOptions,
      atl08ClassColorMap,
      initializeColorMapStore
    }
  })()

  store.initializeColorMapStore()
  return store
}
