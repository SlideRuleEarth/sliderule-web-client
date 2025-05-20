import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { createDuckDbClient, type QueryResult } from '@/utils//SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { updateDeckLayerWithObject,type ElevationDataItem } from '@/utils/SrMapUtils';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { SrMutex } from '@/utils/SrMutex';
import { useSrToastStore } from "@/stores/srToastStore";
import { srViews } from '@/composables/SrViews';
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { useChartStore} from '@/stores/chartStore';

import type { MinMaxLowHigh, SrListNumberItem } from '@/types/SrTypes';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { isClickable } from '@/utils/SrMapUtils'
import { createWhereClause } from '@/utils/spotUtils';
import { type SrPosition, EL_LAYER_NAME_PREFIX, SELECTED_LAYER_NAME_PREFIX } from '@/types/SrTypes';
import { useAnalysisMapStore } from '@/stores/analysisMapStore';
import { useFieldNameStore } from '@/stores/fieldNameStore';
import { type MinMax } from '@/types/SrTypes';


interface SummaryRowData {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
    minHMean: number;
    maxHMean: number;
    lowHMean: number;
    highHMean: number;
    numPoints: number;
}
const srMutex = new SrMutex();
export const readOrCacheSummary = async (req_id:number) : Promise<SrRequestSummary | undefined> => {
    try{
        const summary = await _duckDbReadOrCacheSummary(req_id);
        //console.log('readOrCacheSummary req_id:', req_id,'hfn:',height_fieldname, ' summary.extHMean:', summary?.extHMean);
        return summary;
    } catch (error) {
        console.error('readOrCacheSummary error:',error);
        throw error;
    }
}

function setElevationDataOptionsFromFieldNames(reqIdStr: string, fieldNames: string[]): void {
    //console.log(`setElevationDataOptionsFromFieldNames reqId:${reqIdStr}`, fieldNames );
    const startTime = performance.now(); // Start time
    const chartStore = useChartStore();
    try {
        const fncs = useFieldNameStore();
        // Update elevation data options in the chart store
        chartStore.setElevationDataOptions(reqIdStr, fieldNames);
        const reqId = parseInt(reqIdStr);
        // Get the height field name
        const heightFieldname = fncs.getHFieldName(reqId);

        // Find the index of the height field name
        const ndx = fieldNames.indexOf(heightFieldname);
        // Update the index of the elevation data options for height
        chartStore.setNdxOfElevationDataOptionsForHeight(reqIdStr, ndx);
        // Retrieve the existing Y data for the chart
        const defElOptions = fncs.getDefaultElOptions(reqId);
        for(const elevationOption of defElOptions){
            const existingYdata = chartStore.getYDataOptions(reqIdStr);
            // Check if the elevation option is already in the Y data
            if (!existingYdata.includes(elevationOption)) {
                // Clone the existing Y data and add the new elevation option
                const newYdata = [...existingYdata, elevationOption];
                // Update the Y data for the chart
                chartStore.setYDataOptions(reqIdStr, newYdata);
            }
        }
        chartStore.setSelectedYData(reqIdStr,heightFieldname);
        //console.log('setElevationDataOptionsFromFieldNames', { reqIdStr, fieldNames, heightFieldname, ndx } );
    } catch (error) {
        console.error('Error in setElevationDataOptionsFromFieldNames:', error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`setElevationDataOptionsFromFieldNames using reqId:${reqIdStr} fieldNames:${fieldNames} selectedYData:${chartStore.getSelectedYData(reqIdStr)} took ${endTime - startTime} milliseconds.`);
    }
}

async function _duckDbReadOrCacheSummary(req_id: number): Promise<SrRequestSummary | undefined> {
    const startTime = performance.now();
    let summary: SrRequestSummary | undefined = undefined;
    const unlock = await srMutex.lock();

    try {
        const height_fieldname = useFieldNameStore().getHFieldName(req_id);
        const lat_fieldname = useFieldNameStore().getLatFieldName(req_id);
        const lon_fieldname = useFieldNameStore().getLonFieldName(req_id);
        const filename = await indexedDb.getFilename(req_id);

        summary = await indexedDb.getWorkerSummary(req_id);
        if (summary?.extLatLon && summary?.extHMean) {
            return summary;
        }

        const localExtLatLon: ExtLatLon = { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 };
        const localExtHMean: ExtHMean = { minHMean: 1e6, maxHMean: -1e6, lowHMean: 1e6, highHMean: -1e6 };
        const duckDbClient = await createDuckDbClient();

        await duckDbClient.insertOpfsParquet(filename);
        const colTypes = await duckDbClient.queryColumnTypes(filename);
        const getType = (colName: string) => colTypes.find(c => c.name === colName)?.type ?? 'UNKNOWN';

        const aggCols = [lat_fieldname, lon_fieldname, height_fieldname];
        const aggClauses = buildSafeAggregateClauses(aggCols, getType, duckDbClient.escape);

        // Add COUNT(*) manually
        const summaryQuery = `
            SELECT
                ${aggClauses.join(',\n')},
                COUNT(*) AS numPoints
            FROM '${filename}'
        `;

        const results = await duckDbClient.query(summaryQuery);
        const rows: SummaryRowData[] = [];

        for await (const chunk of results.readRows()) {
            for (const row of chunk) {
                const typedRow: SummaryRowData = {
                    minLat: row[`min_${lat_fieldname}`],
                    maxLat: row[`max_${lat_fieldname}`],
                    minLon: row[`min_${lon_fieldname}`],
                    maxLon: row[`max_${lon_fieldname}`],
                    minHMean: row[`min_${height_fieldname}`],
                    maxHMean: row[`max_${height_fieldname}`],
                    lowHMean: row[`low_${height_fieldname}`],
                    highHMean: row[`high_${height_fieldname}`],
                    numPoints: row.numPoints
                };
                rows.push(typedRow);
            }
        }

        if (rows.length > 0) {
            const row = rows[0];
            localExtLatLon.minLat = row.minLat;
            localExtLatLon.maxLat = row.maxLat;
            localExtLatLon.minLon = row.minLon;
            localExtLatLon.maxLon = row.maxLon;
            localExtHMean.minHMean = row.minHMean;
            localExtHMean.maxHMean = row.maxHMean;
            localExtHMean.lowHMean = row.lowHMean;
            localExtHMean.highHMean = row.highHMean;

            summary = { req_id, extLatLon: localExtLatLon, extHMean: localExtHMean, numPoints: row.numPoints };
            await indexedDb.addNewSummary(summary);
            await indexedDb.updateRequestRecord({ req_id, cnt: row.numPoints }, false);
            useCurReqSumStore().setSummary(summary);
        } else {
            throw new Error('No rows returned');
        }

        return await indexedDb.getWorkerSummary(req_id);
    } catch (error) {
        console.error('_duckDbReadOrCacheSummary error:', error);
        throw error;
    } finally {
        unlock();
        const endTime = performance.now();
        console.log(`_duckDbReadOrCacheSummary for ${req_id} took ${endTime - startTime} ms.`);
    }
}

