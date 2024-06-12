import type { SrRequestSummary } from '@/db/SlideRuleDb';
import { createDuckDbClient } from './SrDuckDb';




export const duckDbReadAndUpdateElevationData = async (req_id:number) => {
    try{
        console.log('readAndUpdateElevationData req_id:',req_id);



    } catch (error) {
        console.error('readAndUpdateElevationData error:',error);
        throw error;
    }
}

export async function duckDbReadOrCacheSummary(req_id:number,height_fieldname:string) : Promise<SrRequestSummary | undefined>{
    try{
        console.log('readAndUpdateElevationData req_id:',req_id,' height_fieldname:',height_fieldname);
        return undefined;
    } catch (error) {
        console.error('readAndUpdateElevationData error:',error);
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