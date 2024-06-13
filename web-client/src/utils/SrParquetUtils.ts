import { db } from '@/db/SlideRuleDb'; 
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import type { ElevationPlottable, } from '@/db/SlideRuleDb';
import { hyparquetReadAndUpdateElevationData,hyparquetReadOrCacheSummary } from '@/utils/SrHyparquetUtils';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { duckDbReadAndUpdateElevationData, duckDbReadOrCacheSummary } from '@/utils/SrDuckDbUtils';
import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { duckDbClient } from '@/utils/SrDuckDbUtils';

function mapToJsType(type: string | undefined): string {
    switch (type) {
        case "BOOLEAN":
            return "boolean";
        case "INT32":
        case "INT64":
        case "INT96":
        case "UINT_8":
        case "UINT_16":
        case "UINT_32":
        case "UINT_64":
        case "INT_8":
        case "INT_16":
        case "INT_32":
        case "INT_64":
        case "FLOAT":
        case "DOUBLE":
            return "number";
        case "BYTE_ARRAY":
        case "FIXED_LEN_BYTE_ARRAY":
        case "UTF8":
        case "ENUM":
        case "JSON":
        case "BSON":
            return "string";
        case "DECIMAL":
            return "string"; // Can also be a number, depending on usage
        case "DATE":
        case "TIME_MILLIS":
        case "TIME_MICROS":
        case "TIMESTAMP_MILLIS":
        case "TIMESTAMP_MICROS":
            return "Date";
        case "MAP":
        case "LIST":
            return "object";
        case "INTERVAL":
            return "string"; // Custom type, could be represented in various ways
        default:
            return "unknown";
    }
}

interface TreeNode {
    count: number;
    element?: {
        type?: string;
    };
    children: TreeNode[];
    path: string[];
}

export interface SrParquetPathTypeJsType {
    path: string[];
    type: string;
    jstype: string;
}

interface SrFieldAndType {
    field: string;
    type: string;
}

export function recurseTree(node: TreeNode): SrParquetPathTypeJsType[] {
    const results: SrParquetPathTypeJsType[] = [];

    function traverse(node: TreeNode, currentPath: string[]): void {
        if ((node.path.length>0) && node.element) { // skips root with no path
            results.push({
                path: [...currentPath, ...(node.path || [])],
                type: node.element.type || "UNKNOWN",
                jstype: mapToJsType(node.element.type)
            });
        }

        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                traverse(child, [...currentPath, ...(node.path || [])]);
            });
        }
    }

    traverse(node, []);
    return results;
}

export function getFieldTypes(fieldAndType: SrParquetPathTypeJsType[]):SrFieldAndType[] {
    return fieldAndType.map((f) => {
        return {field: f.path.join('.'), type: f.jstype};
    });
}

export function getFieldNames(fieldAndType: SrParquetPathTypeJsType[]):string[] {
    return fieldAndType.map((f) => f.path.join('.'));
}   

export function findHeightNdx(fieldAndType: SrParquetPathTypeJsType[],height_fieldname:string):number {
    return fieldAndType.findIndex((f) => f.path.join('.').includes(height_fieldname));
}

export function findLongNdx(fieldAndType: SrParquetPathTypeJsType[]):number {   
    return fieldAndType.findIndex((f) => f.path.join('.').includes('longitude'));
}

export function findLatNdx(fieldAndType: SrParquetPathTypeJsType[]):number {
    return fieldAndType.findIndex((f) => f.path.join('.').includes('latitude'));
}

export function getTypes(fieldAndType: SrParquetPathTypeJsType[]):string[] {
    return fieldAndType.map((f) => f.jstype);
}

export const deleteOpfsFile = async (filename:string) => {
    try{
        console.log('deleteOpfsFile filename:',filename);
        if (!filename) {
            console.error('deleteOpfsFile filename is undefined');
            return;
        }
        const opfsRoot = await navigator.storage.getDirectory();
        opfsRoot.removeEntry(filename);
    } catch (error) {
        const errorMsg = `Failed to delete file: ${filename} error: ${error}`;
        console.error('deleteOpfsFile error:',errorMsg);
        throw new Error(errorMsg);
    }
}

