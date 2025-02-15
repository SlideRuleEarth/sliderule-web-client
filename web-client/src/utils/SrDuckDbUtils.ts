import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { createDuckDbClient, type QueryResult } from '@/utils//SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { EL_LAYER_NAME, updateElLayerWithObject,updateSelectedLayerWithObject,type ElevationDataItem } from '@/utils/SrMapUtils';
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
import { clicked } from '@/utils/SrMapUtils'
import { createWhereClause } from './spotUtils';

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
        if (useSrParquetCfgStore().getParquetReader().name === 'duckDb') {
            const height_fieldname = getHFieldName(req_id);
            return await _duckDbReadOrCacheSummary(req_id,height_fieldname);    
        } else {
            throw new Error('readOrCacheSummary unknown reader');
        }
    } catch (error) {
        console.error('readOrCacheSummary error:',error);
        throw error;
    }
}

export async function getDefaultElOptions(reqId:number) : Promise<string[]>{
    try{
        const funcStr = useRecTreeStore().findApiForReqId(reqId);
        if (funcStr === 'atl06p') {
            return ['h_mean','rms_misfit','h_sigma','n_fit_photons','dh_fit_dx','pflags','w_surface_window_final'];
        } else if (funcStr === 'atl06sp') {
            return ['h_li'];
        } else if (funcStr=== 'atl03vp'){
            return ['segment_ph_cnt'];
        } else if (funcStr=== 'atl03sp'){
            return ['height','yapc_score','atl03_cnf','atl08_class'];
        } else if (funcStr==='atl08p'){
            return ['h_mean_canopy'];
        } else if (funcStr===('gedi02ap')) {
            return ['elevation_hr'];
        } else if (funcStr===('gedi04ap')) {
            return ['agbd'];
        } else if(funcStr===('gedi01bp')) {
            return ['elevation_start'];
        } else {
            throw new Error(`Unknown height fieldname for reqId:${reqId} - ${funcStr} in getHFieldName`);
        }  
    } catch (error) {
        console.error('getDefaultElOptions error:',error);
        throw error;  
    }
}

export function getHFieldNameForFuncStr(funcStr:string): string {
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
        throw new Error(`Unknown height fieldname for API: ${funcStr} in getHFieldName`);
    }
}
export function getHFieldName(reqId:number): string {
    const funcStr = useRecTreeStore().findApiForReqId(reqId);
    try{
        return getHFieldNameForFuncStr(funcStr);
    } catch (error) {
        console.error(`getHFieldName for ${reqId} error:`,error);
        throw error;
    }
}


async function setElevationDataOptionsFromFieldNames(reqIdStr: string, fieldNames: string[]) {
    try {
        const chartStore = useChartStore();
        // Update elevation data options in the chart store
        chartStore.setElevationDataOptions(reqIdStr, fieldNames);
        const reqId = parseInt(reqIdStr);
        // Get the height field name
        const heightFieldname = getHFieldName(reqId);

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
        console.log('setElevationDataOptionsFromFieldNames', { reqIdStr, fieldNames, heightFieldname, ndx } );
    } catch (error) {
        console.error('Error in setElevationDataOptionsFromFieldNames:', error);
    }
}

