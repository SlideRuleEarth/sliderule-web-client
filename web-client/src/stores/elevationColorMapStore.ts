import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import colormap from 'colormap'
import type { SrMenuNumberItem } from '@/types/SrTypes'
import { createLogger } from '@/utils/logger'

const logger = createLogger('ElevationColorMapStore')

export const useElevationColorMapStore = defineStore('elevationColorMap', () => {
  const selectedElevationColorMap = ref('viridis')
  const numShadesForElevation = ref(512)
  const elevationColorMap = ref<[number, number, number, number][]>([])
  const linkToGradient = ref(false)
  const linkedReqId = ref<string | null>(null)

  const gradientColorMap = computed(() =>
    elevationColorMap.value.map((color) => `rgba(${color.join(',')})`)
  )

  const getColorGradientStyle = computed(() => ({
    background: `linear-gradient(to right, ${gradientColorMap.value.join(', ')})`,
    height: '10px',
    width: '100%'
  }))

  function setElevationColorMap(value: string) {
    selectedElevationColorMap.value = value
  }

  function getSelectedElevationColorMap() {
    return selectedElevationColorMap.value
  }

  function setNumShadesForElevation(numShades: number) {
    numShadesForElevation.value = numShades
  }

  function getNumShadesForElevation() {
    return numShadesForElevation.value
  }

  function getNumOfElevationShadesOptions(): SrMenuNumberItem[] {
    return [
      { label: '256', value: 256 },
      { label: '512', value: 512 },
      { label: '1024', value: 1024 }
    ]
  }

  function updateElevationColorMapValues() {
    try {
      elevationColorMap.value = colormap({
        colormap: selectedElevationColorMap.value,
        nshades: numShadesForElevation.value,
        format: 'rgba',
        alpha: 1
      })
    } catch (error) {
      logger.warn('updateElevationColorMapValues failed', {
        selectedElevationColorMap: selectedElevationColorMap.value,
        numShadesForElevation: numShadesForElevation.value
      })
      logger.error('updateElevationColorMapValues error', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  function getElevationColorMap() {
    return elevationColorMap.value
  }

  function getColorForElevation(elevation: number, minElevation: number, maxElevation: number) {
    const normalizedValue = Math.floor(
      ((elevation - minElevation) / (maxElevation - minElevation)) * numShadesForElevation.value - 1
    )
    const colorIndex = Math.max(0, Math.min(numShadesForElevation.value - 1, normalizedValue))
    return elevationColorMap.value[colorIndex]
  }

  return {
    selectedElevationColorMap,
    numShadesForElevation,
    elevationColorMap,
    gradientColorMap,
    getColorGradientStyle,
    setElevationColorMap,
    getSelectedElevationColorMap,
    setNumShadesForElevation,
    getNumShadesForElevation,
    getNumOfElevationShadesOptions,
    updateElevationColorMapValues,
    getElevationColorMap,
    getColorForElevation,
    linkToGradient,
    linkedReqId
  }
})
