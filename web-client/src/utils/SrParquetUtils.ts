import { parquetMetadata, parquetSchema, type FileMetaData } from 'hyparquet'
import { useCurAtl06ReqSumStore } from '@/stores/curAtl06ReqSumStore';
import { db } from '@/db/SlideRuleDb';  

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


export const processOpfsFile = async (req_id:number,filename:string) => {
    console.log('processOpfsFile filename:',filename);
    if (!filename) {
        console.error('processOpfsFile metadata is undefined');
        return;
    }
    const opfsRoot = await navigator.storage.getDirectory();
    const fileHandle = await opfsRoot.getFileHandle(filename, {create:false});
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer(); // Convert the file to an ArrayBuffer
    const metadata = parquetMetadata(arrayBuffer)
    console.warn('processOpfsFile metadata:',metadata);
    const schema = parquetSchema(metadata);
    console.log('processOpfsFile schema:',schema);

    const allFieldNameTypes = recurseTree(schema);
    useCurAtl06ReqSumStore().setAllFieldNameTypes(allFieldNameTypes);
    console.log('processOpfsFile allFieldNameTypes:',useCurAtl06ReqSumStore().getAllFieldNameTypes());
    useCurAtl06ReqSumStore().setAllFieldNames(getFieldNames(allFieldNameTypes));
    console.log('processOpfsFile allFieldNames:',useCurAtl06ReqSumStore().getAllFieldNames());
    useCurAtl06ReqSumStore().sethMeanNdx(findHMeanNdx(allFieldNameTypes));
    useCurAtl06ReqSumStore().setlatNdx(findLatNdx(allFieldNameTypes));
    useCurAtl06ReqSumStore().setlonNdx(findLongNdx(allFieldNameTypes));

    const latMinMax = await getColumnMinMax(metadata, useCurAtl06ReqSumStore().getlatNdx());
    const lonMinMax = await getColumnMinMax(metadata, useCurAtl06ReqSumStore().getlonNdx());
    const extLatLon = {
        minLat: latMinMax.min,
        maxLat: latMinMax.max,
        minLon: lonMinMax.min,
        maxLon: lonMinMax.max
    };
    const hMeanMinMax = await getColumnMinMax(metadata, useCurAtl06ReqSumStore().gethMeanNdx());
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
    console.log('processOpfsFile hMeanNdx:',useCurAtl06ReqSumStore().gethMeanNdx(),' latNdx:',useCurAtl06ReqSumStore().getlatNdx(),' lonNdx:',useCurAtl06ReqSumStore().getlonNdx(),' summary:',summary);
}