async function _duckDbReadOrCacheSummary(req_id: number, height_fieldname: string): Promise<SrRequestSummary | undefined> {
    const unlock = await srMutex.lock();
    try {
        const filename = await indexedDb.getFilename(req_id);
        const summary = await indexedDb.getWorkerSummary(req_id);
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
                        MIN(latitude) as minLat,
                        MAX(latitude) as maxLat,
                        MIN(longitude) as minLon,
                        MAX(longitude) as maxLon,
                        MIN(${duckDbClient.escape(height_fieldname)}) as minHMean,
                        MAX(${duckDbClient.escape(height_fieldname)}) as maxHMean,
                        PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY ${duckDbClient.escape(height_fieldname)}) AS perc10HMean,
                        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ${duckDbClient.escape(height_fieldname)}) AS perc90HMean,
                        COUNT(*) as numPoints
                        FROM
                        '${filename}'
                `);

                // Collect rows from the async generator in chunks
                const rows: SummaryRowData[] = [];
                //console.log('_duckDbReadOrCacheSummary results:', results);
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
                    await indexedDb.addNewSummary({ req_id: req_id, extLatLon: localExtLatLon, extHMean: localExtHMean, numPoints: numPoints });
                    await indexedDb.updateRequestRecord( {req_id:req_id, cnt:numPoints});
                    useCurReqSumStore().setSummary({ req_id: req_id, extLatLon: localExtLatLon, extHMean: localExtHMean, numPoints: numPoints });
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
        console.log(`prepareDbForReqId for ${reqId} fileName:${fileName}`);
        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);
        const colNames = await duckDbClient.queryForColNames(fileName);
        updateAllFilterOptions(reqId);
        await setElevationDataOptionsFromFieldNames(reqId.toString(), colNames);
    } catch (error) {
        console.error('prepareDbForReqId error:', error);
        throw error;
    } finally {                                                                    
        const endTime = performance.now(); // End time
        console.log(`prepareDbForReqId for ${reqId} took ${endTime - startTime} milliseconds.`);
    }
}

export const duckDbReadAndUpdateElevationData = async (req_id: number):Promise<ElevationDataItem|null> => {
    //console.log('duckDbReadAndUpdateElevationData req_id:', req_id);
    let firstRec = null;
    let srViewName = await indexedDb.getSrViewName(req_id);
    if((!srViewName) || (srViewName == '') || (srViewName === 'Global')){
        srViewName = 'Global Mercator Esri';
        console.error(`HACK ALERT!! inserting srViewName:${srViewName} for reqId:${req_id}`);
    }
    const projName = srViews.value[srViewName].projectionName;
    if(req_id === undefined || req_id === null || req_id === 0){
        console.error('duckDbReadAndUpdateElevationData Bad req_id:', req_id);
        return null;
    }
    const startTime = performance.now(); // Start time
    useMapStore().setIsLoading();
    try {
        if (await indexedDb.getStatus(req_id) === 'error') {
            console.error('duckDbReadAndUpdateElevationData req_id:', req_id, ' status is error SKIPPING!');
            //removeCurrentDeckLayer();
            return null;
        }
        // Step 1: Initialize the DuckDB client
        const duckDbClient = await createDuckDbClient();

        // Step 2: Retrieve the filename using req_id
        const filename = await indexedDb.getFilename(req_id);

        // Step 3: Register the Parquet file with DuckDB
        await duckDbClient.insertOpfsParquet(filename);
        // Step 4: Execute a SQL query to retrieve the elevation data

        let numDataItemsUsed = 0;
        let rows: ElevationDataItem[] = [];
        useMapStore().setCurrentRows(0);
        useMapStore().setTotalRows(0);
    
        try{
            const sample_fraction = await computeSamplingRate(req_id);
            // Execute the query
            const result = await duckDbClient.queryChunkSampled(`SELECT * FROM '${filename}'`,  sample_fraction);
            if(result.totalRows){
                //console.log('duckDbReadAndUpdateElevationData totalRows:', result.totalRows);
                useMapStore().setTotalRows(result.totalRows);
            } else {
                if(result.schema === undefined){
                    console.warn('duckDbReadAndUpdateElevationData totalRows and schema are undefined result:', result);
                }
            }
            const iterator = result.readRows();
            const { value, done } = await iterator.next();
            
            if (!done && value) {
                rows = value as ElevationDataItem[];
                firstRec = (rows[0]);
                const cycleOptions = await getAllCycleOptions(useRecTreeStore().selectedReqId);
                useGlobalChartStore().setCycleOptions(cycleOptions);
                clicked(firstRec);
                numDataItemsUsed += rows.length;
                useMapStore().setCurrentRows(numDataItemsUsed);
                     
                if (numDataItemsUsed === 0) {
                    console.warn('duckDbReadAndUpdateElevationData no data items processed');
                    useSrToastStore().warn('No Data Processed','No data items processed. Not Data returned for this region and request parameters.');
                } else {
                    //console.log('duckDbReadAndUpdateElevationData numDataItems:', numDataItems);
                }
            } else {
                console.warn('duckDbReadAndUpdateElevationData no data items processed');
                useSrToastStore().warn('No Data Processed','No data items processed. Not Data returned for this region and request parameters.');
            }
        } catch (error) {
            console.error('duckDbReadAndUpdateElevationData error processing chunk:', error);
            throw error;
        }
        const name = EL_LAYER_NAME+'_'+req_id.toString();
        const height_fieldname = getHFieldName(req_id);
        const summary = await readOrCacheSummary(req_id);
        if(summary?.extHMean){
            useCurReqSumStore().setSummary({ req_id: req_id, extLatLon: summary.extLatLon, extHMean: summary.extHMean, numPoints: summary.numPoints });
            updateElLayerWithObject(name,rows as ElevationDataItem[], summary.extHMean, height_fieldname, projName);
        } else {
            console.error('duckDbReadAndUpdateElevationData summary is undefined');
        }
        await prepareDbForReqId(req_id);

    } catch (error) {
        console.error('duckDbReadAndUpdateElevationData error:', error);
        throw error;
    } finally {
        useMapStore().resetIsLoading();
        const endTime = performance.now(); // End time
        console.log(`duckDbReadAndUpdateElevationData for ${req_id} took ${endTime - startTime} milliseconds. endTime:${endTime}`);
        return firstRec;
    }
};

export const duckDbReadAndUpdateSelectedLayer = async (req_id: number, chunkSize:number=10000, maxNumPnts=10000) => {
    if(req_id === undefined || req_id === null || req_id === 0){
        console.error('duckDbReadAndUpdateSelectedLayer Bad req_id:', req_id);
        return;
    }
    const startTime = performance.now(); // Start time
    const reqIdStr = req_id.toString();
    try {
        if (await indexedDb.getStatus(req_id) === 'error') {
            console.error('duckDbReadAndUpdateSelectedLayer req_id:', req_id, ' status is error SKIPPING!');
            return;
        }

        //useAtlChartFilterStore().setReqId(req_id);
        // Step 1: Initialize the DuckDB client
        const duckDbClient = await createDuckDbClient();

        // Step 2: Retrieve the filename and func using req_id
        const filename = await indexedDb.getFilename(req_id);
        const func = await indexedDb.getFunc(req_id);
        let queryStr = '';
        const globalChartStore = useGlobalChartStore();
        const rgts = globalChartStore.getRgts();
        const cycles = globalChartStore.getCycles(); 
        const spots = globalChartStore.getSpots();
        if(func.includes('atl06')){
            //console.log('duckDbReadAndUpdateSelectedLayer beams:', beams);
            queryStr = `
                        SELECT * FROM '${filename}' 
                        WHERE rgt IN (${rgts.join(', ')}) 
                        AND cycle IN (${cycles.join(', ')})
                        AND spot IN (${spots.join(', ')})
                        `
        } else if(func === 'atl03sp'){
            //console.log('duckDbReadAndUpdateSelectedLayer tracks:', tracks);            
            queryStr = `SELECT * FROM '${filename}' `;
            queryStr += useChartStore().getWhereClause(reqIdStr);
        } else if(func.includes('atl03vp')){
            //console.log('duckDbReadAndUpdateSelectedLayer beams:', beams);
            queryStr = `
                        SELECT * FROM '${filename}' 
                        WHERE rgt IN (${rgts.join(', ')}) 
                        AND cycle IN (${cycles.join(', ')})
                        AND spot IN (${spots.join(', ')})
                        `
        } else if(func.includes('atl08')){
            //console.log('duckDbReadAndUpdateSelectedLayer beams:', beams);
            queryStr = `
                        SELECT * FROM '${filename}' 
                        WHERE rgt IN (${rgts.join(', ')}) 
                        AND cycle IN (${cycles.join(', ')})
                        AND spot IN (${spots.join(', ')})
                        `
        } else {
            console.error('duckDbReadAndUpdateSelectedLayer invalid func:', func);
        }
        // Step 3: Register the Parquet file with DuckDB
        await duckDbClient.insertOpfsParquet(filename);

        // Step 4: Execute a SQL query to retrieve the elevation data
        //console.log(`duckDbReadAndUpdateSelectedLayer for req:${req_id} PRE Query took ${performance.now() - startTime} milliseconds.`);
        //console.log('duckDbReadAndUpdateSelectedLayer queryStr:', queryStr);
        // Calculate the offset for the query
        let numDataItems = 0;
        const rowChunks: ElevationDataItem[] = [];

        try{
            // Execute the query
            //console.log('duckDbReadAndUpdateSelectedLayer queryStr:', queryStr);
            const sample_fraction = await computeSamplingRate(req_id);
            const result = await duckDbClient.queryChunkSampled(queryStr,sample_fraction);
            //console.log(`duckDbReadAndUpdateSelectedLayer for ${req_id} offset:${offset} POST Query took ${performance.now() - startTime} milliseconds.`);
            for await (const rowChunk of result.readRows()) {
                //console.log('duckDbReadAndUpdateSelectedLayer chunk.length:', rowChunk.length);
                if (rowChunk.length > 0) {
                    numDataItems += rowChunk.length;
                    rowChunks.push(...rowChunk);
                    // Read and process each chunk from the QueryResult
                    //console.log('duckDbReadAndUpdateSelectedLayer rowChunks:', rowChunks);
                }
            }

            if (numDataItems === 0) {
                console.warn('duckDbReadAndUpdateSelectedLayer no data items processed');
            } else {
                //console.log('duckDbReadAndUpdateSelectedLayer numDataItems:', numDataItems);
            }
        } catch (error) {
            console.error('duckDbReadAndUpdateSelectedLayer error processing chunk:', error);
            throw error;
        }
        
        const srViewName = await indexedDb.getSrViewName(req_id);
        const projName = srViews.value[srViewName].projectionName;
        updateSelectedLayerWithObject(rowChunks as ElevationDataItem[], projName);
 
    } catch (error) {
        console.error('duckDbReadAndUpdateSelectedLayer error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`duckDbReadAndUpdateSelectedLayer for ${req_id} took ${endTime - startTime} milliseconds. endTime:${endTime}`);
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

export async function getAllRgtOptions(req_id: number): Promise<SrListNumberItem[]> {
    const startTime = performance.now(); // Start time
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    await duckDbClient.insertOpfsParquet(fileName);
    const rgtOptions = [] as SrListNumberItem[];
    try{
        const query = `SELECT DISTINCT rgt FROM '${fileName}' order by rgt ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    //console.log('getRgt row:', row);
                    rgtOptions.push({ label: row.rgt.toString(), value: row.rgt });
                } else {
                    console.warn('getRgts fetchData rowData is null');
                }
            }
        } 
    } catch (error) {
        console.error('getRgt Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        //console.log(`SrDuckDbUtils.getRgts() took ${endTime - startTime} milliseconds.`);
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

export async function getAllCycleOptions(req_id: number): Promise<SrListNumberItem[]> {
    const startTime = performance.now(); // Start time

    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();

    // Make the parquet file available to DuckDB
    await duckDbClient.insertOpfsParquet(fileName);

    const cycles = [] as SrListNumberItem[];

    try {
        // Query: get one row per cycle with a single representative time
        // plus all distinct rgts, spots, and gts.
        const query = `
            SELECT 
                cycle,
                ANY_VALUE(time) AS time,  -- We only need any single time
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
                    console.warn('getAllCycleOptions rowData is null or undefined');
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

                cycles.push({
                    label: newLabel,
                    value: row.cycle
                });
            }
        }
    } catch (error) {
        console.error('getAllCycleOptions Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`getAllCycleOptions took ${endTime - startTime} ms.`, cycles);
    }

    return cycles;
}

export async function getAllCycleOptionsByRgtsSpotsAndGts(
    req_id: number,
): Promise<SrListNumberItem[]> {
    const startTime = performance.now(); // Start time

    const fileName = await indexedDb.getFilename(req_id);
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
            ANY_VALUE(time) AS time 
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
                        'getAllCycleOptionsByRgtsSpotsAndGts fetchData rowData is null'
                    );
                }
            }
        }

        console.log(
            'getAllCycleOptionsByRgtsSpotsAndGts req_id:',
            req_id,
            'cycles:',
            cycles,
            'whereClause:',
            whereClause
        );

    } catch (error) {
        console.error('getAllCycleOptionsByRgtsSpotsAndGts Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(
            `getAllCycleOptionsByRgtsSpotsAndGts took ${endTime - startTime} milliseconds.`,
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
        const rgts = await getAllRgtOptions(req_id);
        globalChartStore.setRgtOptions(rgts);
        const cycles = await getAllCycleOptions(req_id);
        globalChartStore.setCycleOptions(cycles);
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
    // Ensure 'time' is in the y array
    if (!y.includes('time')) {
        y = [...y, 'time'];
    }
    // Ensure cycle is in the y array
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
    //console.log('fetchScatterData (single array) reqIdStr:', reqIdStr, 'fileName:', fileName);

    // We'll store everything under a single key = reqIdStr
    const chartData: Record<string, SrScatterChartDataArray> = {
        [reqIdStr]: { data: [] }
    };

    const duckDbClient = await createDuckDbClient();
    const minMaxValues: Record<string, { min: number; max: number }> = {};
    let normalizedMinMaxValues: Record<string, { min: number; max: number }> = {};
    let dataOrderNdx: Record<string, number> = {};
    let orderNdx=0;

    try {
        await duckDbClient.insertOpfsParquet(fileName);
        /**
         * 1. Compute min/max for x and each of the y columns.
         */
        const minMaxQuery = `
            SELECT 
                MIN(${x}) as min_x,
                MAX(${x}) as max_x,
                ${y.map(
                    (yName) => `MIN(${yName}) as min_${yName}, MAX(${yName}) as max_${yName}`
                ).join(', ')},
                ${extraSelectColumns.map(
                    (colName) => `MIN(${colName}) as min_${colName}, MAX(${colName}) as max_${colName}`
                ).join(', ')}
            FROM '${fileName}'
                ${whereClause}`;

        const queryResultMinMax: QueryResult = await duckDbClient.query(minMaxQuery);
        for await (const rowChunk of queryResultMinMax.readRows()) {
            for (const row of rowChunk) {
                if (!row) {
                    console.warn('fetchScatterData: rowData is null in min/max query');
                    continue;
                }
        
                if (handleMinMaxRow) {
                    handleMinMaxRow(reqIdStr, row);
                } else {
                    useChartStore().setMinX(reqIdStr, 0);
                    useChartStore().setMaxX(reqIdStr, row.max_x - row.min_x);
                }
        
                // Populate minMaxValues, but exclude NaN values
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
         * 2. Build the main query to fetch rows for x, all y columns, plus extras.
         */
        const allColumns = [x, ...y, ...extraSelectColumns].join(', ');
        // be cognizent of spaces and line breaks in the query
        let mainQuery = `SELECT ${allColumns} \nFROM '${fileName}'\n${whereClause}`;

        useChartStore().setQuerySql(reqIdStr, mainQuery);

        const queryResultMain: QueryResult = await duckDbClient.query(
            useChartStore().getQuerySql(reqIdStr)
        );

        /**
         * 3. For each row, produce an array: [ xVal, yVal1, yVal2, ..., extras ]
         *    and push it into chartData[reqIdStr].data
         */
        for await (const rowChunk of queryResultMain.readRows()) {
            for (const row of rowChunk) {
                if (!row) {
                    console.warn('fetchScatterData: rowData is null in main query');
                    continue;
                }
        
                let rowValues: number[] = [];
        
                if (transformRow) {
                    // If user provided a custom transformation, use that.
                    // The callback can return an array in the shape [x, y1, y2, ..., extras].
                    [rowValues,orderNdx] = transformRow(row, x, y, minMaxValues,dataOrderNdx,orderNdx);
                } else {
                    // Default transformation:
                    //
                    // 1) The first entry is xVal (normalized if `normalizeX` is true).
                    // 2) Then each y value.
                    // 3) Then any extras if you like.
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
        
                // **Exclude rows that contain NaN values**
                if (rowValues.some((val) => isNaN(val))) {
                    console.warn('Skipping row due to NaN values:', rowValues);
                    continue;
                }
        
                chartData[reqIdStr].data.push(rowValues);
            }
        }
        
        /**
         * 4. If we are normalizing X, adjust min=0 and max=(max-min).
         *    Otherwise, keep original min/max as-is.
         */
        normalizedMinMaxValues = { ...minMaxValues };
        if (normalizeX) {
            normalizedMinMaxValues['x'] = {
                min: 0,
                max: minMaxValues['x'].max - minMaxValues['x'].min
            };
        }

        // Optionally set an axis legend
        useChartStore().setXLegend(reqIdStr, `${x} (normalized) - Meters`);
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
