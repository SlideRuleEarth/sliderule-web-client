import { parquetMetadata, parquetSchema, type FileMetaData } from 'hyparquet'
import { db } from '@/db/SlideRuleDb'; 
import { parquetRead } from 'hyparquet';
import { updateElLayer } from '@/utils/SrMapUtils';
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
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
    console.log('readOrCacheSummary req_id:',req_id,' summary:',summary);
    if (summary) {
        return summary;
    } else {
        let localExtLatLon = {minLat: 90, maxLat: -90, minLon: 180, maxLon: -180} as ExtLatLon;
        let localExtHMean = {minHMean: 100000, maxHMean: -100000, lowHMean: 100000, highHMean: -100000} as ExtHMean;
        const chunkSize = 200000;
        let rowStart = 0;
        let rowEnd = chunkSize;
        let hasMoreData = true;
        let datalen = 0;
        try{
            while (hasMoreData) { // First find extreme values for legend
                console.log('readOrCacheSummary rowStart:',rowStart,' rowEnd:',rowEnd,' height_fieldname:',height_fieldname);
                await parquetRead({
                    file: arrayBuffer,
                    columns: ['longitude', 'latitude', height_fieldname],
                    rowStart: rowStart,
                    rowEnd: rowEnd,
                    onComplete: data => {
                        console.log('data.length:',data.length,'data:', data);
                        const updatedExtremes = updateExtremeLatLon(data as [any,any,any], localExtLatLon, localExtHMean);
                        localExtLatLon = updatedExtremes.extLatLon;
                        localExtHMean = updatedExtremes.extHMean;
                        hasMoreData = data.length === chunkSize;
                        datalen += data.length;
                    }
                });
                rowStart += chunkSize;
                rowEnd += chunkSize;
            }
        } catch (error) {
            console.error('readOrCacheSummary error:',error);
            throw error;
        }
        if (datalen > 0) {
            await db.addNewSummary({req_id:req_id, extLatLon: localExtLatLon, extHMean: localExtHMean});
        } else {
            const errMsg = `readOrCacheSummary datalen is 0 for req_id:${req_id}`;
            console.error(errMsg);
            throw new Error(errMsg);
        }
        return await db.getWorkerSummary(req_id);
    }
}

export const readOpsfFileHeader = async (height_fieldname:string, arrayBuffer:ArrayBuffer) => {
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
        const numRows = metadata.num_rows;
        //console.log('readAndUpdateElevationData lonNdx:',lonNdx,' latNdx:',latNdx,' hMeanNdx:',hMeanNdx);
        return {metadata,allFieldNames, hMeanNdx, latNdx, lonNdx, numRows};
    } catch (error) { 
        const errorMsg = `readOpsfFileHeader Failed with error: ${error}`;
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

export const readAndUpdateElevationData = async (req_id:number) => {
    try{
        console.log('readAndUpdateElevationData req_id:',req_id);
        const height_fieldname = await getHeightFieldname(req_id);
        const fileName = await db.getFilename(req_id);
        const opfsRoot = await navigator.storage.getDirectory();
        //console.log('readAndUpdateElevationData opfsRoot:',opfsRoot);
        const fileHandle = await opfsRoot.getFileHandle(fileName, {create:false});
        //console.log('readAndUpdateElevationData fileHandle:',fileHandle);
        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer(); // Convert the file to an ArrayBuffer
        const header = await readOpsfFileHeader(height_fieldname,arrayBuffer);
        const numberOfRows = Number(header.numRows)-1;

        console.log('readAndUpdateElevationData header:',header);
        const summary = await readOrCacheSummary(req_id,height_fieldname);
        if(summary){
            useCurReqSumStore().setSummary(summary);
            
            if(useSrParquetCfgStore().getParquetReader().name === 'hyparquet'){
                const chunkSize = 1000000; 
                let rowStart = 0;
                let rowEnd = chunkSize;
                let hasMoreData = true;
                
                console.log('readAndUpdateElevationData numberOfRows:',numberOfRows, ' summary.extHMean:',summary.extHMean);
                console.log('header.allFieldNames:',header.allFieldNames,' header.hMeanNdx:',header.hMeanNdx,' header.lonNdx:',header.lonNdx,' header.latNdx:',header.latNdx);
                while (hasMoreData) { // now plot data with color extremes set
                    try{
                        rowEnd = Math.min(rowEnd, numberOfRows);
                        console.log('readAndUpdateElevationData rowStart:',rowStart,' rowEnd:',rowEnd);
                        const arrayBuffer2 = await file.arrayBuffer(); // Convert the file to an ArrayBuffer
                        await parquetRead({
                            file: arrayBuffer2,
                            //columns: header.allFieldNames,
                            //columns: ['longitude', 'latitude', height_fieldname],
                            rowStart: rowStart,
                            rowEnd: rowEnd,
                            metadata: header.metadata,
                            onComplete: data => {
                                console.log('data.length:',data.length,'data:', data);
                                updateElLayer(data as [][], header.hMeanNdx, header.lonNdx, header.latNdx, summary.extHMean, header.allFieldNames);
                                //updateElLayer(data as [][], 2, 0, 1, summary.extHMean, ['longitude', 'latitude', height_fieldname]);
                                //hasMoreData = data.length === chunkSize;
                                hasMoreData = false;
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
