import { db } from '@/db/SlideRuleDb'; 
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { useMapStore } from '@/stores/mapStore';
import type { ElevationPlottable, } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';

import { duckDbReadAndUpdateElevationData,duckDbReadAndUpdateSelectedLayer, duckDbReadOrCacheSummary, getCycles, getRgts } from '@/utils/SrDuckDbUtils';

import type { SrRequestSummary } from '@/db/SlideRuleDb';

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

export const getTrackFieldname = async (req_id:number) => {
    const result = await db.getFunc(req_id);
    if (result.includes('atl06')) {
        return 'gt';
    } else if (result.includes('atl03')){
        return 'track';
    } else {
        throw new Error(`Unknown height fieldname for ${result} in getTrackFieldname`);
    }
}
export const readOrCacheSummary = async (req_id:number,height_fieldname:string) : Promise<SrRequestSummary | undefined> => {
    try{
        if (useSrParquetCfgStore().getParquetReader().name === 'duckDb') {
            return await duckDbReadOrCacheSummary(req_id,height_fieldname);    
        } else {
            throw new Error('readOrCacheSummary unknown reader');
        }
    } catch (error) {
        console.error('readOrCacheSummary error:',error);
        throw error;
    }
}

export const processFileForReq = async (req_id:number) => {
    try{
        console.log('processFileForReq req_id:',req_id);
        useMapStore().setIsLoading();

        if (useSrParquetCfgStore().getParquetReader().name === 'duckDb') {
            const maxNumPnts = useSrParquetCfgStore().maxNumPntsToDisplay;
            const chunkSize = useSrParquetCfgStore().chunkSizeToRead;
            await duckDbReadAndUpdateElevationData(req_id,chunkSize,maxNumPnts);

            // const rgts = await getRgts(req_id);
            // console.log('processFileForReq rgts:',rgts);
            // const cycles = await getCycles(req_id);
            // console.log('processFileForReq cycles:',cycles);

        } else {
            throw new Error('processFileForReq unknown reader');
        }
        useMapStore().resetIsLoading();
    } catch (error) {
        console.error('processFileForReq error:',error);
        throw error;
    }
}
export const addHighlightLayerForReq = async (req_id:number) => {
    try{
        console.log('addHighlightLayerForReq req_id:',req_id);

        if (useSrParquetCfgStore().getParquetReader().name === 'duckDb') {
            const maxNumPnts = useSrParquetCfgStore().maxNumPntsToDisplay;
            const chunkSize = useSrParquetCfgStore().chunkSizeToRead;
            await duckDbReadAndUpdateSelectedLayer(req_id,chunkSize,maxNumPnts);
        } else {
            throw new Error('addHighlightLayerForReq unknown reader');
        }
    } catch (error) {
        console.error('addHighlightLayerForReq error:',error);
        throw error;
    }
}
export async function calculateChecksumFromOpfs(fileHandle: FileSystemFileHandle): Promise<bigint> {
    const file = await fileHandle.getFile();
    const reader = file.stream().getReader();
    let checksum = 0;

    try {
        let readResult = await reader.read(); // Initial read
        while (!readResult.done) {
            const value = readResult.value;
            if (value) {
                for (let i = 0; i < value.length; i++) {
                    checksum += value[i];
                }
            }
            readResult = await reader.read(); // Read next chunk
        }
    } catch (error) {
        console.error('Error reading file:', error);
        throw error;
    } finally {
        reader.releaseLock();
    }

    return BigInt(checksum);
}
export const formatBytes = (bytes:number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
