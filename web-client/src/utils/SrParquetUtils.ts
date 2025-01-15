import { db } from '@/db/SlideRuleDb'; 
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { useMapStore } from '@/stores/mapStore';
import type { ElevationPlottable, } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';

import { duckDbReadOrCacheSummary } from '@/utils/SrDuckDbUtils';

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
        const folderName = 'SlideRule'; 
        const directoryHandle = await opfsRoot.getDirectoryHandle(folderName, { create: true });
        directoryHandle.removeEntry(filename);
        console.log('deleteOpfsFile Successfully deleted:',filename);
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

export function getHFieldName(funcStr:string) {
    if (funcStr === 'atl06p') {
        return 'h_mean';
    } else if (funcStr === 'atl06sp') {
        return 'h_li';
    } else if (funcStr=== 'atl03vp'){
        return 'segment_ph_cnt';
    } else if (funcStr=== 'atl03sp'){
        return 'height';
    } else if (funcStr==='atl08p'){
        return 'h_mean_canopy';
    } else if (funcStr===('gedi02ap')) {
        return 'elevation_hr';
    } else if (funcStr===('gedi04ap')) {
        return 'agbd';
    } else if(funcStr===('gedi01bp')) {
        return 'elevation_start';
    } else {
        throw new Error(`Unknown height fieldname for ${funcStr} in getHFieldName`);
    }
}

export async function getDefaultElOptions(reqIdStr:string) : Promise<string[]>{
    try{
        const req_id = parseInt(reqIdStr);
        const funcStr = await db.getFunc(req_id);
        if (funcStr === 'atl06p') {
            return ['h_mean','rms_misfit','h_sigma'];
        } else if (funcStr === 'atl06sp') {
            return ['h_li'];
        } else if (funcStr=== 'atl03vp'){
            return ['segment_ph_cnt'];
        } else if (funcStr=== 'atl03sp'){
            return ['height'];
        } else if (funcStr==='atl08p'){
            return ['h_mean_canopy'];
        } else if (funcStr===('gedi02ap')) {
            return ['elevation_hr'];
        } else if (funcStr===('gedi04ap')) {
            return ['agbd'];
        } else if(funcStr===('gedi01bp')) {
            return ['elevation_start'];
        } else {
            throw new Error(`Unknown height fieldname for ${funcStr} in getHFieldName`);
        }  
    } catch (error) {
        console.error('getDefaultElOptions error:',error);
        throw error;  
    }
}
export const getHeightFieldname = async (req_id:number) => {
    const result = await db.getFunc(req_id);
    return getHFieldName(result);
}

export const getTrackFieldname = async (req_id:number) => {
    const result = await db.getFunc(req_id);
    if (result.includes('atl06')) {
        return 'gt';
    } else if (result === 'atl03sp'){
        return 'track';
    } else {
        throw new Error(`Unknown height fieldname for ${result} in getTrackFieldname`);
    }
}

export const readOrCacheSummary = async (req_id:number) : Promise<SrRequestSummary | undefined> => {
    try{
        if (useSrParquetCfgStore().getParquetReader().name === 'duckDb') {
            const func = await db.getFunc(req_id);
            const height_fieldname = getHFieldName(func);
            return await duckDbReadOrCacheSummary(req_id,height_fieldname);    
        } else {
            throw new Error('readOrCacheSummary unknown reader');
        }
    } catch (error) {
        console.error('readOrCacheSummary error:',error);
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

export function updateFilename(req_id: number, filename: string): { func: string, newFilename: string } {
    // This function replaces external rec_id in the filename with the newly created req_id that matches this applications db
    // i.e.
    // <atl0n>_<external_rec_id>_<date>.parquet with <atl0n>_<newly_created_req_id>_<date>.parquet in the filename

    // Regular expression to match the required pattern
    const regex = /^(\w+)_(\d+)_(.+\.parquet)$/;

    // Apply the regex to the filename
    const match = filename.match(regex);

    if (!match) {
        throw new Error("Invalid filename format");
    }

    // Extract the func, old req_id, and suffix
    const func = match[1];
    const suffix = match[3];

    // Construct the new filename
    const newFilename = `${func}_${req_id}_${suffix}`;
    console.warn('updateFilename req_id:',req_id,'filename:',filename,'newFilename:',newFilename);
    return { func, newFilename };
}

export function elIsLoaded():boolean {
   return (
        (useMapStore().getTotalRows() > 0) &&
        (   (useMapStore().getCurrentRows() >= useMapStore().getTotalRows()) ||
            (useMapStore().getCurrentRows() >= useSrParquetCfgStore().getMaxNumPntsToDisplay())
        )
    );
}

export const nukeSlideRuleFolder = async () => {
    const folderName = 'SlideRule';
    let opfsRoot: FileSystemDirectoryHandle;

    try {
        // Get the root directory handle
        opfsRoot = await navigator.storage.getDirectory();
    } catch (error) {
        console.error('nukeSlideRuleFolder: Error retrieving root directory', error);
        throw error;
    }

    try {
        // Attempt to remove the SlideRule folder; if it doesn't exist, we'll catch that
        await opfsRoot.removeEntry(folderName, { recursive: true });
        console.log(`nukeSlideRuleFolder: "${folderName}" folder removed`);
    } catch (error: any) {
        // If the folder doesn't exist, it's typically a "NotFoundError" or similar
        if (error.name === 'NotFoundError') {
            console.warn(`nukeSlideRuleFolder: "${folderName}" folder not found, ignoring...`);
        } else {
            console.error('nukeSlideRuleFolder: Error removing folder', error);
            throw new Error(`Failed to remove folder: ${error}`);
        }
    }

    try {
        // Recreate the SlideRule folder
        await opfsRoot.getDirectoryHandle(folderName, { create: true });
        console.log(`nukeSlideRuleFolder: "${folderName}" folder re-created`);
    } catch (error) {
        console.error(`nukeSlideRuleFolder: Error re-creating "${folderName}" folder`, error);
        throw new Error(`Failed to re-create the folder: ${folderName}, error: ${error}`);
    }
};
