import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { createDuckDbClient } from './SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { updateElLayer } from './SrMapUtils';
import { getHeightFieldname } from "./SrParquetUtils";
import { useCurReqSumStore } from '@/stores/curReqSumStore';

export const duckDbClient = await createDuckDbClient();

export async function duckDbReadOrCacheSummary(req_id: number, height_fieldname: string): Promise<SrRequestSummary | undefined> {
    try {
        const filename = await indexedDb.getFilename(req_id);
        const summary = await indexedDb.getWorkerSummary(req_id);
        console.log('readOrCacheSummary req_id:', req_id, ' summary:', summary);
        
        if (summary) {
            return summary;
        } else {
            const localExtLatLon: ExtLatLon = { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 };
            const localExtHMean: ExtHMean = { minHMean: 100000, maxHMean: -100000, lowHMean: 100000, highHMean: -100000 };
            const duckDbClient = await createDuckDbClient();

            try {
                console.log('readOrCacheSummary height_fieldname:', height_fieldname);

                const query = `
                    SELECT
                        MIN(latitude) as minLat,
                        MAX(latitude) as maxLat,
                        MIN(longitude) as minLon,
                        MAX(longitude) as maxLon,
                        MIN(${duckDbClient.escape(height_fieldname)}) as minHMean,
                        MAX(${duckDbClient.escape(height_fieldname)}) as maxHMean
                    FROM
                        '${filename}'
                `;

                const results = await duckDbClient.sql`${query}`;
                if (results.length > 0) {
                    const result = results[0];
                    localExtLatLon.minLat = result.minLat;
                    localExtLatLon.maxLat = result.maxLat;
                    localExtLatLon.minLon = result.minLon;
                    localExtLatLon.maxLon = result.maxLon;
                    localExtHMean.minHMean = result.minHMean;
                    localExtHMean.maxHMean = result.maxHMean;

                    await indexedDb.addNewSummary({ req_id: req_id, extLatLon: localExtLatLon, extHMean: localExtHMean });
                } else {
                    const errMsg = `readOrCacheSummary datalen is 0 for req_id:${req_id}`;
                    console.error(errMsg);
                    throw new Error(errMsg);
                }
            } catch (error) {
                console.error('readOrCacheSummary error:', error);
                throw error;
            }

            return await indexedDb.getWorkerSummary(req_id);
        }
    } catch (error) {
        console.error('duckDbReadOrCacheSummary error:', error);
        throw error;
    }
}

export const duckDbReadAndUpdateElevationData = async (req_id:number) => {
    try{
        const height_fieldname = await getHeightFieldname(req_id);
        console.log('readAndUpdateElevationData req_id:',req_id);
        const summary = await duckDbReadOrCacheSummary(req_id,height_fieldname);
        if(summary){
            useCurReqSumStore().setSummary(summary);

            // Step 1: Initialize the DuckDB client
            const duckDbClient = await createDuckDbClient();

            // Step 2: Retrieve the filename using req_id
            const filename = await indexedDb.getFilename(req_id);
            
            // Step 3: Register the Parquet file with DuckDB
            await duckDbClient.insertOpfsParquet(filename);

            // Step 4: Execute a SQL query to retrieve the elevation data
            const query = `SELECT * FROM '${filename}' `;

            const results = await duckDbClient.sql`${query}`;

            // Step 5: Process and update the elevation data as needed
            // Extract field names from the first row (assuming all rows have the same structure)
            const fieldNames = Object.keys(results[0]);

            // Find the indexes for hMean, latitude, and longitude
            const hMeanNdx = fieldNames.indexOf(height_fieldname);
            const lonNdx = fieldNames.indexOf('longitude');
            const latNdx = fieldNames.indexOf('latitude');

            // Map results to elevationData array containing all fields
            const elevationData: any[][] = results.map((row: any) => {
                return fieldNames.map(fieldName => row[fieldName]);
            });

            const use_white = false; // or set this based on your requirement

            updateElLayer(elevationData, hMeanNdx, lonNdx, latNdx, summary.extHMean, fieldNames, use_white);

        } else {
            console.error('readAndUpdateElevationData summary is undefined');
        }
    } catch (error) {
        console.error('readAndUpdateElevationData error:',error);
        throw error;
    }
}

export async function duckDbLoadOpfsParquetFile(fileName: string) {
    try{
        console.log('duckDbLoadOpfsParquetFile');

        await duckDbClient.insertOpfsParquet(fileName);

//         await duckDb.registerFileHandle('test.parquet', file, DuckDBDataProtocol.BROWSER_FILEREADER, true);
//         await duckDb_connection.query(`CREATE TABLE parquet_table AS SELECT * FROM read_parquet('test.parquet');`);
//         const data = await duckDb_connection.query(`SELECT * FROM parquet_table`);
//         console.log('SrParquetFileUpload data:',data);
//         //const metadata = await duckDb_connection.query(`SELECT * FROM parquet_metadata('test.parquet');`)
//         //console.log('SrParquetFileUpload tbl:',metadata);
//         //const schema = await duckDb_connection.query(`SELECT * FROM parquet_schema('test.parquet')`);
//         //console.log('SrParquetFileUpload schema:',schema);
//         const columnNames = await duckDb_connection.query(`DESCRIBE SELECT * FROM 'test.parquet';`)
//         console.log('SrParquetFileUpload columnNames:',columnNames);
//         //const data = await duckDb_connection.query(`SELECT * FROM read_parquet('test.parquet');`);
//         //console.log('SrParquetFileUpload data:',data);
//         const data3 = await duckDb_connection.query(`SELECT latitude,longitude,h_mean FROM parquet_table`);
//         console.log('SrParquetFileUpload data3:',data3);
    
    } catch (error) {
        console.error('duckDbLoadOpfsParquetFile error:',error);
        throw error;
    }
}