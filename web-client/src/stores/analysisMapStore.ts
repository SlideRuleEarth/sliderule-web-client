import { defineStore } from 'pinia'
import { ref, type ShallowRef, shallowRef } from 'vue'
import type OLMap from 'ol/Map.js'

export const useAnalysisMapStore = defineStore('analysisMapStore', () => {
  // Single record for both totalPnts and currentPnts
  const pntData = ref<
    Record<string, { totalPnts: number; currentPnts: number; isLoading: boolean }>
  >({})
  const getPntDataByReqId = (reqId: string) => {
    if (!pntData.value[reqId]) {
      pntData.value[reqId] = { totalPnts: 0, currentPnts: 0, isLoading: false }
    }
    return pntData.value[reqId]
  }

  const filteredPntData = ref<Record<string, { currentPnts: number; isLoading: boolean }>>({})
  const getFilteredPntDataByReqId = (reqId: string) => {
    if (!filteredPntData.value[reqId]) {
      filteredPntData.value[reqId] = { currentPnts: 0, isLoading: false }
    }
    return filteredPntData.value[reqId]
  }
  const showTheTooltip = ref(true)
  const analysisMapInitialized = ref(false)
  const tooltipRef = ref()
  const map: ShallowRef<OLMap | null> = shallowRef(null)

  return {
    pntData,
    filteredPntData,
    getPntDataByReqId,
    getFilteredPntDataByReqId,
    showTheTooltip,
    analysisMapInitialized,
    tooltipRef,
    map
  }
})
