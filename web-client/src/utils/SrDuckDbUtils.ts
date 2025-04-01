import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { createDuckDbClient, type QueryResult } from '@/utils//SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { updateDeckLayerWithObject,type ElevationDataItem } from '@/utils/SrMapUtils';
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { useMapStore } from '@/stores/mapStore';
import { SrMutex } from './SrMutex';
import { useSrToastStore } from "@/stores/srToastStore";
import { srViews } from '@/composables/SrViews';
import { useSrParquetCfgStore } from '@/stores/srParquetCfgStore';
import { useChartStore} from '@/stores/chartStore';
import type { SrListNumberItem } from '@/types/SrTypes';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { isClickable } from '@/utils/SrMapUtils'
import { createWhereClause } from './spotUtils';
import { type SrPosition, EL_LAYER_NAME_PREFIX, SELECTED_LAYER_NAME_PREFIX } from '@/types/SrTypes';
import { useAnalysisMapStore } from '@/stores/analysisMapStore';
import { useFieldNameCacheStore } from '@/stores/fieldNameStore';
import { use } from 'echarts';


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
//const fncs = useFieldNameCacheStore();
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

export async function getDefaultElOptions(reqId:number) : Promise<string[]>{
    try{
        const funcStr = useRecTreeStore().findApiForReqId(reqId);
        return useFieldNameCacheStore().getDefaultElOptions(funcStr);
    } catch (error) {
        console.error('getDefaultElOptions error:',error);
        throw error;  
    }
}

async function setElevationDataOptionsFromFieldNames(reqIdStr: string, fieldNames: string[]) {
    console.log(`setElevationDataOptionsFromFieldNames reqId:${reqIdStr}`, fieldNames );
    const startTime = performance.now(); // Start time
    try {
        const chartStore = useChartStore();
        // Update elevation data options in the chart store
        chartStore.setElevationDataOptions(reqIdStr, fieldNames);
        const reqId = parseInt(reqIdStr);
        // Get the height field name
        const heightFieldname = useFieldNameCacheStore().getHFieldName(reqId);

        // Find the index of the height field name
        const ndx = fieldNames.indexOf(heightFieldname);
        // Update the index of the elevation data options for height
        chartStore.setNdxOfElevationDataOptionsForHeight(reqIdStr, ndx);
        // Retrieve the existing Y data for the chart

        const defElOptions = await getDefaultElOptions(reqId);
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
        console.log(`setElevationDataOptionsFromFieldNames took ${endTime - startTime} milliseconds.`);
    }
}