export const computeSamplingRate = async(req_id:number): Promise<number> => {
    let sample_fraction = 1.0;
    try{
        const maxNumPnts = useSrParquetCfgStore().getMaxNumPntsToDisplay();
        const summary = await readOrCacheSummary(req_id);
        if(summary){
            const numPointsStr = summary.numPoints;
            const numPoints = parseInt(String(numPointsStr));
            // console.log(`numPoints: ${numPoints}, Type: ${typeof numPoints}`);
            try{
                sample_fraction = maxNumPnts /numPoints; 
            } catch (error) {
                console.error('computeSamplingRate sample_fraction error:', error);
            }
            //console.warn('computeSamplingRate maxNumPnts:', maxNumPnts, ' summary.numPoints:', summary.numPoints, ' numPoints:',numPoints, ' sample_fraction:', sample_fraction);
        } else {
            console.error('computeSamplingRate summary is undefined using 1.0');
        }
    } catch (error) {
        console.error('computeSamplingRate error:', error, 'req_id:', req_id);
    }
    return sample_fraction;
}

export async function prepareDbForReqId(reqId: number): Promise<void> {
    const startTime = performance.now(); // Start time
    try{
        const fileName = await indexedDb.getFilename(reqId);
        //console.log(`prepareDbForReqId for ${reqId} fileName:${fileName}`);
        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);
        const colNames = await duckDbClient.queryForColNames(fileName);
        await updateAllFilterOptions(reqId);
        //console.trace(`prepareDbForReqId reqId:${reqId} colNames:`, colNames);
        setElevationDataOptionsFromFieldNames(reqId.toString(), colNames);
    } catch (error) {
        console.error('prepareDbForReqId error:', error);
        throw error;
    } finally {                                                                    
        const endTime = performance.now(); // End time
        console.log(`prepareDbForReqId for ${reqId} took ${endTime - startTime} milliseconds.`);
    }
}

//This is IceSat-2 specific
export const getColsForRgtYatcFromFile = async (
        req_id: number,
        cols: string[]
    ): Promise<Record<string, any[]> | undefined> => {
    if (!req_id) {
        console.error(`getColsForRgtYatcFromFile ${cols} Bad req_id: ${req_id}`);
        return;
    }
  
    const startTime = performance.now();
    let numRows = 0;
    const rowChunks: ElevationDataItem[] = [];
  
    try {
        if (await indexedDb.getStatus(req_id) === 'error') {
            console.error(`getColsForRgtYatcFromFile ${cols} req_id:${req_id} status is error, SKIPPING!`);
            return;
        }
        const globalChartStore = useGlobalChartStore();
        if( !globalChartStore.y_atc_is_valid()){
            console.error(`getColsForRgtYatcFromFile ${cols} req_id:${req_id} y_atc is invalid, SKIPPING!`);
            return;
        }
        // 1. Initialize DuckDB client
        const duckDbClient = await createDuckDbClient();
    
        // 2. Retrieve the filename/func
        const filename = await indexedDb.getFilename(req_id);
        const rgt = globalChartStore.getRgt();
        const selected_y_atc = globalChartStore.selected_y_atc;
        const y_atc_margin = globalChartStore.y_atc_margin;
    
        // 3. Build the query with (or without) DISTINCT
        //    If you want distinct *row combinations*, keep DISTINCT:
        //       SELECT DISTINCT col1, col2 FROM ...
        //    Or remove DISTINCT to see all matching rows:
        //       SELECT col1, col2 FROM ...
        //
        // Example removing DISTINCT:
        const columnStr = cols.join(', ');
        const queryStr = `
            SELECT DISTINCT ${columnStr}
            FROM read_parquet('${filename}')
            WHERE rgt = ${rgt}
            AND y_atc BETWEEN (${selected_y_atc} - ${y_atc_margin})
                            AND (${selected_y_atc} + ${y_atc_margin})
        `;
    
        // 4. Register the Parquet
        await duckDbClient.insertOpfsParquet(filename);
    
        // 5. Execute the query
        const result = await duckDbClient.queryChunkSampled(queryStr);
        for await (const rowChunk of result.readRows()) {
            if (rowChunk.length > 0) {
            numRows += rowChunk.length;
            rowChunks.push(...rowChunk);
            }
        }
    
    } catch (error) {
        console.error(`getColsForRgtYatcFromFile ${cols} req_id:${req_id} error:`, error);
        throw error;
    } finally {
        if (numRows > 0) {
            console.log(`getColsForRgtYatcFromFile columns: ${cols}`, rowChunks);
        } else {
            console.warn(`getColsForRgtYatcFromFile ${cols} req_id:${req_id} no data items processed`);
        }
        
        // ──────────────────────────────────────────
        // Transform row-based data → column-based data
        // ──────────────────────────────────────────
        if (numRows === 0) {
            return undefined;
        }
    
        // Create an object that will store an array for each column
        const dataByColumn: Record<string, Set<any>> = {};
        cols.forEach((col) => (dataByColumn[col] = new Set()));
        
        // Populate these sets
        for (const row of rowChunks) {
            for (const col of cols) {
            dataByColumn[col].add(row[col]);
            }
        }
        
        // Convert sets back to arrays
        const uniqueDataByColumn: Record<string, any[]> = {};
        for (const col of cols) {
            uniqueDataByColumn[col] = Array.from(dataByColumn[col]);
        }
        
        const endTime = performance.now();
        console.log(`getColsForRgtYatcFromFile ${cols} req_id:${req_id} retrieved ${numRows} rows in ${endTime - startTime} ms.`);
        return uniqueDataByColumn;
    }
};

