import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useRecTreeStore } from '@/stores/recTreeStore'; // Adjust import path if needed
import { db } from '@/db/SlideRuleDb';
import type { SrMetaData, SrSvrParmsUsed } from '@/types/SrTypes';
import { useChartStore } from './chartStore';

function getHFieldNameForAPIStr(funcStr: string): string {
    switch (funcStr) {
        case 'atl06p': return 'h_mean';
        case 'atl06sp': return 'h_li';
        case 'atl03vp': return 'segment_ph_cnt';
        case 'atl03sp': return 'height';
        case 'atl03x': return 'height';
        case 'atl08p': return 'h_mean_canopy';
        case 'atl24x': return 'ortho_h';
        case 'gedi02ap': return 'elevation_hr';
        case 'gedi04ap': return 'agbd';
        case 'gedi01bp': return 'elevation_start';
        default:
            throw new Error(`Unknown height fieldname for API: ${funcStr} in getHFieldName`);
    }
}

function getDefaultElOptions(reqId:number): string[] {
    //We dont want to include all the fields in the file just the relavent ones
    
    //console.log(`getDefaultElOptions request for ${reqId}`);
    const funcStr = useRecTreeStore().findApiForReqId(reqId);
    let options=[] as string[];
    switch (funcStr) {
        case 'atl06p':  options = ['h_mean','rms_misfit','h_sigma','n_fit_photons','dh_fit_dx','pflags','w_surface_window_final','y_atc','cycle'];
            break;
        case 'atl06sp': options = ['h_li','y_atc','cycle'];
            break;
        case 'atl03vp': options = ['segment_ph_cnt'];
            break;
        case 'atl03sp': options = ['height','yapc_score','atl03_cnf','atl08_class','y_atc','cycle'];
            break;
        case 'atl03x':  options = ['height','yapc_score','atl03_cnf','y_atc','cycle'];
            break;
        case 'atl08p':  options = ['h_mean_canopy','h_max_canopy','h_te_median','cycle'];
            break;
        case 'atl24x':  options = ['ortho_h','confidence','y_atc','cycle'];
            break;
        case 'gedi02ap': options = ['elevation_hr'];
            break;
        case 'gedi04ap': options = ['agbd'];
            break;
        case 'gedi01bp': options = ['elevation_start'];
        default:
            console.error('Unknown funcStr:',funcStr)
            //throw new Error(`Unknown height fieldname for API: ${funcStr} in getHFieldName`);
            break;
    }
    const fieldNames = useChartStore().getElevationDataOptions(reqId.toString())
    if(fieldNames.includes('atl24_class')){
        console.log('getDefaultElOptions adding atl24_class, it is in fieldNames:',fieldNames);
        options.push('atl24_class');
    }
    if(fieldNames.includes('atl08_class')){
        console.log('getDefaultElOptions adding atl08_class, it is in fieldNames:',fieldNames);
        options.push('atl08_class');
    }
    console.log(`getDefaultElOptions request for ${reqId} funcStr:${funcStr} options:`,options);
    return options;
}

function getLatFieldNameForAPIStr(funcStr: string): string {
    return funcStr === 'atl24x' ? 'lat_ph' : 'latitude';
}

function getLonFieldNameForAPIStr(funcStr: string): string {
    return funcStr === 'atl24x' ? 'lon_ph' : 'longitude';
}

function getTimeFieldNameForAPIStr(funcStr: string): string {
    return ((funcStr === 'atl24x')||(funcStr === 'atl03x')) ? 'time_ns' : 'time';
}

function getDefaultColorEncoding(funcStr: string,parentFuncStr?:string): string {
    try {
        //console.log('getDefaultColorEncoding',funcStr,parentFuncStr);
        if (funcStr === 'atl03sp'){
            return 'atl03_cnf';
        } else if (funcStr === 'atl03x'){
            if(parentFuncStr === 'atl24x') return 'atl24_class';
            else return 'atl03_cnf';
        } else {
            return getHFieldNameForAPIStr(funcStr);
        } 
    }
    catch (error) {
        return 'solid';
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
