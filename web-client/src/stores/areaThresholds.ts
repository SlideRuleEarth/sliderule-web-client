import { defineStore } from 'pinia'
import { ref } from 'vue'

// Define a type for the valid API names
type ApiName = 'atl06p' | 'atl06sp' | 'atl08sp' | 'atl03sp' | 'atl03vp'

export const useAreaThresholdsStore = defineStore('thresholdStore', () => {
  // State: maps an API name to a numeric threshold
  const areaErrorThreshold = ref<Record<ApiName, number>>({
    'atl06p': 10000,
    'atl06sp': 10000,
    'atl08sp': 10000,
    'atl03sp': 350,
    'atl03vp': 350,
  })

  const areaWarningThreshold = ref<Record<ApiName, number>>({
    'atl06p': 5000,
    'atl06sp': 5000,
    'atl08sp': 5000,
    'atl03sp': 100,
    'atl03vp': 100,
  })

  // Actions to update thresholds with validation
  function setAreaErrorThreshold(api: ApiName, threshold: number) {
    if (threshold >= 0) {
      areaErrorThreshold.value[api] = threshold
    } else {
      console.warn(`Invalid threshold value for ${api}: must be non-negative.`)
    }
  }

  function setAreaWarningThreshold(api: ApiName, threshold: number) {
    if (threshold >= 0) {
      areaWarningThreshold.value[api] = threshold
    } else {
      console.warn(`Invalid threshold value for ${api}: must be non-negative.`)
    }
  }

  // Getters to retrieve thresholds with a fallback for invalid API names
  function getAreaErrorThreshold(api: string): number | undefined {
    const threshold = areaErrorThreshold.value[api as ApiName]
    if (threshold === undefined) {
      console.warn(`No error threshold found for API: ${api}`)
    }
    return threshold
  }

  function getAreaWarningThreshold(api: string): number | undefined {
    const threshold = areaWarningThreshold.value[api as ApiName]
    if (threshold === undefined) {
      console.warn(`No warning threshold found for API: ${api}`)
    }
    return threshold
  }

  return {
    areaErrorThreshold,
    areaWarningThreshold,
    setAreaErrorThreshold,
    setAreaWarningThreshold,
    getAreaErrorThreshold,
    getAreaWarningThreshold,
  }
})