export const duckDbReadAndUpdateElevationData = async (req_id: number,layerName:string): Promise<ElevationDataItem | null> => {
    console.log('duckDbReadAndUpdateElevationData req_id:', req_id);
    const startTime = performance.now(); // Start time

    let firstRec: ElevationDataItem | null = null;
    let numRows = 0;
    let srViewName = await indexedDb.getSrViewName(req_id);
    
    if (!srViewName || srViewName === '' || srViewName === 'Global') {
        srViewName = 'Global Mercator Esri';
        console.error(`HACK ALERT!! inserting srViewName:${srViewName} for reqId:${req_id}`);
    }

    const projName = srViews.value[srViewName].projectionName;
    
    if (!req_id) {
        console.error('duckDbReadAndUpdateElevationData Bad req_id:', req_id);
        return null;
    }
    
    const pntData = useAnalysisMapStore().getPntDataByReqId(req_id.toString());
    pntData.isLoading = true;

    try {
        if (await indexedDb.getStatus(req_id) === 'error') {
            console.error('duckDbReadAndUpdateElevationData req_id:', req_id, ' status is error SKIPPING!');
            return null;
        }
        const mission = useFieldNameStore().getMissionForReqId(req_id);

        const duckDbClient = await createDuckDbClient();
        const filename = await indexedDb.getFilename(req_id);
        await duckDbClient.insertOpfsParquet(filename);

        let rows: ElevationDataItem[] = [];
        let positions: SrPosition[] = []; // Precompute positions
        const pntData = useAnalysisMapStore().getPntDataByReqId(req_id.toString());
        pntData.totalPnts = 0;
        pntData.currentPnts = 0;
        try {
            const sample_fraction = await computeSamplingRate(req_id);
            const result = await duckDbClient.queryChunkSampled(`SELECT * FROM read_parquet('${filename}')`, sample_fraction);

            if (result.totalRows) {
                pntData.totalPnts =result.totalRows;
            } else if (result.schema === undefined) {
                console.warn('duckDbReadAndUpdateElevationData totalRows and schema are undefined result:', result);
            }

            const iterator = result.readRows();
            const { value, done } = await iterator.next();

            if (!done && value) {
                rows = value as ElevationDataItem[];
                numRows = rows.length;
                pntData.currentPnts = numRows;
                //console.log('duckDbReadAndUpdateElevationData rows:', rows);
                // **Find the first valid elevation point**
                firstRec = rows.find(isClickable) || null;
                if(!firstRec){
                    console.warn('duckDbReadAndUpdateElevationData find(isClickable) firstRec is null');
                    if(rows.length > 0) {
                        firstRec = rows[0];
                    }
                }
                if (firstRec) {
                    // Precompute position data for all rows
                    const lat_fieldname = useFieldNameStore().getLatFieldName(req_id);
                    const lon_fieldname = useFieldNameStore().getLonFieldName(req_id);
                    positions = rows.map(d => [
                        d[lon_fieldname],
                        d[lat_fieldname],
                        0 // always make this 0 so the tracks are flat
                    ] as SrPosition);
                } else {
                    console.warn(`No valid elevation points found in ${numRows} rows.`);
                    useSrToastStore().warn('No Data Processed', `No valid elevation points found in ${numRows} rows.`);
                }
            } else {
                console.warn('duckDbReadAndUpdateElevationData no data items processed');
                useSrToastStore().warn('No Data Processed', 'No data items processed. No Data returned for this region and request parameters.');
            }
        } catch (error) {
            console.error('duckDbReadAndUpdateElevationData error processing chunk:', error);
            throw error;
        }

        if (numRows > 0 && firstRec) {
            const height_fieldname = useFieldNameStore().getHFieldName(req_id);
            const summary = await readOrCacheSummary(req_id);

            if (summary?.extHMean) {
                useCurReqSumStore().setSummary({
                    req_id: req_id,
                    extLatLon: summary.extLatLon,
                    extHMean: summary.extHMean,
                    numPoints: summary.numPoints
                });
                //console.log('duckDbReadAndUpdateElevationData',height_fieldname,'positions:', positions);
                updateDeckLayerWithObject(layerName, rows, summary.extHMean, height_fieldname, positions, projName);
                
            } else {
                console.error('duckDbReadAndUpdateElevationData summary is undefined');
            }

            await prepareDbForReqId(req_id);
        }
    } catch (error) {
        console.error('duckDbReadAndUpdateElevationData error:', error);
        throw error;
    } finally {
        const pntData = useAnalysisMapStore().getPntDataByReqId(req_id.toString());
        pntData.isLoading = false;
        const endTime = performance.now(); // End time
        console.log(`duckDbReadAndUpdateElevationData for ${req_id} took ${endTime - startTime} milliseconds.`);
        return { firstRec, numRows };
    }
};

type Position = [number, number, number];

