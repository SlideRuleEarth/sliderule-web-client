import { defineStore } from 'pinia'
import { ref } from 'vue'
import { type ApiName } from '@/types/SrTypes'
import { createLogger } from '@/utils/logger';

const logger = createLogger('AreaThresholdsStore');


export const useAreaThresholdsStore = defineStore('areaThresholdStore', () => {
    // State: maps an API name to a numeric threshold
    const areaErrorThreshold = ref<Record<ApiName, number>>({
        atl06: 15000,
        atl06p: 15000,
        atl06sp: 10000,
        atl08: 10000,
        atl08p: 10000,
        atl03sp: 350,
        atl03x: 350,
        atl03vp: 350,
        'atl03x-surface': 15000,
        'atl03x-phoreal': 10000,
        atl13x: 10000,
        atl24x:  1000,
        gedi01bp: 200,
        gedi02ap: 10000,
        gedi04ap: 10000,
    })
    const areaErrorThresholdFallback = ref<number>(350)

    const areaWarningThreshold = ref<Record<ApiName, number>>({
        atl06: 10000,
        atl06p: 10000,
        atl06sp: 7500,
        atl08: 8000,
        atl08p: 8000,
        atl03sp: 100,
        atl03x: 100,
        atl03vp: 100,
        'atl03x-surface': 12000,
        'atl03x-phoreal': 7500,
        atl13x: 10000,
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
            logger.warn('Invalid threshold value for api: must be non-negative', { api, threshold })
        }
    }

    function setAreaWarningThreshold(api: ApiName, threshold: number) {
        if (threshold >= 0) {
            areaWarningThreshold.value = { ...areaWarningThreshold.value, [api]: threshold }
        } else {
            logger.warn('Invalid threshold value for api: must be non-negative', { api, threshold })
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
