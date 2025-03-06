import { defineStore } from 'pinia'
import { ref } from 'vue'
import { type ApiName } from '@/types/SrTypes'


export const useAreaThresholdsStore = defineStore('areaThresholdStore', () => {
    // State: maps an API name to a numeric threshold
    const areaErrorThreshold = ref<Record<ApiName, number>>({
        atl06p: 10000,
        atl06sp: 10000,
        atl08sp: 10000,
        atl03sp: 350,
        atl03vp: 350,
        gedi01bp: 350,//TBD find out what to use for Gedi this is a placeholder 
        gedi02ap: 350,
        gedi04ap: 350,
    })
    const areaErrorThresholdFallback = ref<number>(350)

    const areaWarningThreshold = ref<Record<ApiName, number>>({
        atl06p: 5000,
        atl06sp: 5000,
        atl08sp: 5000,
        atl03sp: 100,
        atl03vp: 100,
        gedi01bp: 350,//TBD find out what to use for Gedi this is a placeholder 
        gedi02ap: 350,
        gedi04ap: 350,
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
