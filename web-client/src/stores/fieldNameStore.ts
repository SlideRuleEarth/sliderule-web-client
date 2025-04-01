import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useRecTreeStore } from '@/stores/recTreeStore'; // Adjust import path if needed
import { get } from 'lodash';

function getHFieldNameForAPIStr(funcStr: string): string {
    switch (funcStr) {
        case 'atl06p': return 'h_mean';
        case 'atl06sp': return 'h_li';
        case 'atl03vp': return 'segment_ph_cnt';
        case 'atl03sp': return 'height';
        case 'atl08p': return 'h_mean_canopy';
        case 'atl24x': return 'ortho_h';
        case 'gedi02ap': return 'elevation_hr';
        case 'gedi04ap': return 'agbd';
        case 'gedi01bp': return 'elevation_start';
        default:
            throw new Error(`Unknown height fieldname for API: ${funcStr} in getHFieldName`);
    }
}

function getDefaultElOptions(funcStr: string): string[] {
    switch (funcStr) {
        case 'atl06p': return ['h_mean','rms_misfit','h_sigma','n_fit_photons','dh_fit_dx','pflags','w_surface_window_final','y_atc','cycle'];
        case 'atl06sp': return ['h_li','y_atc','cycle'];
        case 'atl03vp': return ['segment_ph_cnt'];
        case 'atl03sp': return ['height','yapc_score','atl03_cnf','atl08_class','y_atc','cycle'];
        case 'atl08p': return ['h_mean_canopy','y_atc','cycle'];
        case 'atl24x': return ['ortho_h','y_atc','cycle'];
        case 'gedi02ap': return['elevation_hr'];
        case 'gedi04ap': return  ['agbd'];
        case 'gedi01bp': return ['elevation_start'];
        default:
            throw new Error(`Unknown height fieldname for API: ${funcStr} in getHFieldName`);
    }
}

function getLatFieldNameForAPIStr(funcStr: string): string {
    return funcStr === 'atl24x' ? 'lat_ph' : 'latitude';
}

function getLonFieldNameForAPIStr(funcStr: string): string {
    return funcStr === 'atl24x' ? 'lon_ph' : 'longitude';
}

function getTimeFieldNameForAPIStr(funcStr: string): string {
    return funcStr === 'atl24x' ? 'time_ns' : 'time';
}

function getDefaultColorEncoding(funcStr: string): string {
    try{
       return getHFieldNameForAPIStr(funcStr); 
    }
    catch (error) {
        return 'h_mean';
    }
}

export const useFieldNameCacheStore = defineStore('fieldNameCache', () => {
    const hFieldCache = ref<Record<number, string>>({});
    const latFieldCache = ref<Record<number, string>>({});
    const lonFieldCache = ref<Record<number, string>>({});
    const timeFieldCache = ref<Record<number, string>>({});

    const recTreeStore = useRecTreeStore();

    function getCachedValue(
        cache: Record<number, string>,
        reqId: number,
        getField: (funcStr: string) => string
    ): string {
        if (cache[reqId]) return cache[reqId];
        const funcStr = recTreeStore.findApiForReqId(reqId);
        try {
            const field = getField(funcStr);
            cache[reqId] = field;
            return field;
        } catch (error) {
            console.error(`Field name lookup error for reqId ${reqId}:`, error);
            throw error;
        }
    }

    function getHFieldName(reqId: number): string {
        return getCachedValue(hFieldCache.value, reqId, getHFieldNameForAPIStr);
    }

    function getLatFieldName(reqId: number): string {
        return getCachedValue(latFieldCache.value, reqId, getLatFieldNameForAPIStr);
    }

    function getLonFieldName(reqId: number): string {
        return getCachedValue(lonFieldCache.value, reqId, getLonFieldNameForAPIStr);
    }

    function getTimeFieldName(reqId: number): string {
        return getCachedValue(timeFieldCache.value, reqId, getTimeFieldNameForAPIStr);
    }

    return {
        getHFieldName,
        getLatFieldName,
        getLonFieldName,
        getTimeFieldName,
        getDefaultColorEncoding,
        getDefaultElOptions,
        // for debugging/testing
        hFieldCache,
        latFieldCache,
        lonFieldCache,
        timeFieldCache,
    };
});
