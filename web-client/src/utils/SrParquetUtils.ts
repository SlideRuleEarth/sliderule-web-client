import { parquetMetadata, parquetSchema, type FileMetaData } from 'hyparquet'
import { db } from '@/db/SlideRuleDb'; 
import { parquetRead } from 'hyparquet';
import { updateElLayer } from '@/utils/SrMapUtils';
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { useCurAtl06ReqSumStore } from '@/stores/curAtl06ReqSumStore';
import type { ExtLatLon,ExtHMean } from '@/workers/workerUtils';
import type { SrRequestSummary } from '@/db/SlideRuleDb';
import type { ElevationPlottable } from '@/db/SlideRuleDb';

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


// async function getColumnMinMaxFromMeta(metadata: FileMetaData, columnIndex: number): Promise<{ min: any, max: any }> {
//     let globalMin: any = null;
//     let globalMax: any = null;
//     console.log('getColumnMinMaxFromMeta metadata:',metadata,' columnIndex:',columnIndex);
//     for (let rowGroupIndex = 0; rowGroupIndex < metadata.row_groups.length; rowGroupIndex++) {
//         const rowGroup = metadata.row_groups[rowGroupIndex];
//         const columnChunk = rowGroup.columns[columnIndex];
//         console.log("getColumnMinMaxFromMeta rowGroupIndex:",rowGroupIndex," columnChunk:",columnChunk)
//         if (columnChunk.meta_data) {
//             const stats = columnChunk.meta_data.statistics;
//             if (stats) {
//                 const colMin = stats.min_value;
//                 const colMax = stats.max_value;
//                 if (colMin !== undefined && colMin !== null) {
//                     if (globalMin === null || colMin < globalMin) {
//                         globalMin = colMin;
//                     }
//                 } else {
//                     console.warn(`Row group ${rowGroupIndex}, column ${columnIndex}: min_value is undefined or null`);
//                 }
//                 if (colMax !== undefined && colMax !== null) {
//                     if (globalMax === null || colMax > globalMax) {
//                         globalMax = colMax;
//                     }
//                 } else {
//                     console.warn(`Row group ${rowGroupIndex}, column ${columnIndex}: max_value is undefined or null`);
//                 }
//             } else {
//                 console.warn(`Row group ${rowGroupIndex}, column ${columnIndex}: statistics is undefined`);
//             }
//         } else {
//             console.warn(`Row group ${rowGroupIndex}, column ${columnIndex}: meta_data is undefined`);
//         }
//     }

//     if (globalMin === null || globalMax === null) {
//         throw new Error(`Unable to determine min and/or max values for column index ${columnIndex}`);
//     }

//     return { min: globalMin, max: globalMax };
// }

