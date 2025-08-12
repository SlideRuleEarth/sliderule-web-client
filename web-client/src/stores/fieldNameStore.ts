import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useRecTreeStore } from '@/stores/recTreeStore'; // Adjust import path if needed
import { useChartStore } from './chartStore';

const curGedi2apElFieldOptions = ref(['elevation_lm','elevation_hr']); 
const curGedi2apElevationField = ref('elevation_lm'); 

function getHFieldNameForAPIStr(funcStr: string): string {
    switch (funcStr) {
        case 'atl06': return 'h_mean';
        case 'atl06p': return 'h_mean';
        case 'atl06s': return 'h_li';
        case 'atl06sp': return 'h_li';
        case 'atl03vp': return 'segment_ph_cnt';
        case 'atl03sp': return 'height';
        case 'atl03x': return 'height';
        case 'atl08p': return 'h_mean_canopy';
        case 'atl24x': return 'ortho_h';
        case 'gedi02ap': return curGedi2apElevationField.value;
        case 'gedi04ap': return 'elevation';
        case 'gedi01bp': return 'elevation_start';
        case 'atl13x': return 'ht_ortho'; 
        default:
            console.trace(`Unknown height fieldname for API: ${funcStr} in getHFieldName`);
            throw new Error(`Unknown height fieldname for API: ${funcStr} in getHFieldName`);
    }
}

function getMissionFromApiStr(apiStr: string): string {
    if (apiStr.startsWith('atl'))return 'ICESat-2';
    else if (apiStr.startsWith('gedi'))return 'GEDI';
    else throw new Error(`Unknown mission for API: ${apiStr} in getMissionFromApiStr`);    
}

function getMissionForReqId(reqId: number): string {
    if (reqId <= 0) return 'ICESat-2'; // Default to ICESat-2 for invalid reqId
    const funcStr = useRecTreeStore().findApiForReqId(reqId);
    if(funcStr){
        return getMissionFromApiStr(funcStr);
    } else {
        console.warn(`No API found for reqId:${reqId} funcStr:${funcStr} in getMissionForReqId`);
        return 'ICESat-2'; // Default to ICESat-2 if no API found
    }
}


function getDefaultElOptions(reqId:number): string[] {
    //We dont want to include all the fields in the file just the relavent ones
    
    //console.log(`getDefaultElOptions request for ${reqId}`);
    const funcStr = useRecTreeStore().findApiForReqId(reqId);
    let options=[] as string[];
    switch (funcStr) {
        case 'atl06':
        case 'atl06p':
            options = ['h_mean','rms_misfit','h_sigma','n_fit_photons','dh_fit_dx','pflags','w_surface_window_final','y_atc','cycle'];
            break;
        case 'atl06s':
        case 'atl06sp':
            options = ['h_li','y_atc','cycle'];
            break;
        case 'atl03vp': options = ['segment_ph_cnt'];
            break;
        case 'atl03sp': options = ['height','atl03_cnf','atl08_class','y_atc','cycle'];
            break;
        case 'atl03x':  options = ['height','atl03_cnf','y_atc','cycle','srcid','yapc_score'];
            break;
        case 'atl08p':  options = ['h_mean_canopy','h_max_canopy','h_te_median','cycle'];
            break;
        case 'atl24x':  options = ['ortho_h','confidence','class_ph','y_atc','cycle','srcid'];
            break;
        case 'atl13x':  options = ['ht_ortho','ht_water_surf','stdev_water_surf','water_depth','cycle','srcid'];
            break
        case 'gedi02ap': options = ['elevation_lm', 'elevation_hr', 'track', 'beam', 'orbit'];
            break;
        case 'gedi04ap': options = ['elevation', 'track', 'beam', 'orbit'];
            break;
        case 'gedi01bp': options = ['elevation_start', 'track', 'beam', 'orbit'];
            break;
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
    console.log('getTimeFieldNameForAPIStr',funcStr);
    return (funcStr.includes('x') ? 'time_ns' : 'time');
}

function getUniqueTrkFieldNameForAPIStr(funcStr: string): string {
    if(funcStr.includes('atl')) {
        return 'rgt';
    } else if(funcStr.includes('gedi')) {
        // GEDI APIs have different field names for track
        return 'track';
    } else {
        throw new Error(`Unknown rgt/track fieldname for API: ${funcStr} in getUniqueTrkFieldName`);
    }
}

function getUniqueTrkFieldName(reqId: number): string {
    const funcStr = useRecTreeStore().findApiForReqId(reqId);
    try {
        const field = getUniqueTrkFieldNameForAPIStr(funcStr);
        return field;
    } catch (error) {
        console.error(`Field name lookup error for reqId ${reqId}:`, error);
        throw error;
    }
}

function getUniqueOrbitIdFieldNameForAPIStr(funcStr: string): string {
    if(funcStr.includes('atl')) {
        return 'cycle';
    } else if(funcStr.includes('gedi')) {
        return 'orbit';
    } else {
        throw new Error(`Unknown UniqueOrbitId fieldname for API: ${funcStr} in getUniqueOrbitIdFieldName`);
    }
}
function getUniqueOrbitIdFieldName(reqId: number): string {
    const funcStr = useRecTreeStore().findApiForReqId(reqId);
    try {
        const field = getUniqueOrbitIdFieldNameForAPIStr(funcStr);
        return field;
    } catch (error) {
        console.error(`Field name lookup error for reqId ${reqId}:`, error);
        throw error;
    }
}

function getUniqueSpotIdFieldNameForAPIStr(funcStr: string): string {
    if(funcStr.includes('atl')) {
        return 'spot';
    } else if(funcStr.includes('gedi')) {
        return 'beam';
    } else{
        throw new Error(`Unknown UniqueSpotId fieldname for API: ${funcStr} in getUniqueSpotIdFieldName`);
    }
}
function getUniqueSpotIdFieldName(reqId: number): string {
    const funcStr = useRecTreeStore().findApiForReqId(reqId);
    try {
        const field = getUniqueSpotIdFieldNameForAPIStr(funcStr);
        return field;
    } catch (error) {
        console.error(`Field name lookup error for reqId ${reqId}:`, error);
        throw error;
    }
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
        console.error(`getDefaultColorEncoding error for funcStr ${funcStr}:`, error);
        return 'solid';
    }
}

export const useFieldNameStore = defineStore('fieldNameStore', () => {
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
        getMissionForReqId,
        getMissionFromApiStr,
        getUniqueTrkFieldName,
        getUniqueOrbitIdFieldName,
        getUniqueSpotIdFieldName,
        curGedi2apElFieldOptions,
        curGedi2apElevationField,
        // for debugging/testing
        hFieldCache,
        latFieldCache,
        lonFieldCache,
        timeFieldCache,
    };
});