export const duckDbReadAndUpdateSelectedLayer = async (
    req_id: number, layerName:string, chunkSize: number = 10000, maxNumPnts = 10000
) => {
    console.log('duckDbReadAndUpdateSelectedLayer req_id:', req_id);
    if (req_id === undefined || req_id === null || req_id === 0) {
        console.error('duckDbReadAndUpdateSelectedLayer Bad req_id:', req_id);
        return;
    }

    const startTime = performance.now();
    const reqIdStr = req_id.toString();
    let numRows = 0;
    const filteredPntData = useAnalysisMapStore().getFilteredPntDataByReqId(reqIdStr);
    const globalChartStore = useGlobalChartStore();

    try {
        if (await indexedDb.getStatus(req_id) === 'error') {
            console.error('duckDbReadAndUpdateSelectedLayer req_id:', req_id, ' status is error SKIPPING!');
            return;
        }

        const utfn = useFieldNameStore().getUniqueTrkFieldName(req_id);
        const uofn = useFieldNameStore().getUniqueOrbitIdFieldName(req_id);
        const usfn = useFieldNameStore().getUniqueSpotIdFieldName(req_id);

        filteredPntData.isLoading = true;
        filteredPntData.currentPnts = 0;

        const duckDbClient = await createDuckDbClient();
        const filename = await indexedDb.getFilename(req_id);
        const func = await indexedDb.getFunc(req_id);
        let queryStr = '';

        // Construct SQL query
        const rgt = globalChartStore.getRgt();
        const cycles = globalChartStore.getCycles();
        const spots = globalChartStore.getSpots();
        let use_y_atc_filter = globalChartStore.use_y_atc_filter;
        let min_y_atc = '0.0';
        let max_y_atc = '0.0';

        if (globalChartStore.selected_y_atc) {
            const y_atc_margin = globalChartStore.y_atc_margin;
            min_y_atc = (globalChartStore.selected_y_atc - y_atc_margin).toFixed(3);
            max_y_atc = (globalChartStore.selected_y_atc + y_atc_margin).toFixed(3);
        } else {
            if(!func.includes('atl08')){
                console.warn('duckDbReadAndUpdateSelectedLayer selected_y_atc is undefined');
            }
            use_y_atc_filter = false;
        }

        queryStr = `
            SELECT * FROM read_parquet('${filename}') 
            WHERE ${utfn} = ${rgt}
            AND ${uofn} IN (${cycles.join(', ')})
            AND ${usfn} IN (${spots.join(', ')})
        `;
        if (use_y_atc_filter) {
            queryStr += `AND y_atc BETWEEN ${min_y_atc} AND ${max_y_atc}`;
        }

        await duckDbClient.insertOpfsParquet(filename);
        const rowChunks: ElevationDataItem[] = [];
        const positions: Position[] = []; // Store precomputed positions

        try {
            const result = await duckDbClient.queryChunkSampled(queryStr); // No sampling for selected

            for await (const rowChunk of result.readRows()) {
                if (rowChunk.length > 0) {
                    numRows += rowChunk.length;
                    rowChunks.push(...rowChunk);
                    filteredPntData.currentPnts = numRows;
                    // **Precompute positions and store them**
                    if(func.includes('atl24')){
                        rowChunk.forEach(d => {
                            positions.push([d.lon_ph, d.lat_ph, 0]);
                        });
                    } else {
                        rowChunk.forEach(d => {
                            positions.push([d.longitude, d.latitude, 0]);
                        });
                    }
                }
            }

            if (numRows === 0) {
                console.warn('duckDbReadAndUpdateSelectedLayer no data items processed');
            }
        } catch (error) {
            console.error('duckDbReadAndUpdateSelectedLayer error processing chunk:', error);
            throw error;
        }

        if (numRows > 0) {
            const srViewName = await indexedDb.getSrViewName(req_id);
            const projName = srViews.value[srViewName].projectionName;
            const height_fieldname = useFieldNameStore().getHFieldName(req_id);
            const summary = await readOrCacheSummary(req_id);
            if (summary?.extHMean) {
                // Pass `positions` to the function so it's used efficiently
                updateDeckLayerWithObject(layerName,rowChunks, summary.extHMean, height_fieldname, positions, projName);
            } else {
                console.error('duckDbReadAndUpdateSelectedLayer summary is undefined');
            }
        } else {
            console.warn('duckDbReadAndUpdateSelectedLayer no data items processed');
        }
    } catch (error) {
        console.error('duckDbReadAndUpdateSelectedLayer error:', error);
        throw error;
    } finally {
        filteredPntData.isLoading = false;
        const endTime = performance.now();
        console.log(`duckDbReadAndUpdateSelectedLayer for ${req_id} took ${endTime - startTime} milliseconds.`);
    }
};

export async function isReqFileLoaded(reqId:number): Promise<any> {
    const startTime = performance.now(); // Start time
    let serverReq = '';
    try{
        const fileName = await indexedDb.getFilename(reqId);
        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);
        return await duckDbClient.isParquetLoaded(fileName);
    } catch (error) {
        console.error('duckDbLoadOpfsParquetFile error:',error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`duckDbLoadOpfsParquetFile took ${endTime - startTime} milliseconds.`);
    }
    return serverReq;   
}


export async function duckDbLoadOpfsParquetFile(fileName: string): Promise<any> {
    const startTime = performance.now(); // Start time
    let serverReq = '';
    try{
        //console.log('duckDbLoadOpfsParquetFile');
        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);
        try {
            const serverReqResult =  await duckDbClient.getServerReqFromMetaData(fileName);
            if(serverReqResult){
                serverReq = serverReqResult;
            } else {
                console.warn('duckDbLoadOpfsParquetFile serverReqResult is null');
            }
        } catch (error) {
            console.error('Error dumping parquet metadata:', error);
        }
    } catch (error) {
        console.error('duckDbLoadOpfsParquetFile error:',error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`duckDbLoadOpfsParquetFile took ${endTime - startTime} milliseconds.`);
    }
    return serverReq;   
}

