import { ref } from 'vue';
import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { createDuckDbClient, type QueryResult, type Row } from './SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import type { ExtHMean,ExtLatLon } from '@/workers/workerUtils';
import { updateElLayerWithObject,type ElevationDataItem } from './SrMapUtils';
import { getHeightFieldname } from "./SrParquetUtils";
import { useCurReqSumStore } from '@/stores/curReqSumStore';
import { useAtl06ChartFilterStore } from '@/stores/atl06ChartFilterStore';

const atl06ChartFilterStore = useAtl06ChartFilterStore();

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
            await duckDbClient.insertOpfsParquet(filename);
            try {
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
    try{
        const height_fieldname = await getHeightFieldname(req_id);
        //console.log('duckDbReadAndUpdateElevationData req_id:',req_id);
        const summary = await duckDbReadOrCacheSummary(req_id,height_fieldname);
        //console.log('duckDbReadAndUpdateElevationData summary:',summary);
        if(summary){
            console.log('duckDbReadAndUpdateElevationData summary:',summary);
            useCurReqSumStore().setSummary(summary);

            // Step 1: Initialize the DuckDB client
            const duckDbClient = await createDuckDbClient();

            // Step 2: Retrieve the filename using req_id
            const filename = await indexedDb.getFilename(req_id);
            
            // Step 3: Register the Parquet file with DuckDB
            await duckDbClient.insertOpfsParquet(filename);
            // Step 4: Execute a SQL query to retrieve the elevation data

            // Execute the query
            const results = await duckDbClient.query(`SELECT * FROM '${filename}'`);
            console.log('duckDbReadAndUpdateElevationData results:', results);

            // Read all rows from the QueryResult
            const rows: ElevationDataItem[] = [];
            for await (const row of results.readRows()) {
                rows.push(row);
            }
            //console.log('duckDbReadAndUpdateElevationData rows:',rows, 'rows[0][0]',rows[0][0],'rows[0]',rows[0],'rows[0].length:',rows[0].length,'rows.length:',rows.length);
            const fieldNames = Object.keys(rows[0][0]);

            //console.log('duckDbReadAndUpdateElevationData fieldNames:',fieldNames);
            // Process and update the elevation data as needed
            if (rows.length > 0) {

                // Process and update the elevation data as needed
                // Extract field names from the first row (assuming all rows have the same structure)

                // Find the indexes for hMean, latitude, and longitude
                const hMeanNdx = fieldNames.indexOf(height_fieldname);
                const lonNdx = fieldNames.indexOf('longitude');
                const latNdx = fieldNames.indexOf('latitude');

 
                const use_white = false; // or set this based on your requirement
                console.log('duckDbReadAndUpdateElevationData  hMeanNdx:', hMeanNdx, ' lonNdx:', lonNdx, ' latNdx:', latNdx, ' summary.extHMean:', summary.extHMean);
                console.log('duckDbReadAndUpdateElevationData rows:',rows,' fieldNames:', fieldNames, ' use_white:', use_white);
                updateElLayerWithObject(rows[0] as ElevationDataItem[], summary.extHMean, height_fieldname, use_white);//TBD rows[0] is really rowsChuck[0] iter thru both!


                // const results = await duckDbClient.sql`SELECT * FROM '${filename}'`;//<----this fails in prepare because of dashes in name
                // console.log('duckDbReadAndUpdateElevationData results:',results);
                // // Step 5: Process and update the elevation data as needed
                // // Extract field names from the first row (assuming all rows have the same structure)
                // const fieldNames = Object.keys(results[0]);

                // // Find the indexes for hMean, latitude, and longitude
                // const hMeanNdx = fieldNames.indexOf(height_fieldname);
                // const lonNdx = fieldNames.indexOf('longitude');
                // const latNdx = fieldNames.indexOf('latitude');

                // // Map results to elevationData array containing all fields
                // const elevationData: any[][] = results.map((row: any) => {
                //     return fieldNames.map(fieldName => row[fieldName]);
                // });
            } else {
                console.warn('duckDbReadAndUpdateElevationData rows is empty');
            }

        } else {
            console.error('duckDbReadAndUpdateElevationData summary is undefined');
        }
    } catch (error) {
        console.error('duckDbReadAndUpdateElevationData error:',error);
        throw error;
    }
}

