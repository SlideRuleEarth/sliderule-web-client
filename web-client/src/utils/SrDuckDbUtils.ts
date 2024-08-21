import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { createDuckDbClient, type QueryResult } from './SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { updateElLayerWithObject,updateSelectedLayerWithObject,type ElevationDataItem } from './SrMapUtils';
import { getHeightFieldname } from "./SrParquetUtils";
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
//import { removeCurrentDeckLayer } from './SrMapUtils';
import type { SrScatterOptionsParms } from './parmUtils';
import { useMapStore } from '@/stores/mapStore';

interface SummaryRowData {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
    minHMean: number;
    maxHMean: number;
    lowHMean: number;
    highHMean: number;
}

export async function duckDbReadOrCacheSummary(req_id: number, height_fieldname: string): Promise<SrRequestSummary | undefined> {
    try {
        const filename = await indexedDb.getFilename(req_id);
        const summary = await indexedDb.getWorkerSummary(req_id);
        //console.log('duckDbReadOrCacheSummary req_id:', req_id, ' summary:', summary);

        if (summary) {
            return summary;
        } else {
            const localExtLatLon: ExtLatLon = { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 };
            const localExtHMean: ExtHMean = { minHMean: 100000, maxHMean: -100000, lowHMean: 100000, highHMean: -100000 };
            const duckDbClient = await createDuckDbClient();

            try {
                await duckDbClient.insertOpfsParquet(filename);
                //console.log('duckDbReadOrCacheSummary height_fieldname:', height_fieldname);

                const results = await duckDbClient.query(`
                    SELECT
                        MIN(latitude) as minLat,
                        MAX(latitude) as maxLat,
                        MIN(longitude) as minLon,
                        MAX(longitude) as maxLon,
                        MIN(${duckDbClient.escape(height_fieldname)}) as minHMean,
                        MAX(${duckDbClient.escape(height_fieldname)}) as maxHMean,
                        PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY ${duckDbClient.escape(height_fieldname)}) AS perc10HMean,
                        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ${duckDbClient.escape(height_fieldname)}) AS perc90HMean
                    FROM
                        '${filename}'
                `);

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
                            highHMean: row.perc90HMean
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
                    await indexedDb.addNewSummary({ req_id: req_id, extLatLon: localExtLatLon, extHMean: localExtHMean });
                } else {
                    throw new Error('No rows returned');
                }
                return await indexedDb.getWorkerSummary(req_id);
            } catch (error) {
                console.error('duckDbReadOrCacheSummary error:', error);
                throw error;
            }
        }
    } catch (error) {
        console.error('duckDbReadOrCacheSummary error:', error);
        throw error;
    }
}