export interface SrScatterChartData { value: number[] };

export async function getAllRgtOptionsInFile(req_id: number): Promise<SrListNumberItem[]> {
    const startTime = performance.now(); // Start time
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);
    const rgtOptions = [] as SrListNumberItem[];
    try{
        const utfn = useFieldNameStore().getUniqueTrkFieldName(req_id);

        const query = `SELECT DISTINCT ${utfn} FROM '${fileName}' order by  ${utfn} ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        //console.log('getAllRgtOptionsInFile queryResult:', queryResult);
        for await (const rowChunk of queryResult.readRows()) {
            //console.log('getAllRgtOptionsInFile rowChunk:', rowChunk);
            for (const row of rowChunk) {
                if (row) {
                    rgtOptions.push({ label: row[utfn].toString(), value: row[utfn] });
                } else {
                    console.warn('getAllRgtOptionsInFile fetchData rowData is null');
                }
            }
        } 
    } catch (error) {
        console.error('getAllRgtOptionsInFile Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`SrDuckDbUtils.getAllRgtOptionsInFile() took ${endTime - startTime} milliseconds.`,rgtOptions);
    }
    return rgtOptions;
}

export async function getPairs(req_id: number): Promise<number[]> {
    const startTime = performance.now(); // Start time
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);
    const pairs = [] as number[];
    try{
        const query = `SELECT DISTINCT pair FROM '${fileName}' order by pair ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    //console.log('getPairs row:', row);
                    pairs.push(row.pair);
                } else {
                    console.warn('getPairs fetchData rowData is null');
                }
            }
        } 
        //console.log('getPairs pairs:', pairs);
    } catch (error) {
        console.error('getPairs Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`SrDuckDbUtils.getPairs() took ${endTime - startTime} milliseconds.`, pairs);
    }
    return pairs;
}

// export async function updatePairOptions(req_id: number): Promise<number[]> {
//     let pairs = [] as number[];
//     try{
//         pairs = await getPairs(req_id);
//         useAtlChartFilterStore().setPairOptionsWithNumbers(pairs);   
//     } catch (error) {
//         console.error('getPairs Error:', error);
//         throw error;
//     }
//     //console.log('updatePairOptions pairs:', useAtlChartFilterStore().getPairOptions());
//     return pairs;
// }
/**
 * Builds safe DuckDB aggregate SQL expressions with optional isnan() filtering
 * for numeric columns. Non-float types skip isnan() and use raw aggregations.
 */
export function buildSafeAggregateClauses(
    columnNames: string[],
    getType: (colName: string) => string,
    escape: (colName: string) => string
): string[] {
    return columnNames.flatMap((colName) => {
        const type = getType(colName);
        const escaped = escape(colName);
        const isFloat = ['FLOAT', 'DOUBLE', 'REAL'].includes(type);

        if (isFloat) {
            return [
                `MIN(${escaped}) FILTER (WHERE NOT isnan(${escaped})) AS min_${colName}`,
                `MAX(${escaped}) FILTER (WHERE NOT isnan(${escaped})) AS max_${colName}`,
                `PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY ${escaped}) FILTER (WHERE NOT isnan(${escaped})) AS low_${colName}`,
                `PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ${escaped}) FILTER (WHERE NOT isnan(${escaped})) AS high_${colName}`
            ];
        } else {
            return [
                `MIN(${escaped}) AS min_${colName}`,
                `MAX(${escaped}) AS max_${colName}`,
                `PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY ${escaped}) AS low_${colName}`,
                `PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ${escaped}) AS high_${colName}`
            ];
        }
    });
}
// These are IceSat-2 specific
export async function getTracks(req_id: number): Promise<number[]> {
    const startTime = performance.now(); // Start time
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    const tracks = [] as number[];
    try{
        const query = `SELECT DISTINCT track FROM '${fileName}' order by track ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    //console.log('getPairs row:', row);
                    tracks.push(row.track);
                } else {
                    console.warn('getTracks fetchData rowData is null');
                }
            }
        } 
        //console.log('getPairs pairs:', pairs);
    } catch (error) {
        console.error('getTracks Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        //console.log(`SrDuckDbUtils.getTracks() took ${endTime - startTime} milliseconds.`);
    }
    return tracks;
}

export async function getScOrient(req_id: number): Promise<number[]> {
    const startTime = performance.now(); // Start time
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    const scOrients = [] as number[];
    try{
        const query = `SELECT DISTINCT sc_orient FROM '${fileName}' order by sc_orient ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    //console.log('getScOrient row:', row);
                    scOrients.push(row.sc_orient);
                } else {
                    console.warn('getScOrient fetchData rowData is null');
                }
            }
        } 
        //console.log('getScOrient scOrients:', scOrients);
    } catch (error) {
        console.error('getScOrient Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        //console.log(`SrDuckDbUtils.getScOrient() took ${endTime - startTime} milliseconds.`);
    }
    return scOrients;
}

// This uses generic field name for cycle to support GEDI 
export async function getAllCycleOptionsInFile(req_id: number): Promise<{ cycles: number[]; cycleOptions: SrListNumberItem[] }> {
    const startTime = performance.now(); // Start time
    const time_fieldname = useFieldNameStore().getTimeFieldName(req_id);
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();


    // Make the parquet file available to DuckDB
    await duckDbClient.insertOpfsParquet(fileName);

    const cycleOptions = [] as SrListNumberItem[];
    const cycles = [] as number[];

    try {
        const uofn = useFieldNameStore().getUniqueOrbitIdFieldName(req_id);
        // Query: get one row per cycle with a single representative time
        // plus all distinct rgts, spots, and gts.
        const query = `
            SELECT 
                ${uofn},
                ANY_VALUE(${duckDbClient.escape(time_fieldname)}) AS time,  -- We only need any single time
            FROM '${fileName}'
            GROUP BY ${uofn}
            ORDER BY ${uofn} ASC;
        `;

        // Run the query
        const queryResult: QueryResult = await duckDbClient.query(query);

        // Process the returned rows
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (!row) {
                    console.warn('getAllCycleOptionsInFile rowData is null or undefined');
                    continue;
                }
                
                // Convert time to a locale-based string (e.g. MM/DD/YYYY)
                const timeStr = new Date(row.time).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });

                // Build a label for each cycle
                const value = row[uofn];
                const newLabel = `${value}: ${timeStr}`;

                cycleOptions.push({
                    label: newLabel,
                    value: value
                });
                cycles.push(value);
            }
        }
    } catch (error) {
        console.error('getAllCycleOptionsInFile Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`getAllCycleOptionsInFile took ${endTime - startTime} ms.`, cycles);
    }

    return {cycles, cycleOptions};
}

