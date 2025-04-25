import { defineStore } from 'pinia'
import { ref } from 'vue'
import { type ApiName } from '@/types/SrTypes'


export const useAreaThresholdsStore = defineStore('areaThresholdStore', () => {
    // State: maps an API name to a numeric threshold
    const areaErrorThreshold = ref<Record<ApiName, number>>({
        atl06p: 10000,
        atl06sp: 10000,
        atl08p: 10000,
        atl03sp: 350,
        atl03x: 350,
        atl03vp: 350,
        atl24x:  1000,
        gedi01bp: 200,
        gedi02ap: 10000,
        gedi04ap: 10000,
    })
    const areaErrorThresholdFallback = ref<number>(350)

    const areaWarningThreshold = ref<Record<ApiName, number>>({
        atl06p: 5000,
        atl06sp: 5000,
        atl08p: 5000,
        atl03sp: 100,
        atl03x: 100,
        atl03vp: 100,
        atl24x:  750,
        gedi01bp: 100,
        gedi02ap: 5000,
        gedi04ap: 5000,
    })
    const areaWarningThresholdFallback = ref<number>(100)

    // Actions to update thresholds with validation
    function setAreaErrorThreshold(api: ApiName, threshold: number) {
        if (threshold >= 0) {
            areaErrorThreshold.value = { ...areaErrorThreshold.value, [api]: threshold }
        } else {
            console.warn(`Invalid threshold value for ${api}: must be non-negative.`)
        }
    }

    function setAreaWarningThreshold(api: ApiName, threshold: number) {
        if (threshold >= 0) {
            areaWarningThreshold.value = { ...areaWarningThreshold.value, [api]: threshold }
        } else {
            console.warn(`Invalid threshold value for ${api}: must be non-negative.`)
        }
    }

    // Getters to retrieve thresholds with fallback
    function getAreaErrorThreshold(api: ApiName): number {
        return areaErrorThreshold.value[api] ?? areaErrorThresholdFallback.value
    }

    function getAreaWarningThreshold(api: ApiName): number {
        return areaWarningThreshold.value[api] ?? areaWarningThresholdFallback.value
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