export const deleteOpfsFile = async (filename:string) => {
    try{
        console.log('deleteOpfsFile filename:',filename);
        if (!filename) {
            console.error('deleteOpfsFile metadata is undefined');
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

function updateExtremeLatLon(   elevationData:ElevationPlottable[],
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

export async function readOrCacheSummary(req_id:number,height_fieldname:string) : Promise<SrRequestSummary | undefined>{
    const opfsRoot = await navigator.storage.getDirectory();
    const filename = await db.getFilename(req_id);
    const fileHandle = await opfsRoot.getFileHandle(filename, { create: false });
    const file1 = await fileHandle.getFile();
    const arrayBuffer = await file1.arrayBuffer(); // Convert the file to an ArrayBuffer
    const summary = await db.getWorkerSummary(req_id);
    if (summary) {
        return summary;
    } else {

        let localExtLatLon = {minLat: 90, maxLat: -90, minLon: 180, maxLon: -180} as ExtLatLon;
        let localExtHMean = {minHMean: 100000, maxHMean: -100000, lowHMean: 100000, highHMean: -100000} as ExtHMean;
        const chunkSize = 200000;
        let rowStart = 0;
        let rowEnd = chunkSize;
        let hasMoreData = true;
        while (hasMoreData) { // First find extreme values for legend
            await parquetRead({
                file: arrayBuffer,
                columns: ['longitude', 'latitude', height_fieldname],
                rowStart: rowStart,
                rowEnd: rowEnd,
                onComplete: data => {
                    //console.log('data.length:',data.length,'data:', data);
                    const updatedExtremes = updateExtremeLatLon(data as [any,any,any], localExtLatLon, localExtHMean);
                    localExtLatLon = updatedExtremes.extLatLon;
                    localExtHMean = updatedExtremes.extHMean;
                    hasMoreData = data.length === chunkSize;
                }
            });
            rowStart += chunkSize;
            rowEnd += chunkSize;
        }
        await db.addNewSummary({req_id:req_id, extLatLon: localExtLatLon, extHMean: localExtHMean});
        return await db.getWorkerSummary(req_id);
    }
}

export const readOpsfFileMetadata = async (height_fieldname:string, arrayBuffer:ArrayBuffer) => {
    try{
        const metadata = parquetMetadata(arrayBuffer);

        console.log('processOpfsFile metadata:',metadata);
        const schema = parquetSchema(metadata);
        console.log('processOpfsFile schema:',schema);

        const allFieldNameTypes = recurseTree(schema);
        const allFieldNames = getFieldNames(allFieldNameTypes);
        const lonNdx = findLongNdx(allFieldNameTypes);
        const latNdx = findLatNdx(allFieldNameTypes);
        const hMeanNdx = findHeightNdx(allFieldNameTypes,height_fieldname);
        console.log('readAndUpdateElevationData lonNdx:',lonNdx,' latNdx:',latNdx,' hMeanNdx:',hMeanNdx);
        return {allFieldNames, hMeanNdx, latNdx, lonNdx};
    } catch (error) { 
        const errorMsg = `readOpsfFileMetadata Failed with error: ${error}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
}

        // This would be used if the metadata contained statistics for the columns

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

export const readAndUpdateElevationData = async (req_id:number,height_fieldname:string) => {
    try{
        console.log('readAndUpdateElevationData req_id:',req_id);
        const fileName = await db.getFilename(req_id);
        const opfsRoot = await navigator.storage.getDirectory();
        //console.log('readAndUpdateElevationData opfsRoot:',opfsRoot);
        const fileHandle = await opfsRoot.getFileHandle(fileName, {create:false});
        //console.log('readAndUpdateElevationData fileHandle:',fileHandle);
        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer(); // Convert the file to an ArrayBuffer
        const metadata = await readOpsfFileMetadata(height_fieldname,arrayBuffer);
        //console.warn('parquetReader:',useSrParquetCfgStore().getParquetReader().name);
        const summary = await readOrCacheSummary(req_id,height_fieldname);
        if(summary){
            useCurAtl06ReqSumStore().setSummary(summary);
            
            if(useSrParquetCfgStore().getParquetReader().name === 'hyparquet'){
                const chunkSize = 100000; 
                let rowStart = 0;
                let rowEnd = chunkSize;
                let hasMoreData = true;
                
                //console.log('readAndUpdateElevationData allFieldNames:',allFieldNames);
                while (hasMoreData) { // now plot data with color extremes set
                    try{
                        //console.log('readAndUpdateElevationData rowStart:',rowStart,' rowEnd:',rowEnd);
                        await parquetRead({
                            file: arrayBuffer,
                            columns: metadata.allFieldNames,
                            rowStart: rowStart,
                            rowEnd: rowEnd,
                            onComplete: data => {
                                //console.log('data.length:',data.length,'data:', data);
                                updateElLayer(data as [][], metadata.hMeanNdx, metadata.lonNdx, metadata.latNdx, summary.extHMean, metadata.allFieldNames);
                                hasMoreData = data.length === chunkSize;
                            }
                        });
                    } catch (error) {
                        console.error('readAndUpdateElevationData error:',error);
                        throw error;
                    }
                    rowStart += chunkSize;
                    rowEnd += chunkSize;
                    //console.log('readAndUpdateElevationData rowStart:',rowStart,' rowEnd:',rowEnd,' hasMoreData:',hasMoreData, ' chunkSize:',chunkSize, ' datalen:',datalen);
                }
            } else {
                console.error('readAndUpdateElevationData parquetReader:',useSrParquetCfgStore().getParquetReader().name,' not supported');
            }
        } else {
            console.error('readAndUpdateElevationData summary is undefined');
        }
    } catch (error) {
        const errorMsg = `readAndUpdateElevationData Failed with error: ${error}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
}