// This uses generic field name for cycle to support GEDI 
export async function getAllFilteredCycleOptionsFromFile(
    req_id: number,
): Promise<SrListNumberItem[]> {
    const startTime = performance.now(); // Start time

    const fileName = await indexedDb.getFilename(req_id);
    const time_fieldname = useFieldNameStore().getTimeFieldName(req_id);
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);
    const cycles: SrListNumberItem[] = [];
    let whereClause = '';
    
    try {
        // Build the WHERE clause dynamically
        const uofn = useFieldNameStore().getUniqueOrbitIdFieldName(req_id);
        
        whereClause = createWhereClause(req_id);

        const query = `
            SELECT 
            ${uofn} AS cycle, 
            ANY_VALUE(${duckDbClient.escape(time_fieldname)}) AS time 
            FROM '${fileName}'
            ${whereClause}
            GROUP BY ${uofn} 
            ORDER BY ${uofn} ASC;
        `;

        const queryResult: QueryResult = await duckDbClient.query(query);

        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                        const timeStr = new Date(row.time).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });
                    const newLabel = `${row.cycle}: ${timeStr}`;
                    cycles.push({ label: newLabel, value: row.cycle });
                } else {
                    console.warn(
                        'getAllFilteredCycleOptionsFromFile fetchData rowData is null'
                    );
                }
            }
        }

    } catch (error) {
        console.error('getAllFilteredCycleOptionsFromFile Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(
            `getAllFilteredCycleOptionsFromFile took ${endTime - startTime} milliseconds.`,
            ' req_id:',
            req_id,
            ' cycles:',
            cycles,
            'whereClause:',
            whereClause
        );
    }
    return cycles;
}

