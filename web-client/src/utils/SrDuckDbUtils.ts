import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { createDuckDbClient, type QueryResult } from './SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { updateElLayerWithObject,type ElevationDataItem } from './SrMapUtils';
import { getHeightFieldname } from "./SrParquetUtils";
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { removeCurrentDeckLayer } from './SrMapUtils';
//import type { SrScatterOptionsParms } from './parmUtils';

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
        console.log('duckDbReadOrCacheSummary req_id:', req_id, ' summary:', summary);
        
        if (summary) {
            return summary;
        } else {
            const localExtLatLon: ExtLatLon = { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 };
            const localExtHMean: ExtHMean = { minHMean: 100000, maxHMean: -100000, lowHMean: 100000, highHMean: -100000 };
            const duckDbClient = await createDuckDbClient();
            
            try {
                await duckDbClient.insertOpfsParquet(filename);
                console.log('duckDbReadOrCacheSummary height_fieldname:', height_fieldname);

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
                
                // Collect rows from the async generator
                const rows: SummaryRowData[] = [];
                for await (const row of results.readRows()) {
                    const rowData = row[0]; // Assuming readRows returns an array of rows
                    const typedRow: SummaryRowData = {
                        minLat: rowData.minLat,
                        maxLat: rowData.maxLat,
                        minLon: rowData.minLon,
                        maxLon: rowData.maxLon,
                        minHMean: rowData.minHMean,
                        maxHMean: rowData.maxHMean,
                        lowHMean: rowData.perc10HMean,
                        highHMean: rowData.perc90HMean
                    };
                    //console.log('duckDbReadOrCacheSummary typedRow:', typedRow);
                    rows.push(typedRow);
                    //console.log('duckDbReadOrCacheSummary rows:', rows);
                }
                if (rows.length > 0) {
                    const row = rows[0];
                    //console.log('duckDbReadOrCacheSummary row:', row);
                    localExtLatLon.minLat = row.minLat;
                    localExtLatLon.maxLat = row.maxLat;
                    localExtLatLon.minLon = row.minLon;
                    localExtLatLon.maxLon = row.maxLon;
                    localExtHMean.minHMean = row.minHMean;
                    localExtHMean.maxHMean = row.maxHMean;
                    localExtHMean.lowHMean = row.lowHMean;
                    localExtHMean.highHMean = row.highHMean;
                    //console.log('duckDbReadOrCacheSummary localExtLatLon:', localExtLatLon, ' localExtHMean:', localExtHMean);
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

export const duckDbReadAndUpdateElevationData = async (req_id:number) => {
    console.log('duckDbReadAndUpdateElevationData req_id:',req_id);
    const startTime = performance.now(); // Start time
    try{
        if(await indexedDb.getStatus(req_id) === 'error'){
            console.log('duckDbReadAndUpdateElevationData req_id:',req_id,' status is error SKIPPING!');
            removeCurrentDeckLayer();
            return;
        }
        useAtlChartFilterStore().setReqId(req_id);
        const height_fieldname = await getHeightFieldname(req_id);
        //console.log('duckDbReadAndUpdateElevationData req_id:',req_id);
        const summary = await duckDbReadOrCacheSummary(req_id,height_fieldname);
        //console.log('duckDbReadAndUpdateElevationData summary:',summary);
        if(summary){
            //console.log('duckDbReadAndUpdateElevationData summary:',summary);
            useCurReqSumStore().setSummary(summary);

            // Step 1: Initialize the DuckDB client
            const duckDbClient = await createDuckDbClient();

            // Step 2: Retrieve the filename using req_id
            const filename = await indexedDb.getFilename(req_id);
            
            // Step 3: Register the Parquet file with DuckDB
            await duckDbClient.insertOpfsParquet(filename);
            // Step 4: Execute a SQL query to retrieve the elevation data
            console.log(`duckDbReadAndUpdateElevationData for req:${req_id} PRE  Query took ${performance.now() - startTime} milliseconds.`);

            // Execute the query
            const results = await duckDbClient.query(`SELECT * FROM '${filename}'`);
            //console.log('duckDbReadAndUpdateElevationData results:', results);
            console.log(`duckDbReadAndUpdateElevationData for ${req_id} POST Query took ${performance.now() - startTime} milliseconds.`);

            // Read all rowChunks from the QueryResult
            const rowChunks: ElevationDataItem[] = [];
            for await (const rowChunk of results.readRows()) {
                rowChunks.push(rowChunk);
            }
            //console.log('duckDbReadAndUpdateElevationData rowChunks:',rowChunks, 'rowChunks[0][0]',rowChunks[0][0],'rowChunks[0]',rowChunks[0],'rowChunks[0].length:',rowChunks[0].length,'rowChunks.length:',rowChunks.length);
            const fieldNames = Object.keys(rowChunks[0][0]);
            console.log('duckDbReadAndUpdateElevationData fieldNames:',fieldNames);
            await useAtlChartFilterStore().setElevationDataOptionsFromFieldNames(fieldNames);
            // Process and update the elevation data as needed
            // Assuming rowChunks is an array of ElevationDataItem[] arrays
            let numDataItems = 0;
            if (rowChunks.length > 0) {
                for (const chunk of rowChunks) {
                    numDataItems += chunk.length;
                    updateElLayerWithObject(chunk as ElevationDataItem[], summary.extHMean, height_fieldname);
                }
            } else {
                console.warn('duckDbReadAndUpdateElevationData rowChunks is empty');
            }
            console.log('duckDbReadAndUpdateElevationData rowChunks.length:',rowChunks.length,' numDataItems:',numDataItems);
        } else {
            console.error('duckDbReadAndUpdateElevationData summary is undefined');
        }
    } catch (error) {
        console.error('duckDbReadAndUpdateElevationData error:',error);
        throw error;
    } finally {
        const endTime = performance.now(); // End time
        console.log(`duckDbReadAndUpdateElevationData for ${req_id} took ${endTime - startTime} milliseconds.`);
    }
}

export async function duckDbLoadOpfsParquetFile(fileName: string) {
    try{
        console.log('duckDbLoadOpfsParquetFile');
        const duckDbClient = await createDuckDbClient();

        await duckDbClient.insertOpfsParquet(fileName);

    } catch (error) {
        console.error('duckDbLoadOpfsParquetFile error:',error);
        throw error;
    }
}