export async function duckDbLoadOpfsParquetFile(fileName: string) {
    try{
        console.log('duckDbLoadOpfsParquetFile');
        const duckDbClient = await createDuckDbClient();

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

export async function duckDbReadAndUpdateScatterData(req_id:number){

}

export interface SrScatterChartData { value: number[] };

async function fetchScatterData(){
    
    const duckDbClient = await createDuckDbClient();
    const chartData = ref<SrScatterChartData[]>([]);
    const fileName = atl06ChartFilterStore.getFileName();

    const x = 'x_atc';
    const y = 'h_mean';
        
    try{
        const beams = atl06ChartFilterStore.getBeams();
        const rgt = atl06ChartFilterStore.getRgt();

        if (!beams.length) {
            throw new Error('No beams found in the filter store.');
        }
        console.log('fetchData filename:', fileName);
        console.log('fetchData beams:', beams);
        console.log('fetchData rgt:', rgt);
        const query = `
            SELECT 
                ${x}, 
                ${y}
            FROM '${fileName}'
            WHERE gt = ${beams[0]} AND rgt = ${rgt}
        `;
        const queryResult:QueryResult = await duckDbClient.query(query);
        console.log('fetchData query:', query);
        console.log('fetchData QueryResult:', queryResult);

        for await (const rowChunk of queryResult.readRows()) {
            console.log('fetchData rowChunk:', rowChunk);
            for(const row of rowChunk){
                if(row){
                    //console.log('fetchData row:', row);
                    const typedRow: SrScatterChartData = {
                        value: [row.x_atc,row.h_mean]
                    };
                    chartData.value.push(typedRow);
                } else {
                    console.warn('fetchData rowData is null');
                }
            }
        }
       

        const query2 = `
            SELECT 
                MIN(${x}) as min_x,
                MAX(${x}) as max_x,
                MIN(${y}) as min_y,
                MAX(${y}) as max_y
            FROM '${fileName}'
            WHERE gt = ${beams[0]} AND rgt = ${rgt}
        `;
        const queryResult2:QueryResult = await duckDbClient.query(query2);
        console.log('fetchData query2:', query2);
        console.log('fetchData QueryResult2:', queryResult2);

        for await (const rowChunk of queryResult2.readRows()) {
            console.log('fetchData rowChunk:', rowChunk);
            for(const row of rowChunk){
                if(row){
                    atl06ChartFilterStore.setMinX(row.min_x);
                    atl06ChartFilterStore.setMaxX(row.max_x);
                    atl06ChartFilterStore.setMinY(row.min_y);
                    atl06ChartFilterStore.setMaxY(row.max_y);                   
                } else {
                    console.warn('fetchData rowData is null');
                }
            }
            console.log('fetchData min_x:',atl06ChartFilterStore.getMinX(),' max_x:',atl06ChartFilterStore.getMaxX(),' min_y:',atl06ChartFilterStore.getMinY(),' max_y:',atl06ChartFilterStore.getMaxY());
        }
        console.log('fetchData chartData:', chartData);
        return chartData.value;
    } catch (error) {
      console.error('fetchData Error fetching data:', error);
    }
};


export async function getScatterOptions(){
    const scatterData = await fetchScatterData();
    const options = {
        title: {
          text: "Scatter Plot",
          left: "center"
        },
        tooltip: {
          trigger: "item",
          formatter: "({c})"
        },
        legend: {
          data: ['Scatter'],
          left: 'left'
        },
        xAxis: {
            min: atl06ChartFilterStore.getMinX(),
            max: atl06ChartFilterStore.getMaxX()
        },
        yAxis: {
            min: atl06ChartFilterStore.getMinY(),
            max: atl06ChartFilterStore.getMaxY()
        },
        series: [
          {
            name: 'Scatter',
            type: 'scatter',
            data: scatterData,
          }
        ]
    } 
    console.log('getScatterOptions options:',options);
    return options;   
}