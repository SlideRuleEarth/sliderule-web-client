import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAreaThresholdsStore = defineStore('thresholdStore', () => {
  // State: maps an API name (string) to a numeric threshold
  // Initialize with the provided values
  const areaErrorThreshold = ref<Record<string, number>>({
    'atl06': 10000,
    'atl06sp': 10000,
    'atl08sp': 10000,
    'atl03sp': 350,
    'atl03vp': 350,
  })

  const areaWarningThreshold = ref<Record<string, number>>({
    'atl06': 5000,
    'atl06sp': 5000,
    'atl08sp': 5000,
    'atl03sp': 100,
    'atl03vp': 100,
  })

  // Actions to update thresholds
  function setAreaErrorThreshold(api: string, threshold: number) {
    areaErrorThreshold.value[api] = threshold
  }

  function setAreaWarningThreshold(api: string, threshold: number) {
    areaWarningThreshold.value[api] = threshold
  }

  // Getters to retrieve thresholds
  function getAreaErrorThreshold(api: string) {
    return areaErrorThreshold.value[api]
  }

  function getAreaWarningThreshold(api: string) {
    console.log('areaWarningThreshold.value', areaWarningThreshold.value);
    console.log(`areaWarningThreshold.value[${api}]:`, areaWarningThreshold.value[`${api}`]);
    return areaWarningThreshold.value[`${api}`]
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