async function _duckDbReadOrCacheSummary(req_id: number): Promise<SrRequestSummary | undefined> {
    const startTime = performance.now(); // Start time
    let summary: SrRequestSummary | undefined = undefined;
    const unlock = await srMutex.lock();
    try {
        const height_fieldname = useFieldNameCacheStore().getHFieldName(req_id);
        const lat_fieldname = useFieldNameCacheStore().getLatFieldName(req_id);
        const lon_fieldname = useFieldNameCacheStore().getLonFieldName(req_id);

        const filename = await indexedDb.getFilename(req_id);
        summary = await indexedDb.getWorkerSummary(req_id);
        //console.log('_duckDbReadOrCacheSummary req_id:', req_id, ' summary:', summary);

        if (summary && summary.extLatLon && summary.extHMean) {
            //console.log('_duckDbReadOrCacheSummary req_id:', req_id, ' existing summary:', summary);
            return summary;
        } else {
            //console.log('_duckDbReadOrCacheSummary req_id:', req_id, ' Reading new summary');
            const localExtLatLon: ExtLatLon = { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 };
            const localExtHMean: ExtHMean = { minHMean: 100000, maxHMean: -100000, lowHMean: 100000, highHMean: -100000 };
            const duckDbClient = await createDuckDbClient();
            let numPoints = 0;

            try {
                await duckDbClient.insertOpfsParquet(filename);
                //console.log('_duckDbReadOrCacheSummary height_fieldname:', height_fieldname);
                const results = await duckDbClient.query(`
                    SELECT
                        MIN(${duckDbClient.escape(lat_fieldname)}) FILTER (WHERE NOT isnan(${duckDbClient.escape(lat_fieldname)})) AS minLat,
                        MAX(${duckDbClient.escape(lat_fieldname)}) FILTER (WHERE NOT isnan(${duckDbClient.escape(lat_fieldname)})) AS maxLat,
                        MIN(${duckDbClient.escape(lon_fieldname)}) FILTER (WHERE NOT isnan(${duckDbClient.escape(lon_fieldname)})) AS minLon,
                        MAX(${duckDbClient.escape(lon_fieldname)}) FILTER (WHERE NOT isnan(${duckDbClient.escape(lon_fieldname)})) AS maxLon,
                        MIN(${duckDbClient.escape(height_fieldname)}) FILTER (WHERE NOT isnan(${duckDbClient.escape(height_fieldname)})) AS minHMean,
                        MAX(${duckDbClient.escape(height_fieldname)}) FILTER (WHERE NOT isnan(${duckDbClient.escape(height_fieldname)})) AS maxHMean,
                        PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY ${duckDbClient.escape(height_fieldname)}) 
                            FILTER (WHERE NOT isnan(${duckDbClient.escape(height_fieldname)})) AS perc10HMean,
                        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ${duckDbClient.escape(height_fieldname)}) 
                            FILTER (WHERE NOT isnan(${duckDbClient.escape(height_fieldname)})) AS perc90HMean,
                        COUNT(*) AS numPoints
                    FROM '${filename}'
                `);
                //console.log('_duckDbReadOrCacheSummary results:', results);
                // Collect rows from the async generator in chunks
                const rows: SummaryRowData[] = [];
                for await (const chunk of results.readRows()) {
                    for (const row of chunk) {
                        const typedRow: SummaryRowData = {
                            minLat: row.minLat,
                            maxLat: row.maxLat,
                            minLon: row.minLon,
                            maxLon: row.maxLon,
                            minHMean: row.minHMean,
                            maxHMean: row.maxHMean,
                            lowHMean: row.perc10HMean,
                            highHMean: row.perc90HMean,
                            numPoints: row.numPoints
                        };
                        //console.log('_duckDbReadOrCacheSummary results:', typedRow);
                        rows.push(typedRow);
                    }
                }

                if (rows.length > 0) {
                    const row = rows[0];
                    //console.log('_duckDbReadOrCacheSummary row:', row);
                    localExtLatLon.minLat = row.minLat;
                    localExtLatLon.maxLat = row.maxLat;
                    localExtLatLon.minLon = row.minLon;
                    localExtLatLon.maxLon = row.maxLon;
                    localExtHMean.minHMean = row.minHMean;
                    localExtHMean.maxHMean = row.maxHMean;
                    localExtHMean.lowHMean = row.lowHMean;
                    localExtHMean.highHMean = row.highHMean;
                    numPoints = row.numPoints;
                    summary = { req_id: req_id, extLatLon: localExtLatLon, extHMean: localExtHMean, numPoints: numPoints };
                    await indexedDb.addNewSummary(summary);
                    await indexedDb.updateRequestRecord( {req_id:req_id, cnt:numPoints},false);
                    useCurReqSumStore().setSummary(summary);
                    if(numPoints <= 0){
                        console.warn('No points returned: numPoints is zero');
                    }
                } else {
                    console.error('No rows returned');
                    throw new Error('No rows returned');
                }
                return await indexedDb.getWorkerSummary(req_id);
            } catch (error) {
                console.error('_duckDbReadOrCacheSummary error:', error);
                throw error;
            }
        }
    } catch (error) {
        console.error('_duckDbReadOrCacheSummary error:', error);
        throw error;
    } finally {
        unlock();
        const endTime = performance.now(); // End time
        console.log(`_duckDbReadOrCacheSummary for ${req_id} took ${endTime - startTime} milliseconds.`,);
    }
}

const computeSamplingRate = async(req_id:number): Promise<number> => {
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
        await setElevationDataOptionsFromFieldNames(reqId.toString(), colNames);
    } catch (error) {
        console.error('prepareDbForReqId error:', error);
        throw error;
    } finally {                                                                    
        const endTime = performance.now(); // End time
        console.log(`prepareDbForReqId for ${reqId} took ${endTime - startTime} milliseconds.`);
    }
}

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