export const duckDbReadAndUpdateElevationData = async (req_id: number, chunkSize:number=100000, maxNumPnts=1000000) => {
    //console.log('duckDbReadAndUpdateElevationData req_id:', req_id);
    const startTime = performance.now(); // Start time

    try {
        if (await indexedDb.getStatus(req_id) === 'error') {
            console.error('duckDbReadAndUpdateElevationData req_id:', req_id, ' status is error SKIPPING!');
            //removeCurrentDeckLayer();
            return;
        }

        useAtlChartFilterStore().setReqId(req_id);
        const height_fieldname = await getHeightFieldname(req_id);

        const summary = await duckDbReadOrCacheSummary(req_id, height_fieldname);

        if (summary) {
            useCurReqSumStore().setSummary(summary);

            // Step 1: Initialize the DuckDB client
            const duckDbClient = await createDuckDbClient();

            // Step 2: Retrieve the filename using req_id
            const filename = await indexedDb.getFilename(req_id);

            // Step 3: Register the Parquet file with DuckDB
            await duckDbClient.insertOpfsParquet(filename);

            // Step 4: Execute a SQL query to retrieve the elevation data
            //console.log(`duckDbReadAndUpdateElevationData for req:${req_id} PRE Query took ${performance.now() - startTime} milliseconds.`);

            // Calculate the offset for the query
            let offset = 0;
            let hasMoreData = true;
            let numDataItems = 0;
            const rowChunks: ElevationDataItem[] = [];

            while (hasMoreData) {
                try{
                    // Execute the query
                    const result = await duckDbClient.queryChunk(`SELECT * FROM '${filename}'`, chunkSize, offset);
                    if(result.totalRows){
                        console.log('duckDbReadAndUpdateElevationData totalRows:', result.totalRows);
                        useMapStore().setTotalRows(result.totalRows);
                    }
                    //console.log(`duckDbReadAndUpdateElevationData for ${req_id} offset:${offset} POST Query took ${performance.now() - startTime} milliseconds.`);
                    for await (const rowChunk of result.readRows()) {
                        //console.log('duckDbReadAndUpdateElevationData chunk.length:', rowChunk.length);
                        if (rowChunk.length > 0) {
                            if (numDataItems === 0) {
                                // Assuming we only need to set field names once, during the first chunk processing
                                const fieldNames = Object.keys(rowChunk[0]);
                                //console.log('duckDbReadAndUpdateElevationData fieldNames:', fieldNames);
                                await useAtlChartFilterStore().setElevationDataOptionsFromFieldNames(fieldNames);
                            }
                            numDataItems += rowChunk.length;
                            useMapStore().setCurrentRows(numDataItems);
                            rowChunks.push(...rowChunk);
                        }
                    }

                    if (numDataItems === 0) {
                        console.warn('duckDbReadAndUpdateElevationData no data items processed');
                    } else {
                        //console.log('duckDbReadAndUpdateElevationData numDataItems:', numDataItems);
                    }
                    hasMoreData = result.hasMoreData;
                    if(numDataItems >= maxNumPnts){
                        console.warn('duckDbReadAndUpdateElevationData EXCEEDED maxNumPnts:', maxNumPnts, ' SKIPPING rest of file!');
                        hasMoreData = false;
                    }
                    offset += chunkSize;
                } catch (error) {
                    console.error('duckDbReadAndUpdateElevationData error processing chunk:', error);
                    hasMoreData = false;
                    throw error;
                }
            }
            updateElLayerWithObject(rowChunks as ElevationDataItem[], summary.extHMean, height_fieldname);
        } else {
            console.error('duckDbReadAndUpdateElevationData summary is undefined');
        }
    } catch (error) {
        console.error('duckDbReadAndUpdateElevationData error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`duckDbReadAndUpdateElevationData for ${req_id} took ${endTime - startTime} milliseconds. endTime:${endTime}`);
    }
};


export const duckDbReadAndUpdateSelectedLayer = async (req_id: number, chunkSize:number=100000, maxNumPnts=1000000) => {
    //console.log('duckDbReadAndUpdateElevationData req_id:', req_id);
    const startTime = performance.now(); // Start time

    try {
        if (await indexedDb.getStatus(req_id) === 'error') {
            console.error('duckDbReadAndUpdateElevationData req_id:', req_id, ' status is error SKIPPING!');
            //removeCurrentDeckLayer();
            return;
        }

        useAtlChartFilterStore().setReqId(req_id);
        // Step 1: Initialize the DuckDB client
        const duckDbClient = await createDuckDbClient();

        // Step 2: Retrieve the filename and func using req_id
        const filename = await indexedDb.getFilename(req_id);
        const func = await indexedDb.getFunc(req_id);
        let queryStr = `SELECT * FROM '${filename}'`;
        const rgts = useAtlChartFilterStore().getRgtValues();
        const cycles = useAtlChartFilterStore().getCycleValues(); 
        if(func === 'atl06'){
            const beams = useAtlChartFilterStore().getBeamValues();
            //console.log('duckDbReadAndUpdateSelectedLayer beams:', beams);
            queryStr = `
                        SELECT * FROM '${filename}' 
                        WHERE rgt IN (${rgts.join(', ')}) 
                        AND cycle IN (${cycles.join(', ')})
                        AND gt IN (${beams.join(', ')})
                        `
        } else if(func === 'atl03'){
            //console.log('duckDbReadAndUpdateSelectedLayer tracks:', tracks);            
            queryStr = `SELECT * FROM '${filename}' `;
            queryStr += useAtlChartFilterStore().getAtl03WhereClause();
        } else if(func === 'atl08'){
            const beams = useAtlChartFilterStore().getBeamValues();
            //console.log('duckDbReadAndUpdateSelectedLayer beams:', beams);
            queryStr = `
                        SELECT * FROM '${filename}' 
                        WHERE rgt IN (${rgts.join(', ')}) 
                        AND cycle IN (${cycles.join(', ')})
                        AND gt IN (${beams.join(', ')})
                        `
        } else {
            console.error('duckDbReadAndUpdateSelectedLayer invalid func:', func);
        }
        // Step 3: Register the Parquet file with DuckDB
        await duckDbClient.insertOpfsParquet(filename);

        // Step 4: Execute a SQL query to retrieve the elevation data
        //console.log(`duckDbReadAndUpdateSelectedLayer for req:${req_id} PRE Query took ${performance.now() - startTime} milliseconds.`);

        // Calculate the offset for the query
        let offset = 0;
        let hasMoreData = true;
        let numDataItems = 0;
        const rowChunks: ElevationDataItem[] = [];

        while (hasMoreData) {
            try{
                // Execute the query
                //console.log('duckDbReadAndUpdateSelectedLayer queryStr:', queryStr);
                const result = await duckDbClient.queryChunk(queryStr, chunkSize, offset);
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
                hasMoreData = result.hasMoreData;
                if(numDataItems >= maxNumPnts){
                    console.warn('duckDbReadAndUpdateSelectedLayer EXCEEDED maxNumPnts:', maxNumPnts, ' SKIPPING rest of file!');
                    hasMoreData = false;
                }
                offset += chunkSize;
            } catch (error) {
                console.error('duckDbReadAndUpdateSelectedLayer error processing chunk:', error);
                hasMoreData = false;
                throw error;
            }
        }
        updateSelectedLayerWithObject(rowChunks as ElevationDataItem[]);
 
    } catch (error) {
        console.error('duckDbReadAndUpdateSelectedLayer error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`duckDbReadAndUpdateSelectedLayer for ${req_id} took ${endTime - startTime} milliseconds. endTime:${endTime}`);
    }
};


export async function duckDbLoadOpfsParquetFile(fileName: string) {
    const startTime = performance.now(); // Start time
    try{
        //console.log('duckDbLoadOpfsParquetFile');
        const duckDbClient = await createDuckDbClient();

        await duckDbClient.insertOpfsParquet(fileName);

    } catch (error) {
        console.error('duckDbLoadOpfsParquetFile error:',error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`duckDbLoadOpfsParquetFile took ${endTime - startTime} milliseconds.`);
    }   
}

export interface SrScatterChartData { value: number[] };

async function fetchAtl03ScatterData(
    fileName: string, 
    x: string, 
    y: string[], 
) {
    console.log('fetchAtl03ScatterData fileName:', fileName, ' x:', x, ' y:', y);
    const duckDbClient = await createDuckDbClient();
    const chartData: { [key: string]: SrScatterChartData[] } = {};
    const minMaxValues: { [key: string]: { min: number, max: number } } = {};
    const whereClause = useAtlChartFilterStore().getAtl03WhereClause();

    if(whereClause){
        try {
            const yColumns = y.join(", ");
            let query = `
                SELECT 
                    ${x}, 
                    ${yColumns}
                FROM '${fileName}'
                `;
            query += whereClause;

            useAtlChartFilterStore().setAtl03QuerySql(query);
            const queryResult: QueryResult = await duckDbClient.query(useAtlChartFilterStore().getAtl03QuerySql());
            for await (const rowChunk of queryResult.readRows()) {
                for (const row of rowChunk) {
                    if (row) {
                        y.forEach((yName) => {
                            if (!chartData[yName]) {
                                chartData[yName] = [];
                            }
                            chartData[yName].push({
                                value: [row[x], row[yName]]
                            });
                        });
                    } else {
                        console.warn('fetchAtl03ScatterData - fetchData rowData is null');
                    }
                }
            }

            let query2 = `
                SELECT 
                    MIN(${x}) as min_x,
                    MAX(${x}) as max_x,
                    ${y.map(yName => `MIN(${yName}) as min_${yName}, MAX(${yName}) as max_${yName}`).join(", ")}
                FROM '${fileName}'
                `;
            query2 += whereClause;

            const queryResult2: QueryResult = await duckDbClient.query(query2);
            for await (const rowChunk of queryResult2.readRows()) {
                for (const row of rowChunk) {
                    if (row) {
                        useAtlChartFilterStore().setMinX(row.min_x);
                        useAtlChartFilterStore().setMaxX(row.max_x);
                        y.forEach((yName) => {
                            minMaxValues[yName] = { min: row[`min_${yName}`], max: row[`max_${yName}`] };
                        });
                    } else {
                        console.warn('fetchAtl03ScatterData fetchData rowData is null');
                    }
                }
            }
            console.log('fetchAtl03ScatterData minMaxValues:', minMaxValues);
            return { chartData, minMaxValues };
        } catch (error) {
            console.error('fetchAtl03ScatterData fetchData Error fetching data:', error);
            return { chartData: {}, minMaxValues: {} };
        }
    } else {
        console.log('fetchAtl03ScatterData whereClause is undefined');
        return { chartData: {}, minMaxValues: {} };
    }
}

export async function updateRgtOptions(req_id: number): Promise<number[]> {
    const startTime = performance.now(); // Start time
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    const rgts = [] as number[];
    try{
        const query = `SELECT DISTINCT rgt FROM '${fileName}' order by rgt ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    //console.log('getRgt row:', row);
                    rgts.push(row.rgt);
                } else {
                    console.warn('getRgts fetchData rowData is null');
                }
            }
        } 
        useAtlChartFilterStore().setRgtOptionsWithNumbers(rgts);   
    } catch (error) {
        console.error('getRgt Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`SrDuckDbUtils.getRgts() took ${endTime - startTime} milliseconds.`);
    }
    return rgts;
}

export async function getPairs(req_id: number): Promise<number[]> {
    const startTime = performance.now(); // Start time
    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
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
        console.log(`SrDuckDbUtils.getPairs() took ${endTime - startTime} milliseconds.`);
    }
    return pairs;
}

export async function updatePairOptions(req_id: number): Promise<number[]> {
    let pairs = [] as number[];
    try{
        pairs = await getPairs(req_id);
        useAtlChartFilterStore().setPairOptionsWithNumbers(pairs);   
    } catch (error) {
        console.error('getPairs Error:', error);
        throw error;
    }
    console.log('updatePairOptions pairs:', useAtlChartFilterStore().getPairOptions());
    return pairs;
}

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
        console.log(`SrDuckDbUtils.getTracks() took ${endTime - startTime} milliseconds.`);
    }
    return tracks;
}

export async function updateTrackOptions(req_id: number): Promise<number[]> {
    let tracks = [] as number[];
    try{
        tracks = await getTracks(req_id);
        useAtlChartFilterStore().setTrackOptionsWithNumbers(tracks);   
    } catch (error) {
        console.error('getTracks Error:', error);
        throw error;
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
        console.log(`SrDuckDbUtils.getScOrient() took ${endTime - startTime} milliseconds.`);
    }
    return scOrients;
}

export async function updateScOrientOptions(req_id: number): Promise<number[]> {
    let scOrients = [] as number[];
    try{
        scOrients = await getScOrient(req_id);
        useAtlChartFilterStore().setScOrientOptionsWithNumbers(scOrients);   
    } catch (error) {
        console.error('getScOrient Error:', error);
        throw error;
    }
    return scOrients;
}

export async function updateCycleOptions(req_id: number): Promise<number[]> {
    const startTime = performance.now(); // Start time

    const fileName = await indexedDb.getFilename(req_id);
    const duckDbClient = await createDuckDbClient();
    const cycles = [] as number[];
    try{
        const query = `SELECT DISTINCT cycle FROM '${fileName}' order by cycle ASC`;
        const queryResult: QueryResult = await duckDbClient.query(query);
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    //console.log('getCycle row:', row);
                    cycles.push(row.cycle);
                } else {
                    console.warn('getCycles fetchData rowData is null');
                }
            }
        } 
        useAtlChartFilterStore().setCycleOptionsWithNumbers(cycles);   
        console.log('updateCycleOptions cycles:', useAtlChartFilterStore().getCycleOptions());
    } catch (error) {
        console.error('updateCycleOptions Error:', error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`SrDuckDbUtils.getCycles() took ${endTime - startTime} milliseconds.`);
    }
    return cycles;
}
async function fetchAtl06ScatterData(fileName: string, x: string, y: string[], beams: number[], rgts: number[], cycles: number[]) {
    const startTime = performance.now(); // Start time
    const duckDbClient = await createDuckDbClient();
    const chartData: { [key: string]: SrScatterChartData[] } = {};
    const minMaxValues: { [key: string]: { min: number, max: number } } = {};

    try {
        const yColumns = y.join(", ");
        const query = `
            SELECT 
                ${x}, 
                ${yColumns}
            FROM '${fileName}'
            WHERE gt IN (${beams.join(', ')})
            AND rgt IN (${rgts.join(', ')}) 
            AND cycle IN (${cycles.join(', ')})
            `;
    
        useAtlChartFilterStore().setAtl06QuerySql(query);
        const queryResult: QueryResult = await duckDbClient.query(useAtlChartFilterStore().getAtl06QuerySql());
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    y.forEach((yName) => {
                        if (!chartData[yName]) {
                            chartData[yName] = [];
                        }
                        chartData[yName].push({
                            value: [row[x], row[yName]]
                        });
                    });
                } else {
                    console.warn('fetchData rowData is null');
                }
            }
        }

        const query2 = `
            SELECT 
                MIN(${x}) as min_x,
                MAX(${x}) as max_x,
                ${y.map(yName => `MIN(${yName}) as min_${yName}, MAX(${yName}) as max_${yName}`).join(", ")}
            FROM '${fileName}'
            WHERE gt IN (${beams.join(', ')})
            AND rgt IN (${rgts.join(', ')}) 
            AND cycle IN (${cycles.join(', ')})
        `;
        //console.log('fetchAtl06ScatterData query2:', query2);
        const queryResult2: QueryResult = await duckDbClient.query(query2);
        //console.log('fetchAtl06ScatterData queryResult2:', queryResult2);
        for await (const rowChunk of queryResult2.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    useAtlChartFilterStore().setMinX(row.min_x);
                    useAtlChartFilterStore().setMaxX(row.max_x);
                    y.forEach((yName) => {
                        minMaxValues[yName] = { min: row[`min_${yName}`], max: row[`max_${yName}`] };
                    });
                } else {
                    console.warn('fetchData rowData is null');
                }
            }
        }
        //console.log('fetchAtl06ScatterData minMaxValues:', minMaxValues);
        return { chartData, minMaxValues };
    } catch (error) {
        console.error('fetchData Error fetching data:', error);
        return { chartData: {}, minMaxValues: {} };
    } finally {
        const endTime = performance.now(); // End time
        console.log(`fetchAtl06ScatterData took ${endTime - startTime} milliseconds.`);
    }
}

async function fetchAtl08ScatterData(fileName: string, x: string, y: string[], beams: number[], rgts: number[], cycles: number[]) {
    const startTime = performance.now(); // Start time
    const duckDbClient = await createDuckDbClient();
    const chartData: { [key: string]: SrScatterChartData[] } = {};
    const minMaxValues: { [key: string]: { min: number, max: number } } = {};

    try {
        const yColumns = y.join(", ");
        const query = `
            SELECT 
                ${x}, 
                ${yColumns}
            FROM '${fileName}'
            WHERE gt IN (${beams.join(', ')})
            AND rgt IN (${rgts.join(', ')}) 
            AND cycle IN (${cycles.join(', ')})
            `;
    
        useAtlChartFilterStore().setAtl08QuerySql(query);
        const queryResult: QueryResult = await duckDbClient.query(useAtlChartFilterStore().getAtl08QuerySql());
        for await (const rowChunk of queryResult.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    y.forEach((yName) => {
                        if (!chartData[yName]) {
                            chartData[yName] = [];
                        }
                        chartData[yName].push({
                            value: [row[x], row[yName]]
                        });
                    });
                } else {
                    console.warn('fetchData rowData is null');
                }
            }
        }

        const query2 = `
            SELECT 
                MIN(${x}) as min_x,
                MAX(${x}) as max_x,
                ${y.map(yName => `MIN(${yName}) as min_${yName}, MAX(${yName}) as max_${yName}`).join(", ")}
            FROM '${fileName}'
            WHERE gt IN (${beams.join(', ')})
            AND rgt IN (${rgts.join(', ')}) 
            AND cycle IN (${cycles.join(', ')})
        `;
        //console.log('fetchAtl06ScatterData query2:', query2);
        const queryResult2: QueryResult = await duckDbClient.query(query2);
        //console.log('fetchAtl06ScatterData queryResult2:', queryResult2);
        for await (const rowChunk of queryResult2.readRows()) {
            for (const row of rowChunk) {
                if (row) {
                    useAtlChartFilterStore().setMinX(row.min_x);
                    useAtlChartFilterStore().setMaxX(row.max_x);
                    y.forEach((yName) => {
                        minMaxValues[yName] = { min: row[`min_${yName}`], max: row[`max_${yName}`] };
                    });
                } else {
                    console.warn('fetchData rowData is null');
                }
            }
        }
        //console.log('fetchAtl06ScatterData minMaxValues:', minMaxValues);
        return { chartData, minMaxValues };
    } catch (error) {
        console.error('fetchData Error fetching data:', error);
        return { chartData: {}, minMaxValues: {} };
    } finally {
        const endTime = performance.now(); // End time
        console.log(`fetchAtl08ScatterData took ${endTime - startTime} milliseconds.`);
    }
}

interface SrScatterSeriesData{
    series: {
        name: string;
        type: string;
        data: number[][];
        large: boolean;
        largeThreshold: number;
        animation: boolean;
        yAxisIndex: number;
        symbolSize?: number;
    };
    min: number;
    max: number;
};

async function getSeriesForAtl03(fileName: string, x: string, y: string[]): Promise<SrScatterSeriesData[]> {
    console.log('getSeriesForAtl03 fileName:', fileName, ' x:', x, ' y:', y);
    const startTime = performance.now(); // Start time
    let yItems = [] as SrScatterSeriesData[];

    try {
        const name = 'Atl03';
        const { chartData = {}, minMaxValues = {} } = await fetchAtl03ScatterData(fileName, x, y);
        //console.log('getSeriesForAtl03 chartData:', chartData, ' minMaxValues:', minMaxValues);

        // Check if either chartData or minMaxValues is empty
        if (Object.keys(chartData).length === 0 || Object.keys(minMaxValues).length === 0) {
            console.warn('getSeriesForAtl03 chartData or minMaxValues is empty, skipping processing.');
            return yItems; // Return empty array if either is empty
        }

        yItems = y.map(yName => {
            const data = chartData[yName] ? chartData[yName].map(item => item.value) : [];
            const min = minMaxValues[yName]?.min ?? null; // Default to null if minMaxValues[yName] or min is undefined
            const max = minMaxValues[yName]?.max ?? null; // Default to null if minMaxValues[yName] or max is undefined

            return {
                series: {
                    name: `${name} - ${yName}`,
                    type: 'scatter',
                    data: data,
                    large: true,
                    largeThreshold: 100000,
                    animation: false,
                    yAxisIndex: y.indexOf(yName), // Set yAxisIndex to map each series to its respective yAxis
                    symbolSize: useAtlChartFilterStore().getSymbolSize(),
                },
                min: min,
                max: max
            };
        });

    } catch (error) {
        console.error('getSeriesForAtl03 Error:', error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`getSeriesForAtl03 took ${endTime - startTime} milliseconds.`);
    }

    return yItems;
}


async function getSeriesForAtl06( fileName: string, x: string, y: string[], beams: number[], rgts: number[], cycles: number[]): Promise<SrScatterSeriesData[]> {
    //console.log('getSeriesForAtl06 fileName:', fileName, ' x:', x, ' y:', y, ' beams:', beams, ' rgt:', rgt, ' cycle:', cycle);
    const startTime = performance.now();
    const yItems=[] as SrScatterSeriesData[];
    try{
        const name = 'Atl06';
        const { chartData, minMaxValues } = await fetchAtl06ScatterData(fileName, x, y, beams, rgts, cycles);
        if (chartData) {
            return y.map(yName => ({
                name: `${name} - ${yName}`,
                type: 'scatter',
                data: chartData[yName] ? chartData[yName].map(item => item.value) : [],
                large: true,
                largeThreshold: 100000,
                animation: false,
                yAxisIndex: y.indexOf(yName), // Set yAxisIndex to map each series to its respective yAxis
                symbolSize: useAtlChartFilterStore().getSymbolSize(),
            })).map((series, index) => ({
                series,
                min: minMaxValues[y[index]].min,
                max: minMaxValues[y[index]].max
            }));
        }
    } catch (error) {
        console.error('getSeriesForAtl06 Error:', error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`getSeriesForAtl06 took ${endTime - startTime} milliseconds.`);
    }

    return yItems;
}

async function getSeriesForAtl08( fileName: string, x: string, y: string[], beams: number[], rgts: number[], cycles: number[]): Promise<SrScatterSeriesData[]> {
    //console.log('getSeriesForAtl06 fileName:', fileName, ' x:', x, ' y:', y, ' beams:', beams, ' rgt:', rgt, ' cycle:', cycle);
    const startTime = performance.now();
    const yItems=[] as SrScatterSeriesData[];
    try{
        const name = 'Atl08';
        const { chartData, minMaxValues } = await fetchAtl08ScatterData(fileName, x, y, beams, rgts, cycles);
        if (chartData) {
            return y.map(yName => ({
                name: `${name} - ${yName}`,
                type: 'scatter',
                data: chartData[yName] ? chartData[yName].map(item => item.value) : [],
                large: true,
                largeThreshold: 100000,
                animation: false,
                yAxisIndex: y.indexOf(yName), // Set yAxisIndex to map each series to its respective yAxis
                symbolSize: useAtlChartFilterStore().getSymbolSize(),
            })).map((series, index) => ({
                series,
                min: minMaxValues[y[index]].min,
                max: minMaxValues[y[index]].max
            }));
        }
    } catch (error) {
        console.error('getSeriesForAtl08 Error:', error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`getSeriesForAtl08 took ${endTime - startTime} milliseconds.`);
    }

    return yItems;
}

export async function getScatterOptions(sop:SrScatterOptionsParms): Promise<any> {
    const startTime = performance.now(); // Start time
    console.log('getScatterOptions sop:', sop);
    let options = null;
    try{
        let seriesData = [] as SrScatterSeriesData[];
        if(sop.fileName){
            if(sop.func === 'atl06'){
                if(sop.beams?.length && sop.rgts && sop.cycles){
                    //console.log('getScatterOptions atl06 fileName:', sop.fileName, ' x:', sop.x, ' y:', sop.y, ' beams:', sop.beams, ' rgt:', sop.rgt, ' cycle:', sop.cycle);
                    seriesData = await getSeriesForAtl06(sop.fileName, sop.x, sop.y, sop.beams, sop.rgts, sop.cycles);
                } else {
                    console.warn('getScatterOptions atl06 invalid? beams:', sop.beams, ' rgt:', sop.rgts, ' cycle:', sop.cycles);
                }
            } else if(sop.func === 'atl03'){
                seriesData = await getSeriesForAtl03(sop.fileName, sop.x, sop.y);
                //console.log('getScatterOptions atl03 fileName:', sop.fileName, ' x:', sop.x, ' y:', sop.y, 'scOrient:',sop.scOrient, 'pair:',sop.pair, ' rgt:', sop.rgt, ' cycle:', sop.cycle, 'tracks:', sop.tracks);
                // if((sop.rgts) && (sop.cycles) && (sop.tracks != undefined) && sop.tracks.length>0){
                //     seriesData = await getSeriesForAtl03(sop.fileName, sop.x, sop.y, sop.rgts, sop.cycles, sop.tracks, sop.scOrients, sop.pairs);
                // } else {
                //     console.warn('atl03 getScatterOptions INVALID? fileName:', sop.fileName, ' x:', sop.x, ' y:', sop.y, ' rgts:', sop.rgts, ' cycle:', sop.cycles, 'tracks:', sop.tracks, 'scOrient:',sop.scOrients, 'pair:',sop.pairs);
                // }
            } else if(sop.func === 'atl08'){
                if(sop.beams?.length && sop.rgts && sop.cycles){
                    //console.log('getScatterOptions atl08 fileName:', sop.fileName, ' x:', sop.x, ' y:', sop.y, ' beams:', sop.beams, ' rgt:', sop.rgt, ' cycle:', sop.cycle);
                    seriesData = await getSeriesForAtl08(sop.fileName, sop.x, sop.y, sop.beams, sop.rgts, sop.cycles);
                } else {
                    console.warn('getScatterOptions atl06 invalid? beams:', sop.beams, ' rgt:', sop.rgts, ' cycle:', sop.cycles);
                }
            } else {
                console.error('getScatterOptions invalid func:', sop.func);
            }
        } else {
            console.warn('getScatterOptions fileName is null');
        }
        if(seriesData.length !== 0){
            options = {
                title: {
                    text: sop.func,
                    left: "center"
                },
                tooltip: {
                    trigger: "item",
                    formatter: "({c})"
                },
                legend: {
                    data: seriesData.map(series => series.series.name),
                    left: 'left'
                },
                notMerge: true,
                lazyUpdate: true,
                xAxis: {
                    min: useAtlChartFilterStore().getMinX(),
                    max: useAtlChartFilterStore().getMaxX()
                },
                yAxis: seriesData.map((series, index) => ({
                    type: 'value',
                    name: sop.y[index],
                    min: seriesData[index].min,
                    max: seriesData[index].max,
                    scale: true,  // Add this to ensure the axis scales correctly
                    axisLabel: {
                        formatter: (value: number) => value.toFixed(1)  // Format to one decimal place
                    }
                })),
                series: seriesData.map(series => series.series)
            };
        } else {
            console.warn('getScatterOptions seriesData is empty');
        }
        //console.log('getScatterOptions options:', options);
    } catch (error) {
        console.error('getScatterOptions Error:', error);
    } finally {
        const endTime = performance.now(); // End time
        console.log(`getScatterOptions atl03 fileName:${sop.fileName} took ${endTime - startTime} milliseconds.`);
    }
  return options;
}
