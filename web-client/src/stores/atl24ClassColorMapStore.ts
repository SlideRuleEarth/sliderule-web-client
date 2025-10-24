import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db/SlideRuleDb'
import { createLogger } from '@/utils/logger'

const logger = createLogger('Atl24ClassColorMapStore')

/**
 * Factory function to create a unique store instance per reqId
 */
export async function useAtl24ClassColorMapStore(reqIdStr: string) {
  const store = defineStore(`atl24ClassStore-${reqIdStr}`, () => {
    // const isInitialized = ref(false); // Unused variable
    const dataOrderNdx = ref<Record<string, number>>({})
    const atl24ClassColorMap = ref([] as string[])
    const atl24ClassOptions = [
      { label: 'atl24_unclassified', value: 0 },
      { label: 'atl24_bathymetry', value: 40 },
      { label: 'atl24_sea_surface', value: 41 }
    ] as { label: string; value: number }[]

    async function initializeColorMapStore() {
      atl24ClassColorMap.value = await db.getAllAtl24ClassColors()
    }

    function getDimensions(): string[] {
      return Object.keys(dataOrderNdx.value).sort((a, b) => {
        const aValue = dataOrderNdx.value[a]
        const bValue = dataOrderNdx.value[b]
        return aValue - bValue
      })
    }
    function getDataOrderNdx(): Record<string, number> {
      return dataOrderNdx.value
    }

    function setDataOrderNdx(dataOrderNdxObj: Record<string, number>) {
      dataOrderNdx.value = dataOrderNdxObj
    }

    function createDiscreteColorFunction(
      getColorFunction: (_value: number) => string,
      ndx_name: string
    ) {
      const colorCache: Record<number, string> = {}
      let ndx: number = -1
      const colorFunction = (params: any) => {
        if (ndx < 0) {
          ndx = dataOrderNdx.value[ndx_name]
        }
        const paramValue = params.data[ndx]
        if (colorCache[paramValue] === undefined) {
          colorCache[paramValue] = getColorFunction(paramValue)
        }
        return colorCache[paramValue]
      }

      // Function to clear the cache
      colorFunction.resetCache = () => {
        Object.keys(colorCache).forEach((key) => delete colorCache[Number(key)])
        ndx = -1 // Reset index so it is recalculated
      }

      return colorFunction
    }

    const getColorForAtl24ClassValue = (value: number) => {
      // value is the atl24_class value 0 to 4
      let ndx = value
      if (value == 0) {
        ndx = 0 // unclassified
      } else if (value == 40) {
        ndx = 1 // bathymetry
      } else if (value == 41) {
        ndx = 2 // sea surface
      } else {
        logger.error('getColorForAtl24ClassValue invalid value', { value })
        return 'White' // Return White for invalid values
      }
      const c = atl24ClassColorMap.value[ndx]
      return c
    }

    const getAtl24ClassColorCached = createDiscreteColorFunction(
      getColorForAtl24ClassValue,
      'atl24_class'
    )

    function getColorUsingAtl24_class(params: any): string {
      return getAtl24ClassColorCached(params)
    }

    function resetAtl24ClassColorCaches() {
      getAtl24ClassColorCached.resetCache()
    }

    async function restoreDefaultAtl24ClassColorMap() {
      await db.restoreDefaultAtl24ClassColors()
      atl24ClassColorMap.value = await db.getAllAtl24ClassColors()
    }

    async function setColorForAtl24ClassValue(value: number, namedColorValue: string) {
      // value is the atl24_class value 0 to 4
      let ndx
      if (value == 0) {
        ndx = 0 // unclassified
      } else if (value == 40) {
        ndx = 1 // bathymetry
      } else if (value == 41) {
        ndx = 2 // sea surface
      } else {
        logger.error('setColorForAtl24ClassValue invalid value', { value })
        return
      }
      atl24ClassColorMap.value[ndx] = namedColorValue
      await db.addOrUpdateAtl24ClassColor(ndx, namedColorValue)
    }

    return {
      dataOrderNdx,
      getDimensions,
      getDataOrderNdx,
      setDataOrderNdx,
      getAtl24ClassColorCached,
      getColorUsingAtl24_class,
      resetAtl24ClassColorCaches,
      restoreDefaultAtl24ClassColorMap,
      setColorForAtl24ClassValue,
      getColorForAtl24ClassValue,
      atl24ClassOptions,
      initializeColorMapStore
    }
  })()

  await store.initializeColorMapStore()
  return store
}