export async function updateAllFilterOptions(req_id: number): Promise<void> {
    const startTime = performance.now(); // Start time
    try{
        const globalChartStore = useGlobalChartStore();
        const rgts = await getAllRgtOptionsInFile(req_id);
        globalChartStore.setRgtOptions(rgts);
        const retObj = await getAllCycleOptionsInFile(req_id);
        globalChartStore.setCycleOptions(retObj.cycleOptions);
    } catch (error) {
        console.error('updateAllFilterOptions Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`SrDuckDbUtils.updateAllFilterOptions() took ${endTime - startTime} milliseconds.`);
    }
}
export interface FetchScatterDataOptions {
    /** 
     * Extra columns to SELECT in addition to x and y columns.
     * e.g. [ 'segment_dist', 'atl03_cnf', 'atl08_class' ] 
     */
    extraSelectColumns?: string[];
  
    /**
     * A callback to handle row transformation into `[ x, y1, y2, ..., extras ]`.
     * Must populate dataOrderNdx with the order of the columns.
     */
    transformRow?: (
        row: any,
        x: string,
        y: string[],
        minMaxLowHigh: MinMaxLowHigh,
        dataOrderNdx: Record<string, number>,
        orderNdx: number
    ) => [number[],number];
  
    /**
     * A callback for how to set store states for min/max x, or any special logic
     * required during the "min/max" query.
     */
    handleMinMaxRow?: (reqIdStr: string, row: any) => void;
  
    /**
     * Optional override of the default `whereClause`.
     */
    whereClause?: string;
  
    /**
     * Whether to normalize `x` to `[0..(max-min)]` or leave it as is.
     */
    normalizeX?: boolean;

    /**
     * Optional min axis value used by base API. overlayed should use this
     */
    parentMinX?: number;
}
export interface SrScatterChartDataArray {
    data: number[][]; 
}

export function setDataOrder(dataOrderNdx: Record<string, number>, colName: string, orderNdx: number) {
    if(!dataOrderNdx[colName] && !(dataOrderNdx[colName] === 0)){
        dataOrderNdx[colName] = orderNdx;
        //console.log('setDataOrder dataOrderNdx:', dataOrderNdx, ' orderNdx:', orderNdx, ' colName:', colName);
        orderNdx = orderNdx + 1;
    };
    return orderNdx;
}


export async function fetchScatterData(
    reqIdStr: string,
    fileName: string,
    x: string,
    y: string[],
    options: FetchScatterDataOptions
): Promise<{
    chartData: Record<string, SrScatterChartDataArray>;
    minMaxLowHigh: MinMaxLowHigh;
    normalizedMinMaxValues: MinMaxLowHigh;
    dataOrderNdx: Record<string, number>;
}> {
    const timeField = useFieldNameStore().getTimeFieldName(parseInt(reqIdStr));
    const mission = useFieldNameStore().getMissionForReqId(parseInt(reqIdStr));
    console.log('fetchScatterData reqIdStr:', reqIdStr, ' fileName:', fileName, ' x:', x, ' y:', y, ' options:', options);
    // Ensure 'time' is in the y array
    if (!y.includes(timeField)) {
        y = [...y, timeField];
    }

    // Ensure 'cycle' is in the y array
    if (mission === 'ICESat-2' && !y.includes('cycle')) {
        y = [...y, 'cycle'];
    }
    const {
        extraSelectColumns = [],
        transformRow,
        handleMinMaxRow,
        whereClause = useChartStore().getWhereClause(reqIdStr),
        normalizeX = options.normalizeX ?? false,
    } = options;

    const startTime = performance.now();
    const chartData: Record<string, SrScatterChartDataArray> = {
        [reqIdStr]: { data: [] }
    };

    const duckDbClient = await createDuckDbClient();
    const minMaxLowHigh: MinMaxLowHigh = {};
    let normalizedMinMaxValues: MinMaxLowHigh = {};
    let dataOrderNdx: Record<string, number> = {};
    let orderNdx = 0;

    try {
        // Make sure the file is registered with DuckDB
        await duckDbClient.insertOpfsParquet(fileName);

        // 1. Build an additional clause to exclude NaNs in each y column.
        //    If you also want to exclude NaNs in x, just add x as well.
        //    e.g. y = [...y, x] or make a separate check for x.
        // Only apply NOT isnan(...) to columns that are not "time"
        const yNanClause = y
            .filter((col) => col !== timeField)
            .map((col) => `NOT isnan(${col})`)
            .join(' AND ');

        // 2. Merge it with the existing whereClause (if any).
        //    If whereClause doesn’t start with “WHERE”, we need to prepend it properly.
        //    If it’s empty, we just use “WHERE <nanClause>”.
        //    If it already has “WHERE”, we append “AND <nanClause>”.
        let finalWhereClause = '';
        if (!whereClause || !whereClause.trim()) {
            finalWhereClause = `WHERE ${yNanClause}`;
        } else {
            // Strip off a leading "WHERE" if present, because we’re going to add our own
            const sanitizedExistingClause = whereClause.replace(/^WHERE\s+/i, '');
            finalWhereClause = `WHERE ${sanitizedExistingClause} AND ${yNanClause}`;
        }

        /**
         * 3. Compute min/max for x and each of the y columns (NaNs already excluded by finalWhereClause).
         */
        const colTypes = await duckDbClient.queryColumnTypes(fileName);
        const getColType = (colName: string) =>
            colTypes.find((c) => c.name === colName)?.type ?? 'UNKNOWN';
        
        const allAggCols = [x, ...y, ...extraSelectColumns];
        
        const selectParts = buildSafeAggregateClauses(allAggCols, getColType, duckDbClient.escape);
        
        const minMaxQuery = `
            SELECT
                ${selectParts.join(',\n')}
            FROM '${fileName}'
            ${finalWhereClause}
        `;
            
        const queryResultMinMax: QueryResult = await duckDbClient.query(minMaxQuery);
        //console.log('fetchScatterData queryResultMinMax:', queryResultMinMax);
        let minXtoUse;
        if(options.parentMinX){
            minXtoUse = options.parentMinX;
        }
        console.log('fetchScatterData options.parentMinX:',options.parentMinX,'minXtoUse:', minXtoUse);

        for await (const rowChunk of queryResultMinMax.readRows()) {
            //console.log('fetchScatterData rowChunk:', rowChunk);
            for (const row of rowChunk) {
                if (!row) {
                    console.warn('fetchScatterData: rowData is null in min/max query');
                    continue;
                }

                if (handleMinMaxRow) {
                    handleMinMaxRow(reqIdStr, row);
                } else {
                    if(options.parentMinX){
                        minXtoUse = options.parentMinX;
                    } else {
                        minXtoUse = row[`min_${x}`];
                    }
                    if(minXtoUse === row[`min_${x}`]){
                        console.log('fetchScatterData minXtoUse:', minXtoUse, `row['min_${x}']:`, row[`min_${x}`]);
                    } else {
                        console.warn('fetchScatterData minXtoUse:', minXtoUse, `row['min_${x}']:`, row[`min_${x}`]);
                    }
                    // set min/max in the store
                    useChartStore().setRawMinX(reqIdStr, row[`min_${x}`]);
                    useChartStore().setMinX(reqIdStr, row[`min_${x}`] - minXtoUse);
                    useChartStore().setMaxX(reqIdStr, row[`max_${x}`] - minXtoUse);
                }

                // Populate minMaxValues, but exclude NaN values (should be unnecessary now that we filter in SQL)
                if (!isNaN(row[`min_${x}`]) && !isNaN(row[`max_${x}`])) {
                    minMaxLowHigh[`x`] = { // genericize the name to x
                        min: row[`min_${x}`],
                        max: row[`max_${x}`],
                        low: row[`low_${x}`],
                        high: row[`high_${x}`]
                    }
                    
                } else {
                    console.error('fetchScatterData: min/max x is NaN:', row[`min_${x}`], row[`max_${x}`]);
                }

                y.forEach((yName) => {
                    const minY = row[`min_${yName}`];
                    const maxY = row[`max_${yName}`];
                    const lowY = row[`low_${yName}`];
                    const highY = row[`high_${yName}`];
                    if (!isNaN(minY) && !isNaN(maxY) && !isNaN(lowY) && !isNaN(highY)) {
                        minMaxLowHigh[yName] = { min: minY, max: maxY, low: lowY, high: highY };
                    }
                });

                extraSelectColumns.forEach((colName) => {
                    const minCol = row[`min_${colName}`];
                    const maxCol = row[`max_${colName}`];
                    const lowCol = row[`low_${colName}`];
                    const highCol = row[`high_${colName}`];
                    if (!isNaN(minCol) && !isNaN(maxCol) && !isNaN(lowCol) && !isNaN(highCol)) {
                        minMaxLowHigh[colName] = { min: minCol, max: maxCol, low: lowCol, high: highCol };
                    }
                });
            }
        }

        /**
         * 4. Build the main query to fetch rows for x, all y columns, plus extras.
         *    Use the same finalWhereClause so NaNs in y columns are excluded.
         */
        const allColumns = [x, ...y, ...extraSelectColumns].join(', ');
        let mainQuery = `SELECT ${allColumns} \nFROM '${fileName}'\n${finalWhereClause}`;

        useChartStore().setQuerySql(reqIdStr, mainQuery);
        const totalRowCnt = await duckDbClient.getTotalRowCount(mainQuery);
        //console.log('fetchScatterData totalRowCnt:', totalRowCnt, ' typeof:', typeof totalRowCnt);
        //console.log('fetchScatterData max_pnts_on_plot:', useGlobalChartStore().max_pnts_on_plot, ' typeof:', typeof useGlobalChartStore().max_pnts_on_plot);



        const sample_fraction = useGlobalChartStore().max_pnts_on_plot/Number(totalRowCnt);
        const queryResultMain: QueryResult = await duckDbClient.queryChunkSampled(
            useChartStore().getQuerySql(reqIdStr),
            sample_fraction
        );
        /**
         * 5. For each row, produce an array [ xVal, yVal1, yVal2, ..., extras ]
         *    and push it into chartData[reqIdStr].data
         */
        //console.log('fetchScatterData mainQuery:', mainQuery);
        for await (const rowChunk of queryResultMain.readRows()) {
            //console.log('fetchScatterData rowChunk:', rowChunk);
            //console.log('fetchScatterData transformRow:', transformRow);
            for (const row of rowChunk) {
                if (!row) {
                    console.warn('fetchScatterData: rowData is null in main query');
                    continue;
                }

                let rowValues: number[] = [];

                if (transformRow) {
                    [rowValues, orderNdx] = transformRow(
                        row,
                        x,
                        y,
                        minMaxLowHigh,
                        dataOrderNdx,
                        orderNdx
                    );
                } else {
                    // Default transformation:
                    const xVal = normalizeX ? row[x] - minXtoUse : row[x];
                    rowValues = [xVal];
                    orderNdx = setDataOrder(dataOrderNdx, 'x', orderNdx);

                    y.forEach((yName) => {
                        rowValues.push(row[yName]);
                        orderNdx = setDataOrder(dataOrderNdx, yName, orderNdx);
                    });

                    if (extraSelectColumns.length > 0) {
                        extraSelectColumns.forEach((colName) => {
                            rowValues.push(row[colName]);
                            orderNdx = setDataOrder(dataOrderNdx, colName, orderNdx);
                        });
                    }
                }

                // Double-check: exclude row if anything is NaN, but this should now be rare
                // since we already filter them out in SQL.
                if (rowValues.some((val) => isNaN(val))) {
                    console.warn('Skipping row due to NaN values:', rowValues);
                    continue;
                }

                chartData[reqIdStr].data.push(rowValues);
            }
        }

        /**
         * 6. If we are normalizing X, adjust min=0 and max=(max-min).
         */
        normalizedMinMaxValues = { ...minMaxLowHigh };
        if (normalizeX) {
            normalizedMinMaxValues['x'] = {
                min: 0,
                low: 0,
                max: minMaxLowHigh['x'].max - minMaxLowHigh['x'].min,
                high: minMaxLowHigh['x'].high - minMaxLowHigh['x'].min
            };
        }

        useChartStore().setXLegend(reqIdStr, `${x} (normalized) - Meters`);
        //console.log('fetchScatterData chartData:', chartData);
        //console.log('fetchScatterData minMaxValues:', minMaxValues);
        //console.log('fetchScatterData normalizedMinMaxValues:', normalizedMinMaxValues);
        //console.log('fetchScatterData dataOrderNdx:', dataOrderNdx);
        return { chartData, minMaxLowHigh, normalizedMinMaxValues, dataOrderNdx };

    } catch (error) {
        console.error('fetchScatterData Error:', error);
        console.trace('fetchScatterData Error:', error);
        return { chartData: {}, minMaxLowHigh: {}, normalizedMinMaxValues: {}, dataOrderNdx: {} };
    } finally {
        const endTime = performance.now();
        console.log(`fetchScatterData took ${endTime - startTime} ms.`);
    }  
}

export async function getAllColumnMinMax(
    reqId: number
): Promise<MinMaxLowHigh> {
    const startTime = performance.now();
    const fileName = await indexedDb.getFilename(reqId);
    const duckDbClient = await createDuckDbClient();

    await duckDbClient.insertOpfsParquet(fileName);

    const colTypes = await duckDbClient.queryColumnTypes(fileName);

    // Filter down to known numeric types
    const numericCols = colTypes.filter(c =>
        ['DOUBLE', 'FLOAT', 'INTEGER', 'BIGINT', 'REAL', 'DECIMAL'].includes(c.type)
    );

    if (numericCols.length === 0) {
        console.warn(`No numeric columns found in ${fileName}`);
        return {};
    }

    // Prepare names and a type lookup
    const colNames = numericCols.map(c => c.name);
    const getType = (colName: string) =>
        colTypes.find(c => c.name === colName)?.type ?? 'UNKNOWN';

    const selectParts = buildSafeAggregateClauses(colNames, getType, duckDbClient.escape);
    const query = `SELECT ${selectParts.join(', ')} FROM '${fileName}'`;

    const result: MinMaxLowHigh = {};

    try {
        const queryResult = await duckDbClient.query(query);
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                numericCols.forEach(c => {
                    const min = row[`min_${c.name}`];
                    const max = row[`max_${c.name}`];
                    const low = row[`low_${c.name}`];
                    const high = row[`high_${c.name}`];

                    if (min != null && max != null && low != null && high != null) {
                        result[c.name] = { min, max, low, high };
                    }
                });
            }
        }
    } catch (error) {
        console.error('getAllColumnMinMax error:', error);
        throw error;
    }

    const endTime = performance.now();
    console.log(
        `getAllColumnMinMax query:\n${query}\ntook ${endTime - startTime} ms.\nresult:`,
        result
    );
    return result;
}