export function updateExtremeLatLon(elevationData:ElevationPlottable[],
                                    localExtLatLon: ExtLatLon,
                                    localExtHMean: ExtHMean): {extLatLon:ExtLatLon,extHMean:ExtHMean} {
    elevationData.forEach(d => {
        if (d[2] < localExtHMean.minHMean) {
            localExtHMean.minHMean = d[2];
        }
        if (d[2] > localExtHMean.maxHMean) {
            localExtHMean.maxHMean = d[2];
        }
        if (d[2] < localExtHMean.lowHMean) { // TBD fix this
            localExtHMean.lowHMean = d[2];
        }
        if (d[2] > localExtHMean.highHMean) { // TBD fix this
            localExtHMean.highHMean = d[2];
        }
        if (d[1] < localExtLatLon.minLat) {
            localExtLatLon.minLat = d[1];
        }
        if (d[1] > localExtLatLon.maxLat) {
            localExtLatLon.maxLat = d[1];
        }
        if (d[0] < localExtLatLon.minLon) {
            localExtLatLon.minLon = d[0];
        }
        if (d[0] > localExtLatLon.maxLon) {
            localExtLatLon.maxLon = d[0];
        }
    });
    return {extLatLon:localExtLatLon,extHMean:localExtHMean};
}


        // This might be used if the metadata contains statistics for the columns

        //const latMinMax = await getColumnMinMaxFromMeta(metadata, latNdx);
        //const lonMinMax = await getColumnMinMaxFromMeta(metadata, lonNdx);
        // const extLatLon = {
        //     minLat: latMinMax.min,
        //     maxLat: latMinMax.max,
        //     minLon: lonMinMax.min,
        //     maxLon: lonMinMax.max
        // };
        // const hMeanMinMax = await getColumnMinMaxFromMeta(metadata, hMeanNdx);
        // const extHMean = {
        //     minHMean: hMeanMinMax.min,
        //     maxHMean: hMeanMinMax.max,
        //     lowHMean: hMeanMinMax.min, // TBD: get 5th percentile?
        //     highHMean: hMeanMinMax.max // TBD: get 95th percentile?
        // };

export const getHeightFieldname = async (req_id:number) => {
    const result = await db.getFunc(req_id);
    if (result.includes('atl06')) {
        return 'h_mean';
    } else if (result.includes('atl03')){
        return 'height';
    } else {
        throw new Error(`Unknown height fieldname for ${result} in getHeightFieldname`);
    }
}

export const readOrCacheSummary = async (req_id:number,height_fieldname:string) : Promise<SrRequestSummary | undefined> => {
    try{
        if(useSrParquetCfgStore().getParquetReader().name === 'hyparquet'){
            return await hyparquetReadOrCacheSummary(req_id,height_fieldname);
        } else if (useSrParquetCfgStore().getParquetReader().name === 'duckDb') {
            return await duckDbReadOrCacheSummary(req_id,height_fieldname);    
        } else {
            throw new Error('readAndUpdateElevationData unknown reader');
        }
    } catch (error) {
        console.error('readAndUpdateElevationData error:',error);
        throw error;
    }
}

export const readAndUpdateElevationData = async (req_id:number) => {
    try{
        console.log('readAndUpdateElevationData req_id:',req_id);
        if(useSrParquetCfgStore().getParquetReader().name === 'hyparquet'){
            hyparquetReadAndUpdateElevationData(req_id);
        } else if (useSrParquetCfgStore().getParquetReader().name === 'duckDb') {
            duckDbReadAndUpdateElevationData(req_id);
            const tbls = await duckDbClient.describeTables();
            console.log('readAndUpdateElevationData tbls:',tbls);
            const cols = duckDbClient.describeColumns(tbls[0].name);
            console.log('readAndUpdateElevationData cols:',cols);
        } else {
            throw new Error('readAndUpdateElevationData unknown reader');
        }
    } catch (error) {
        console.error('readAndUpdateElevationData error:',error);
        throw error;
    }
}
