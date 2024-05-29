import { parquetMetadata, parquetSchema, type FileMetaData } from 'hyparquet'
import { db } from '@/db/SlideRuleDb'; 
import { parquetRead } from 'hyparquet';
import { updateElLayer } from '@/utils/SrMapUtils';

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

export function findHMeanNdx(fieldAndType: SrParquetPathTypeJsType[]):number {
    return fieldAndType.findIndex((f) => f.path.join('.').includes('h_mean'));
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


async function getColumnMinMax(metadata: FileMetaData, columnIndex: number): Promise<{ min: any, max: any }> {
    let globalMin: any = null;
    let globalMax: any = null;

    for (let rowGroupIndex = 0; rowGroupIndex < metadata.row_groups.length; rowGroupIndex++) {
        const rowGroup = metadata.row_groups[rowGroupIndex];
        const columnChunk = rowGroup.columns[columnIndex];
        if (columnChunk.meta_data) {
            const stats = columnChunk.meta_data.statistics;
            if (stats) {
                const colMin = stats.min_value;
                const colMax = stats.max_value;
                if (colMin !== undefined && colMin !== null) {
                    if (globalMin === null || colMin < globalMin) {
                        globalMin = colMin;
                    }
                } else {
                    console.warn(`Row group ${rowGroupIndex}, column ${columnIndex}: min_value is undefined or null`);
                }
                if (colMax !== undefined && colMax !== null) {
                    if (globalMax === null || colMax > globalMax) {
                        globalMax = colMax;
                    }
                } else {
                    console.warn(`Row group ${rowGroupIndex}, column ${columnIndex}: max_value is undefined or null`);
                }
            } else {
                console.warn(`Row group ${rowGroupIndex}, column ${columnIndex}: statistics is undefined`);
            }
        } else {
            console.warn(`Row group ${rowGroupIndex}, column ${columnIndex}: meta_data is undefined`);
        }
    }

    if (globalMin === null || globalMax === null) {
        throw new Error(`Unable to determine min and/or max values for column index ${columnIndex}`);
    }

    return { min: globalMin, max: globalMax };
}
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

export const readAndUpdateElevationData = async (req_id:number) => {
    console.log('readAndUpdateElevationData req_id:',req_id);
    const fileName = await db.getFilename(req_id);
    const opfsRoot = await navigator.storage.getDirectory();
    const fileHandle = await opfsRoot.getFileHandle(fileName, {create:false});
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer(); // Convert the file to an ArrayBuffer
    const metadata = parquetMetadata(arrayBuffer)
    console.warn('processOpfsFile metadata:',metadata);
    const schema = parquetSchema(metadata);
    console.log('processOpfsFile schema:',schema);

    const allFieldNameTypes = recurseTree(schema);
    const allFieldNames = getFieldNames(allFieldNameTypes);
    const lonNdx = findLongNdx(allFieldNameTypes);
    const latNdx = findLatNdx(allFieldNameTypes);
    const hMeanNdx = findHMeanNdx(allFieldNameTypes);

    const latMinMax = await getColumnMinMax(metadata, latNdx);
    const lonMinMax = await getColumnMinMax(metadata, lonNdx);
    const extLatLon = {
        minLat: latMinMax.min,
        maxLat: latMinMax.max,
        minLon: lonMinMax.min,
        maxLon: lonMinMax.max
    };
    const hMeanMinMax = await getColumnMinMax(metadata, hMeanNdx);
    const extHMean = {
        minHMean: hMeanMinMax.min,
        maxHMean: hMeanMinMax.max,
        lowHMean: hMeanMinMax.min, // TBD: get 5th percentile?
        highHMean: hMeanMinMax.max // TBD: get 95th percentile?
    };
    const summary = await db.getWorkerSummary(req_id);
    if (summary) {
        summary.extLatLon = extLatLon;
        summary.extHMean = extHMean;
        await db.updateSummary(summary);
    } else {
        await db.addNewSummary({req_id:req_id, extLatLon: extLatLon, extHMean: extHMean});
    }
    console.log('processOpfsFile hMeanNdx:',hMeanNdx,' latNdx:',latNdx,' lonNdx:',lonNdx,' summary:',summary);
    const chunkSize = 1000000; 
    let rowStart = 0;
    let rowEnd = chunkSize;
    let hasMoreData = true;
    let datalen = 0;
    
    console.log('processOpsFile allFieldNames:',allFieldNames);
    while (hasMoreData) { // now plot data with color extremes set
        await parquetRead({
            file: arrayBuffer,
            columns: allFieldNames,
            rowStart: rowStart,
            rowEnd: rowEnd,
            onComplete: data => {
                console.log('data.length:',data.length,'data:', data);
                updateElLayer(data as [][], hMeanNdx, lonNdx, latNdx, extHMean);
                datalen = data.length;
                hasMoreData = data.length === chunkSize;
            }
        });
        rowStart += chunkSize;
        rowEnd += chunkSize;
        console.log('processOpfsFile rowStart:',rowStart,' rowEnd:',rowEnd,' hasMoreData:',hasMoreData, ' chunkSize:',chunkSize, ' datalen:',datalen);
    }
   
}
