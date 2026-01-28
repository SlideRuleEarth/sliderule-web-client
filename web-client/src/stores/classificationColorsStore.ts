import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('ClassificationColorsStore')

// Default colors for ATL03 confidence values (-2 to 4, stored as array index 0-6)
const DEFAULT_ATL03_CNF_COLORS: string[] = [
  'white', // -2: atl03_tep
  'slategray', // -1: atl03_not_considered
  'blue', //  0: atl03_background
  'blue', //  1: atl03_within_10m
  'green', //  2: atl03_low
  'yellow', //  3: atl03_medium
  'violet' //  4: atl03_high
]

// Default colors for ATL08 class values (0 to 4)
const DEFAULT_ATL08_CLASS_COLORS: string[] = [
  'blue', // 0: atl08_noise
  'violet', // 1: atl08_ground
  'lightgreen', // 2: atl08_canopy
  'green', // 3: atl08_top_of_canopy
  'slategray' // 4: atl08_unclassified
]

// Default colors for ATL24 class values (stored as array index 0-2)
// Values: 0=unclassified, 40=bathymetry, 41=sea_surface
const DEFAULT_ATL24_CLASS_COLORS: string[] = [
  'purple', // 0: atl24_unclassified
  'greenyellow', // 1: atl24_bathymetry (value 40)
  'lightblue' // 2: atl24_sea_surface (value 41)
]

export const useClassificationColorsStore = defineStore(
  'classificationColorsStore',
  () => {
    // Color arrays - index maps to classification value
    const atl03CnfColors = ref<string[]>([...DEFAULT_ATL03_CNF_COLORS])
    const atl08ClassColors = ref<string[]>([...DEFAULT_ATL08_CLASS_COLORS])
    const atl24ClassColors = ref<string[]>([...DEFAULT_ATL24_CLASS_COLORS])

    // ATL03 CNF methods
    function getAtl03CnfColors(): string[] {
      return atl03CnfColors.value
    }

    function setAtl03CnfColor(value: number, color: string): void {
      const ndx = value + 2 // value range -2 to 4 maps to index 0-6
      if (ndx < 0 || ndx > 6) {
        logger.error('setAtl03CnfColor invalid value', { value })
        return
      }
      atl03CnfColors.value[ndx] = color
    }

    function getAtl03CnfColor(value: number): string {
      const ndx = value + 2
      if (ndx < 0 || ndx > 6) {
        return 'white'
      }
      return atl03CnfColors.value[ndx]
    }

    function restoreDefaultAtl03CnfColors(): void {
      atl03CnfColors.value = [...DEFAULT_ATL03_CNF_COLORS]
      logger.info('ATL03 CNF colors restored to defaults')
    }

    // ATL08 Class methods
    function getAtl08ClassColors(): string[] {
      return atl08ClassColors.value
    }

    function setAtl08ClassColor(value: number, color: string): void {
      if (value < 0 || value > 4) {
        logger.error('setAtl08ClassColor invalid value', { value })
        return
      }
      atl08ClassColors.value[value] = color
    }

    function getAtl08ClassColor(value: number): string {
      if (value < 0 || value > 4) {
        return 'white'
      }
      return atl08ClassColors.value[value]
    }

    function restoreDefaultAtl08ClassColors(): void {
      atl08ClassColors.value = [...DEFAULT_ATL08_CLASS_COLORS]
      logger.info('ATL08 class colors restored to defaults')
    }

    // ATL24 Class methods
    function getAtl24ClassColors(): string[] {
      return atl24ClassColors.value
    }

    function setAtl24ClassColor(value: number, color: string): void {
      let ndx: number
      if (value === 0) {
        ndx = 0 // unclassified
      } else if (value === 40) {
        ndx = 1 // bathymetry
      } else if (value === 41) {
        ndx = 2 // sea_surface
      } else {
        logger.error('setAtl24ClassColor invalid value', { value })
        return
      }
      atl24ClassColors.value[ndx] = color
    }

    function getAtl24ClassColor(value: number): string {
      if (value === 0) {
        return atl24ClassColors.value[0]
      } else if (value === 40) {
        return atl24ClassColors.value[1]
      } else if (value === 41) {
        return atl24ClassColors.value[2]
      }
      return 'white'
    }

    function restoreDefaultAtl24ClassColors(): void {
      atl24ClassColors.value = [...DEFAULT_ATL24_CLASS_COLORS]
      logger.info('ATL24 class colors restored to defaults')
    }

    // Restore all defaults
    function restoreAllDefaults(): void {
      restoreDefaultAtl03CnfColors()
      restoreDefaultAtl08ClassColors()
      restoreDefaultAtl24ClassColors()
    }

    return {
      // State
      atl03CnfColors,
      atl08ClassColors,
      atl24ClassColors,

      // ATL03 CNF
      getAtl03CnfColors,
      setAtl03CnfColor,
      getAtl03CnfColor,
      restoreDefaultAtl03CnfColors,

      // ATL08 Class
      getAtl08ClassColors,
      setAtl08ClassColor,
      getAtl08ClassColor,
      restoreDefaultAtl08ClassColors,

      // ATL24 Class
      getAtl24ClassColors,
      setAtl24ClassColor,
      getAtl24ClassColor,
      restoreDefaultAtl24ClassColors,

      // All
      restoreAllDefaults
    }
  },
  {
    persist: {
      storage: localStorage,
      pick: ['atl03CnfColors', 'atl08ClassColors', 'atl24ClassColors']
    }
  }
)