export const duckDbReadAndUpdateElevationData = async (req_id: number,name:string): Promise<ElevationDataItem | null> => {
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

                // **Find the first valid elevation point**
                firstRec = rows.find(isClickable) || null;

                if (firstRec) {
                    // Precompute position data for all rows
                    const lat_fieldname = useFieldNameCacheStore().getLatFieldName(req_id);
                    const lon_fieldname = useFieldNameCacheStore().getLonFieldName(req_id);
                    const height_fieldname = useFieldNameCacheStore().getHFieldName(req_id);
                    positions = rows.map(d => [
                        d[lon_fieldname],
                        d[lat_fieldname],
                        d[height_fieldname] ?? 0
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
            const height_fieldname = useFieldNameCacheStore().getHFieldName(req_id);
            const summary = await readOrCacheSummary(req_id);

            if (summary?.extHMean) {
                useCurReqSumStore().setSummary({
                    req_id: req_id,
                    extLatLon: summary.extLatLon,
                    extHMean: summary.extHMean,
                    numPoints: summary.numPoints
                });
                //console.log('duckDbReadAndUpdateElevationData',height_fieldname,'positions:', positions);
                updateDeckLayerWithObject(name, rows, summary.extHMean, height_fieldname, positions, projName);
                
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
    req_id: number, name:string, chunkSize: number = 10000, maxNumPnts = 10000
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
            console.error('duckDbReadAndUpdateSelectedLayer selected_y_atc is undefined');
            use_y_atc_filter = false;
        }

        if (func.includes('atl06') || func.includes('atl03vp') || func.includes('atl08') || func.includes('atl24')) {
            queryStr = `
                SELECT * FROM read_parquet('${filename}') 
                WHERE rgt = ${rgt}
                AND cycle IN (${cycles.join(', ')})
                AND spot IN (${spots.join(', ')})
            `;
            if (use_y_atc_filter) {
                queryStr += `AND y_atc BETWEEN ${min_y_atc} AND ${max_y_atc}`;
            }
        } else if (func === 'atl03sp') {
            queryStr = `SELECT * FROM '${filename}' `;
            queryStr += useChartStore().getWhereClause(reqIdStr);
        } else {
            console.error('duckDbReadAndUpdateSelectedLayer invalid func:', func);
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
            const height_fieldname = useFieldNameCacheStore().getHFieldName(req_id);
            const summary = await readOrCacheSummary(req_id);
            if (summary?.extHMean) {
                useCurReqSumStore().setSummary({
                    req_id: req_id,
                    extLatLon: summary.extLatLon,
                    extHMean: summary.extHMean,
                    numPoints: summary.numPoints
                });
                // Pass `positions` to the function so it's used efficiently
                updateDeckLayerWithObject(name,rowChunks, summary.extHMean, height_fieldname, positions, projName);
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
        const query = `SELECT DISTINCT rgt FROM '${fileName}' order by rgt ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        //console.log('getAllRgtOptionsInFile queryResult:', queryResult);
        for await (const rowChunk of queryResult.readRows()) {
            //console.log('getAllRgtOptionsInFile rowChunk:', rowChunk);
            for (const row of rowChunk) {
                if (row) {
                    rgtOptions.push({ label: row.rgt.toString(), value: row.rgt });
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
        //console.log(`SrDuckDbUtils.getAllRgtOptionsInFile() took ${endTime - startTime} milliseconds.`,rgtOptions);
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
        //console.log(`SrDuckDbUtils.getPairs() took ${endTime - startTime} milliseconds.`);
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

export async function getAllCycleOptionsInFile(req_id: number): Promise<{ cycles: number[]; cycleOptions: SrListNumberItem[] }> {
    const startTime = performance.now(); // Start time
    const time_fieldname = useFieldNameCacheStore().getTimeFieldName(req_id);
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();

    // Make the parquet file available to DuckDB
    await duckDbClient.insertOpfsParquet(fileName);

    const cycleOptions = [] as SrListNumberItem[];
    const cycles = [] as number[];

    try {
        // Query: get one row per cycle with a single representative time
        // plus all distinct rgts, spots, and gts.
        const query = `
            SELECT 
                cycle,
                ANY_VALUE(${duckDbClient.escape(time_fieldname)}) AS time,  -- We only need any single time
            FROM '${fileName}'
            GROUP BY cycle
            ORDER BY cycle ASC;
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
                const newLabel = `${row.cycle}: ${timeStr}`;

                cycleOptions.push({
                    label: newLabel,
                    value: row.cycle
                });
                cycles.push(row.cycle);
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

export async function getAllFilteredCycleOptionsFromFile(
    req_id: number,
): Promise<SrListNumberItem[]> {
    const startTime = performance.now(); // Start time

    const fileName = await indexedDb.getFilename(req_id);
    const time_fieldname = useFieldNameCacheStore().getTimeFieldName(req_id);
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);
    const cycles: SrListNumberItem[] = [];
    let whereClause = '';
    
    try {
        // Build the WHERE clause dynamically
        
        whereClause = createWhereClause(req_id);

        const query = `
            SELECT 
            cycle, 
            ANY_VALUE(${duckDbClient.escape(time_fieldname)}) AS time 
            FROM '${fileName}'
            ${whereClause}
            GROUP BY cycle 
            ORDER BY cycle ASC;
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
        minMaxValues: Record<string, { min: number; max: number }>,
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
    minMaxValues: Record<string, { min: number; max: number }>;
    normalizedMinMaxValues: Record<string, { min: number; max: number }>;
    dataOrderNdx: Record<string, number>;
}> {
    const timeField = useFieldNameCacheStore().getTimeFieldName(parseInt(reqIdStr));
    //console.log('fetchScatterData reqIdStr:', reqIdStr, ' fileName:', fileName, ' x:', x, ' y:', y, ' options:', options);
    // Ensure 'time' is in the y array
    if (!y.includes(timeField)) {
        y = [...y, timeField];
    }
    // Ensure 'cycle' is in the y array
    if (!y.includes('cycle')) {
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
    const minMaxValues: Record<string, { min: number; max: number }> = {};
    let normalizedMinMaxValues: Record<string, { min: number; max: number }> = {};
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
        const minMaxQuery = `
            SELECT
                MIN(${x}) as min_x,
                MAX(${x}) as max_x,
                ${y
                    .map(
                        (yName) => `MIN(${yName}) as min_${yName}, MAX(${yName}) as max_${yName}`
                    )
                    .join(', ')},
                ${extraSelectColumns
                    .map(
                        (colName) =>
                            `MIN(${colName}) as min_${colName}, MAX(${colName}) as max_${colName}`
                    )
                    .join(', ')}
            FROM '${fileName}'
            ${finalWhereClause}
        `;

        const queryResultMinMax: QueryResult = await duckDbClient.query(minMaxQuery);
        //console.log('fetchScatterData minMaxQuery:', minMaxQuery);
        //console.log('fetchScatterData queryResultMinMax:', queryResultMinMax);

        for await (const rowChunk of queryResultMinMax.readRows()) {
            for (const row of rowChunk) {
                if (!row) {
                    console.warn('fetchScatterData: rowData is null in min/max query');
                    continue;
                }

                if (handleMinMaxRow) {
                    handleMinMaxRow(reqIdStr, row);
                } else {
                    // Example usage: set min/max in the store
                    useChartStore().setMinX(reqIdStr, 0);
                    useChartStore().setMaxX(reqIdStr, row.max_x - row.min_x);
                }

                // Populate minMaxValues, but exclude NaN values (should be unnecessary now that we filter in SQL)
                if (!isNaN(row.min_x) && !isNaN(row.max_x)) {
                    minMaxValues['x'] = { min: row.min_x, max: row.max_x };
                }

                y.forEach((yName) => {
                    const minY = row[`min_${yName}`];
                    const maxY = row[`max_${yName}`];
                    if (!isNaN(minY) && !isNaN(maxY)) {
                        minMaxValues[yName] = { min: minY, max: maxY };
                    }
                });

                extraSelectColumns.forEach((colName) => {
                    const minCol = row[`min_${colName}`];
                    const maxCol = row[`max_${colName}`];
                    if (!isNaN(minCol) && !isNaN(maxCol)) {
                        minMaxValues[colName] = { min: minCol, max: maxCol };
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
                        minMaxValues,
                        dataOrderNdx,
                        orderNdx
                    );
                } else {
                    // Default transformation:
                    const xVal = normalizeX ? row[x] - minMaxValues['x'].min : row[x];
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
        normalizedMinMaxValues = { ...minMaxValues };
        if (normalizeX) {
            normalizedMinMaxValues['x'] = {
                min: 0,
                max: minMaxValues['x'].max - minMaxValues['x'].min
            };
        }

        useChartStore().setXLegend(reqIdStr, `${x} (normalized) - Meters`);
        //console.log('fetchScatterData chartData:', chartData);
        //console.log('fetchScatterData minMaxValues:', minMaxValues);
        //console.log('fetchScatterData normalizedMinMaxValues:', normalizedMinMaxValues);
        //console.log('fetchScatterData dataOrderNdx:', dataOrderNdx);
        return { chartData, minMaxValues, normalizedMinMaxValues, dataOrderNdx };

    } catch (error) {
        console.error('fetchScatterData Error:', error);
        return { chartData: {}, minMaxValues: {}, normalizedMinMaxValues: {}, dataOrderNdx: {} };
    } finally {
        const endTime = performance.now();
        console.log(`fetchScatterData took ${endTime - startTime} ms.`);
    }
}
