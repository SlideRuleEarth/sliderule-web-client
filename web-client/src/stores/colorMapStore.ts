import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('ColorMapStore')

// Default named color palette
const DEFAULT_COLORS: string[] = [
  'gray',
  'slategray',
  'yellow',
  'green',
  'blue',
  'indigo',
  'violet',
  'red',
  'orange',
  'purple',
  'pink',
  'brown',
  'black',
  'white',
  'cyan',
  'greenyellow',
  'lightblue',
  'lightgreen'
]

export const useColorMapStore = defineStore(
  'colorMapStore',
  () => {
    const namedColorPalette = ref<string[]>([...DEFAULT_COLORS])
    const debugCnt = ref(0)

    function getNamedColorPalette(): string[] {
      return namedColorPalette.value
    }

    function setNamedColorPalette(colors: string[]): void {
      namedColorPalette.value = colors
    }

    function addColor(color: string): void {
      if (!namedColorPalette.value.includes(color)) {
        namedColorPalette.value.push(color)
      }
    }

    function removeColor(color: string): void {
      const index = namedColorPalette.value.indexOf(color)
      if (index > -1) {
        namedColorPalette.value.splice(index, 1)
      }
    }

    function restoreDefaultColors(): void {
      namedColorPalette.value = [...DEFAULT_COLORS]
      logger.info('Named color palette restored to defaults')
    }

    function getDebugCnt(): number {
      return debugCnt.value
    }

    function setDebugCnt(cnt: number): void {
      debugCnt.value = cnt
    }

    function incrementDebugCnt(): number {
      debugCnt.value += 1
      return debugCnt.value
    }

    return {
      // State
      namedColorPalette,
      debugCnt,

      // Actions
      getNamedColorPalette,
      setNamedColorPalette,
      addColor,
      removeColor,
      restoreDefaultColors,
      getDebugCnt,
      setDebugCnt,
      incrementDebugCnt
    }
  },
  {
    persist: {
      storage: localStorage,
      pick: ['namedColorPalette']
    }
  }
)
