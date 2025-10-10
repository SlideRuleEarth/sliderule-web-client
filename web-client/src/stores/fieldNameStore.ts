import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useRecTreeStore } from '@/stores/recTreeStore'; // Adjust import path if needed
import { useChartStore } from './chartStore';
import { createDuckDbClient } from '@/utils/SrDuckDb';
import { db } from '@/db/SlideRuleDb';
import type { SrSvrParmsUsed } from '@/types/SrTypes';

const curGedi2apElFieldOptions = ref(['elevation_lm','elevation_hr']); 
const curGedi2apElevationField = ref('elevation_lm'); 

function getHFieldNameForAPIStr(funcStr: string): string {
    //console.log('getHFieldNameForAPIStr',funcStr);
    switch (funcStr) {
        case 'atl06': return 'h_mean';
        case 'atl06p': return 'h_mean';
        case 'atl06s': return 'h_li';
        case 'atl06sp': return 'h_li';
        case 'atl03vp': return 'segment_ph_cnt';
        case 'atl03sp': return 'height';
        case 'atl03x-surface': return 'h_mean';
        case 'atl03x-phoreal': return 'h_mean_canopy';
        case 'atl03x': return 'height';
        case 'atl08p': return 'h_mean_canopy';
        case 'atl24x': return 'ortho_h';
        case 'gedi02ap': return curGedi2apElevationField.value;
        case 'gedi04ap': return 'elevation';
        case 'gedi01bp': return 'elevation_start';
        case 'atl13x': return 'ht_ortho'; 
        default:
            console.trace(`Unknown height fieldname for API: ${funcStr} in getHFieldNameForAPIStr`);
            throw new Error(`Unknown height fieldname for API: ${funcStr} in getHFieldNameForAPIStr`);
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
        case 'atl03x-surface':
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
        case 'atl08p':
        case 'atl03x-phoreal':
            options = ['h_mean_canopy','h_max_canopy','h_te_median','cycle'];
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
            //throw new Error(`Unknown height fieldname for API: ${funcStr} in getDefaultElOptions`);
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

interface RecordInfo {
    time?: string;
    x: string;
    y: string;
    z?: string;
}

export const useFieldNameStore = defineStore('fieldNameStore', () => {
    const hFieldCache = ref<Record<number, string>>({});
    const latFieldCache = ref<Record<number, string>>({});
    const lonFieldCache = ref<Record<number, string>>({});
    const timeFieldCache = ref<Record<number, string>>({});
    const recordInfoCache = ref<Record<number, RecordInfo | null>>({});
    const asGeoCache = ref<Record<number, boolean>>({});

    const recTreeStore = useRecTreeStore();



    /**
     * Fetch recordinfo metadata from parquet file for a given reqId
     * This will cache the result to avoid repeated DB queries
     */
    async function getRecordInfoForReqId(reqId: number): Promise<RecordInfo | null> {
        //console.log(`getRecordInfoForReqId: reqId ${reqId}`);
        if (reqId <= 0) {
            console.warn(`Invalid reqId ${reqId} in getRecordInfoForReqId`);
            return null;
        }
        // Check cache first
        if (reqId in recordInfoCache.value) {
            return recordInfoCache.value[reqId];
        }

        try {
            // Get filename for this reqId
            const fileName = await db.getFilename(reqId);
            if (!fileName) {
                console.warn(`No filename found for reqId ${reqId}`);
                recordInfoCache.value[reqId] = null;
                return null;
            }

            // Get DuckDB client and read metadata
            const duckDb = await createDuckDbClient();
            await duckDb.insertOpfsParquet(fileName);
            const metadata = await duckDb.getAllParquetMetadata(fileName);

            if (metadata?.recordinfo) {
                const recordInfo: RecordInfo = JSON.parse(metadata.recordinfo);
                console.log(`Loaded recordinfo metadata for reqId ${reqId}:`, recordInfo);
                recordInfoCache.value[reqId] = recordInfo;
                return recordInfo;
            } else {
                console.log(`No recordinfo metadata found for reqId ${reqId}`);
                recordInfoCache.value[reqId] = null;
                return null;
            }
        } catch (error) {
            console.warn(`Error fetching recordinfo for reqId ${reqId}:`, error);
            recordInfoCache.value[reqId] = null;
            return null;
        }
    }

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
            console.error(`Field name lookup error for reqId ${reqId} funcStr: ${funcStr}:`, error);
            throw error;
        }
    }

    /**
     * Synchronous field name getters - these check recordinfo cache first (if pre-loaded),
     * then fall back to hardcoded values. Call loadMetaForReqId() first to populate cache.
     */
    function getHFieldName(reqId: number): string {
        // Check if we have recordinfo in cache
        const recordInfo = recordInfoCache.value[reqId];
        if (recordInfo && recordInfo.z) {
            hFieldCache.value[reqId] = recordInfo.z;
            return recordInfo.z;
        }
        console.warn(`No z field in recordinfo for reqId ${reqId}, falling back to hardcoded.`);
        // Fall back to hardcoded
        return getCachedValue(hFieldCache.value, reqId, getHFieldNameForAPIStr);
    }

    function getLatFieldName(reqId: number): string {
        // Check if we have recordinfo in cache
        const recordInfo = recordInfoCache.value[reqId];
        if (recordInfo && recordInfo.y) {
            latFieldCache.value[reqId] = recordInfo.y;
            return recordInfo.y;
        }
        console.warn(`No y field in recordinfo for reqId ${reqId}, falling back to hardcoded.`);
        // Fall back to hardcoded
        return getCachedValue(latFieldCache.value, reqId, getLatFieldNameForAPIStr);
    }

    function getLonFieldName(reqId: number): string {
        // Check if we have recordinfo in cache
        const recordInfo = recordInfoCache.value[reqId];
        if (recordInfo && recordInfo.x) {
            lonFieldCache.value[reqId] = recordInfo.x;
            return recordInfo.x;
        }
        console.warn(`No x field in recordinfo for reqId ${reqId}, falling back to hardcoded.`);
        // Fall back to hardcoded
        return getCachedValue(lonFieldCache.value, reqId, getLonFieldNameForAPIStr);
    }

    function getTimeFieldName(reqId: number): string {
        // Check if we have recordinfo in cache
        const recordInfo = recordInfoCache.value[reqId];
        if (recordInfo && recordInfo.time) {
            timeFieldCache.value[reqId] = recordInfo.time;
            return recordInfo.time;
        }
        console.warn(`No time field in recordinfo for reqId ${reqId}, falling back to hardcoded.`);
        // Fall back to hardcoded
        return getCachedValue(timeFieldCache.value, reqId, getTimeFieldNameForAPIStr);
    }

    /**
     * Load as_geo flag from server parameters for a given reqId
     * This checks the output.as_geo field from the request's server parameters
     */
    async function loadAsGeoFromSvrParams(reqId: number): Promise<void> {
        try {
            let svrParams = await db.getSvrParams(reqId);
            //console.log(`[fieldNameStore] loadAsGeoFromSvrParams for reqId ${reqId}:`, svrParams);
            //console.log(`[fieldNameStore] typeof svrParams:`, typeof svrParams);

            // If svrParams is a string, parse it
            if (typeof svrParams === 'string') {
                console.log(`[fieldNameStore] Parsing svrParams string for reqId ${reqId}`);
                svrParams = JSON.parse(svrParams);
            }

            const typedParams = svrParams as SrSvrParmsUsed;
            const asGeo = typedParams?.output?.as_geo === true;
            //console.log(`[fieldNameStore] reqId ${reqId} - output.as_geo = ${asGeo}`, typedParams?.output);
            asGeoCache.value[reqId] = asGeo;
            if (asGeo) {
                //console.log(`[fieldNameStore] Request ${reqId} has as_geo=true in server params`);
            }
        } catch (error) {
            console.warn(`[fieldNameStore] Error loading as_geo from server params for reqId ${reqId}:`, error);
            asGeoCache.value[reqId] = false;
        }
    }

    /**
     * Check if the parquet file for a given reqId is in GeoParquet format.
     * This checks the as_geo property from the server parameters.
     * Returns false if not cached.
     */
    function isGeoParquet(reqId: number): boolean {
        return asGeoCache.value[reqId] === true;
    }

    /**
     * Async function to pre-load recordinfo metadata for a reqId.
     * Call this early (e.g., after loading a parquet file) to populate the cache,
     * so that subsequent synchronous getters can use recordinfo values.
     */
    async function loadMetaForReqId(reqId: number): Promise<RecordInfo | null> {
        const recordInfo = await getRecordInfoForReqId(reqId);
        // Also load as_geo flag from server parameters
        await loadAsGeoFromSvrParams(reqId);
        return recordInfo;
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
        isGeoParquet,
        loadAsGeoFromSvrParams,
        // for debugging/testing
        hFieldCache,
        latFieldCache,
        lonFieldCache,
        timeFieldCache,
        recordInfoCache,
        asGeoCache,
        getRecordInfoForReqId,
        loadMetaForReqId,
    };
});
